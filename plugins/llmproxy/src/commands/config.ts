import fs from "node:fs";
import YAML from "yaml";
import readline from "node:readline";
import { resolvePaths, type Paths } from "../core/paths.js";
import { parseBrains, isDirect, type BrainsConfig } from "../core/manifest.js";
import { writeGenerated, ensureSecrets } from "./init.js";
import { setKey } from "../core/env.js";
import { saveUserTemplate, allTemplates, loadUserTemplates } from "../core/templates.js";
import { DEFAULT_THINKING } from "../core/thinking.js";

// Read a secret without it landing on the command line / shell history / AI transcript.
// TTY: masked (no-echo) prompt. Piped stdin: read one line (for scripting, e.g. `... | bmux config add-key K`).
function readSecret(promptText: string): Promise<string> {
  const input = process.stdin;
  if (!input.isTTY) {
    return new Promise((resolve) => {
      const rl = readline.createInterface({ input });
      rl.once("line", (line) => { rl.close(); resolve(line.trim()); });
      rl.once("close", () => resolve(""));
    });
  }
  return new Promise((resolve, reject) => {
    process.stdout.write(promptText);
    input.setRawMode(true);
    input.resume();
    input.setEncoding("utf8");
    let val = "";
    const finish = (cb: () => void) => {
      input.setRawMode(false);
      input.pause();
      input.removeListener("data", onData);
      process.stdout.write("\n");
      cb();
    };
    const onData = (chunk: string) => {
      for (const ch of chunk) {
        const code = ch.charCodeAt(0);
        if (code === 13 || code === 10 || code === 4) return finish(() => resolve(val)); // CR / LF / EOT
        if (code === 3) return finish(() => reject(new Error("aborted")));               // Ctrl-C
        if (code === 127 || code === 8) { val = val.slice(0, -1); continue; }            // DEL / Backspace
        val += ch;
      }
    };
    input.on("data", onData);
  });
}

function load(paths: Paths): BrainsConfig {
  return parseBrains(fs.readFileSync(paths.brainsYaml, "utf8"));
}

function save(paths: Paths, cfg: BrainsConfig): void {
  // validate the mutated object before persisting, then regenerate
  const validated = parseBrains(YAML.stringify(cfg));
  fs.writeFileSync(paths.brainsYaml, YAML.stringify(validated));
  ensureSecrets(paths, validated);
  writeGenerated(paths, validated);
}

export function addBrain(paths: Paths, name: string, port: number, model: string, providerKey: string): void {
  const cfg = load(paths);
  if (cfg.brains[name]) throw new Error(`brain '${name}' already exists`);
  for (const [n, b] of Object.entries(cfg.brains)) {
    if (!isDirect(b) && b.port === port) throw new Error(`port ${port} already used by '${n}'`);
  }
  cfg.brains[name] = { port, model, providerKey };
  save(paths, cfg);
}

// A direct brain: an Anthropic-compatible endpoint with Bearer auth — no LiteLLM container.
// Only the token FILE path is stored; the token is read from it at run time.
export function addDirectBrain(paths: Paths, name: string, url: string, model: string, authTokenFile: string, maxOutputTokens?: number, contextWindow?: number): void {
  const cfg = load(paths);
  if (cfg.brains[name]) throw new Error(`brain '${name}' already exists`);
  cfg.brains[name] = { url, model, authTokenFile, ...(maxOutputTokens && { maxOutputTokens }), ...(contextWindow && { contextWindow }) };
  save(paths, cfg);
}

export async function runConfig(sub: string, rest: string[], env: NodeJS.ProcessEnv = process.env): Promise<number> {
  const paths = resolvePaths(env);
  try {
    switch (sub) {
      case "add-brain": {
        const [name, portStr, model, providerKey = "OPENROUTER_API_KEY"] = rest;
        if (!name || !portStr || !model) throw new Error("usage: bmux config add-brain <name> <port> <model> [providerKey]");
        const port = Number(portStr);
        if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error(`port must be an integer 1-65535, got '${portStr}'`);
        addBrain(paths, name, port, model, providerKey);
        console.log(`added brain '${name}' on :${portStr}`);
        return 0;
      }
      case "add-direct": {
        const [name, url, model, authTokenFile, maxStr, ctxStr] = rest;
        if (!name || !url || !model || !authTokenFile) throw new Error("usage: bmux config add-direct <name> <url> <model> <authTokenFile> [maxOutputTokens] [contextWindow]");
        const max = maxStr === undefined ? undefined : Number(maxStr);
        if (max !== undefined && (!Number.isInteger(max) || max < 1)) throw new Error(`maxOutputTokens must be a positive integer, got '${maxStr}'`);
        const ctx = ctxStr === undefined ? undefined : Number(ctxStr);
        if (ctx !== undefined && (!Number.isInteger(ctx) || ctx < 1024)) throw new Error(`contextWindow must be an integer ≥ 1024, got '${ctxStr}'`);
        addDirectBrain(paths, name, url, model, authTokenFile, max, ctx);
        console.log(`added direct brain '${name}' → ${url} (${model}); token read from ${authTokenFile} at run time`);
        return 0;
      }
      case "remove-brain": {
        const [name] = rest;
        const cfg = load(paths);
        if (!cfg.brains[name]) throw new Error(`no such brain '${name}'`);
        delete cfg.brains[name];
        save(paths, cfg);
        console.log(`removed brain '${name}' (its DB + master key remain in .env / data)`);
        return 0;
      }
      case "set-model": {
        const [name, model] = rest;
        if (!name || !model) throw new Error("usage: bmux config set-model <name> <model>");
        const cfg = load(paths);
        if (!cfg.brains[name]) throw new Error(`no such brain '${name}'`);
        cfg.brains[name].model = model;
        save(paths, cfg);
        console.log(`set '${name}' model = ${model}`);
        return 0;
      }
      case "add-key": {
        const [key, value] = rest;
        if (!key) throw new Error("usage: bmux config add-key <ENV_VAR> [value]  (omit value to enter it hidden)");
        // Omit the value on the command line to enter it via a hidden prompt — keeps the
        // secret out of argv, shell history, and any AI-session transcript.
        const secret = value !== undefined ? value : await readSecret(`Value for ${key} (hidden, won't echo): `);
        if (!secret) throw new Error(`no value provided for ${key}`);
        setKey(paths.envFile, key, secret);
        console.log(`set ${key} in .env`);
        return 0;
      }
      case "list": {
        const cfg = load(paths);
        for (const [name, b] of Object.entries(cfg.brains)) {
          if (isDirect(b)) console.log(`${name.padEnd(8)} direct ${b.url}  ${b.model}  thinking ${b.thinking ?? DEFAULT_THINKING}${b.images ? "  images" : "  text-only"}${b.contextWindow ? `  ctx ${b.contextWindow}` : ""}  (token: ${b.authTokenFile})`);
          else console.log(`${name.padEnd(8)} :${b.port}  ${b.model}  (${b.providerKey})`);
        }
        return 0;
      }
      case "add-template": {
        const [name, ...promptParts] = rest;
        const prompt = promptParts.join(" ");
        if (!name || !prompt) throw new Error('usage: bmux config add-template <name> "<prompt>"');
        saveUserTemplate(paths, name, prompt);
        console.log(`saved template '${name}' to templates.yaml`);
        return 0;
      }
      case "list-templates": {
        const user = loadUserTemplates(paths);
        for (const [n, p] of Object.entries(allTemplates(paths))) {
          const tag = n in user ? "user " : "built";
          console.log(`[${tag}] ${n.padEnd(12)} ${p.length > 66 ? p.slice(0, 65) + "…" : p}`);
        }
        return 0;
      }
      default:
        process.stderr.write(`bmux config: unknown subcommand '${sub}'\n`);
        return 1;
    }
  } catch (e) {
    process.stderr.write(`bmux config: ${(e as Error).message}\n`);
    return 1;
  }
}

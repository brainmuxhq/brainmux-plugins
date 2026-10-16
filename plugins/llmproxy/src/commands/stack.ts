import { resolvePaths } from "../core/paths.js";
import { loadBrains, litellmBrains, type BrainsConfig } from "../core/manifest.js";
import { ensureDocker, runCompose, liveliness } from "../core/docker.js";
import { masterKeyVar } from "../core/generate.js";
import { writeGenerated } from "./init.js";

// Printed after a successful `up`/`restart`. Points at each brain's LiteLLM UI
// (observation panel per CLAUDE.md — link, don't rewrite) and how to log in.
// References the master-key env var NAME, never the secret value.
export function upSummary(cfg: BrainsConfig): string {
  const lines = ["", "brains up. observe spend/logs in each LiteLLM UI (login: admin):"];
  for (const [name, b] of litellmBrains(cfg)) {
    lines.push(`  ${name.padEnd(8)} http://127.0.0.1:${b.port}/ui   password: $${masterKeyVar(name)}`);
  }
  lines.push("  (password values live in ~/.brainmux/.env · `bmux spend` for a quick total)");
  return lines.join("\n");
}

const STACK_SUBS = new Set(["up", "down", "restart", "ps", "logs", "health"]);

export async function runStack(sub: string, rest: string[], env: NodeJS.ProcessEnv = process.env): Promise<number> {
  const paths = resolvePaths(env);
  // The stack is the LiteLLM brains only; direct (url) brains are reached as-is. With none,
  // there is nothing to start/inspect — say so instead of touching docker.
  if (STACK_SUBS.has(sub) && !litellmBrains(loadBrains(paths.brainsYaml)).length) {
    process.stdout.write(`bmux ${sub}: no LiteLLM brains in brains.yaml — nothing to run (direct brains need no stack).\n`);
    return 0;
  }
  if (sub === "up" || sub === "restart") {
    ensureDocker();
    const cfg = loadBrains(paths.brainsYaml);
    writeGenerated(paths, cfg); // regenerate from SSOT before (re)starting
    const args = sub === "restart" ? ["up", "-d", "--force-recreate"] : ["up", "-d"];
    const code = runCompose(paths, args);
    if (code === 0) process.stdout.write(upSummary(cfg) + "\n");
    return code;
  }
  if (sub === "down") { ensureDocker(); return runCompose(paths, ["down"]); }
  if (sub === "ps") { ensureDocker(); return runCompose(paths, ["ps"]); }
  if (sub === "logs") { ensureDocker(); return runCompose(paths, ["logs", "-f", ...rest]); }
  if (sub === "health") {
    const cfg = loadBrains(paths.brainsYaml);
    let fail = 0;
    for (const [name, b] of litellmBrains(cfg)) {
      const ok = await liveliness(b.port);
      process.stdout.write(`${name.padEnd(8)} ${ok ? "UP  " : "DOWN"} (:${b.port})\n`);
      if (!ok) fail = 1;
    }
    return fail;
  }
  process.stderr.write(`bmux: unknown stack command '${sub}'\n`);
  return 1;
}

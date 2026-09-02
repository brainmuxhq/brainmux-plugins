#!/usr/bin/env node
import { fileURLToPath } from "node:url";
import { runInit } from "./commands/init.js";
import { runStack } from "./commands/stack.js";
import { runLaunch } from "./commands/launch.js";
import { runDelegate } from "./commands/delegate.js";
import { runConfig } from "./commands/config.js";
import { runModels } from "./commands/models.js";
import { runSpend } from "./commands/spend.js";
import { runStatusline } from "./commands/statusline.js";
import { runShim } from "./commands/shim.js";
import { runTest } from "./commands/test.js";
import { loadBrains } from "./core/manifest.js";
import { resolvePaths } from "./core/paths.js";

const HELP = `bmux — brainmux/llmproxy CLI

  bmux init                       scaffold ~/.brainmux (brains.yaml, .env, generated/)
  bmux up | down | restart        manage the brain stack (regenerates from brains.yaml)
  bmux ps | logs [svc] | health   inspect the stack
  bmux <brain> [claude args...]   launch Claude Code on a brain (e.g. bmux chat)
  bmux delegate <brain> [--write|--yolo] [-C dir] [--json] [--stream] [--mcp] [--allow-tools t1,t2] [--verify] "<task>"
                                  (--stream shows a live progress line: ⏳ brain · 5/34 · <step>)
                                  (--mcp passes host MCP servers; --allow-tools pre-allows tools headless — e.g.
                                   --allow-tools mcp__brave-search__brave_web_search for grounded web search, no --yolo)
                                  (--verify: draft, then a grounded pass web-checks each claim → ✅/⚠ with sources)
                                  (--template <name>: expand a saved task template — bmux config list-templates)
                                  (--retry [n]: on an empty/failed result, auto-retry up to n times — default 1)
  bmux config add-brain <name> <port> <model> [providerKey]
  bmux config remove-brain <name> | set-model <name> <model>
  bmux config add-key <ENV_VAR> <value> | list
  bmux config add-template <name> "<prompt>" | list-templates   (reusable delegate task templates)
  bmux test                       smoke every brain via /v1/messages
  bmux spend [--since 1h|30m|7d]  per-brain requests/tokens/spend (from LiteLLM); --since scopes a window
  bmux install-shim [--force]     put a version-agnostic bmux on ~/.local/bin (works from any shell)
  bmux models [query] | --use-cases | --json   list OpenRouter models (live) / use-cases
  bmux statusline install [--force]   enable the brainmux Claude Code status line
`;

const STACK = new Set(["up", "down", "restart", "ps", "logs", "health"]);

export async function main(argv: string[], env: NodeJS.ProcessEnv = process.env): Promise<number> {
  const cmd = argv[0];
  const rest = argv.slice(1);
  if (!cmd || cmd === "-h" || cmd === "--help") { process.stdout.write(HELP); return 0; }

  try {
    if (cmd === "init") return runInit(env);
    if (cmd === "test") return await runTest(env);
    if (cmd === "delegate") return await runDelegate(rest, env);
    if (cmd === "config") return await runConfig(rest[0] ?? "", rest.slice(1), env);
    if (cmd === "models") return await runModels(rest, env);
    if (cmd === "spend") return await runSpend(rest, env);
    if (cmd === "statusline") return runStatusline(rest, env);
    if (cmd === "install-shim") return runShim(rest, env);
    if (STACK.has(cmd)) return await runStack(cmd, rest, env);

    // otherwise: treat cmd as a brain name to launch (chat/deep/coder/...)
    const cfg = loadBrains(resolvePaths(env).brainsYaml);
    if (cfg.brains[cmd]) return runLaunch(cmd, rest, env);

    process.stderr.write(`bmux: unknown command '${cmd}'\n\n${HELP}`);
    return 1;
  } catch (e) {
    process.stderr.write(`bmux: ${e instanceof Error ? e.message : String(e)}\n`);
    return 1;
  }
}

// Executed directly (via bin/bmux -> dist/src/cli.js)
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main(process.argv.slice(2)).then((code) => process.exit(code));
}

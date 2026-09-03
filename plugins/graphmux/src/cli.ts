#!/usr/bin/env node
import { fileURLToPath } from "node:url";
import { runInstall } from "./commands/install.js";
import { runGraph, runRaw, GRAPH_VERBS } from "./commands/graph.js";
import { runOrphans } from "./commands/orphans.js";
import { runHook } from "./commands/hook.js";
import { runDrift } from "./commands/drift.js";
import { CODEGRAPH_VERSION } from "./core/codegraph.js";

const HELP = `gmux — brainmux/graphmux CLI (local codebase memory; vendors CodeGraph v${CODEGRAPH_VERSION})

  gmux install                    download + SHA256-verify the pinned CodeGraph binary (telemetry off),
                                  then write the "graphmux" MCP config for delegates / Claude Code
  gmux index [path]               build/rebuild the code graph for a repo
  gmux status | sync [path]       index status / sync changes since last index
  gmux callers <sym>              who calls <sym>  (auto --limit 1000 — avoids the silent cap)
  gmux impact <sym>               blast radius of changing <sym>  (transitive, no cap — prefer for "what breaks")
  gmux node <sym>                 one symbol's source + caller/callee trail  (auto --limit 1000)
  gmux explore "<query>"          relevant symbols + call paths + verbatim source, one shot
  gmux callees | files [args]     more graph queries
  gmux orphans [path] [opts]      bulk dead/orphan candidates (0 incoming calls/refs), framework
                                  roots excluded  ·  --exports --all --lang=ts,py --json  (Node >=22)
  gmux drift <sym> [path]         graph impact + auto-grep the graph-blind zones (ORM/queue/handler/
                                  middleware/Next) → [graph]=certain, [grep-unverified]=verify
  gmux hook install|uninstall|status [path]
                                  git hook that auto-syncs the index on commit/merge/checkout
                                  (the CLI does NOT watch files; this is the auto-reindex)
  gmux -- <codegraph args...>     raw passthrough (no smart defaults) to the vendored engine

  then: bmux delegate <brain> --memory "<task>"   (llmproxy grounds the cheap brain on the graph)
`;

export async function main(argv: string[], env: NodeJS.ProcessEnv = process.env): Promise<number> {
  const cmd = argv[0];
  const rest = argv.slice(1);
  if (!cmd || cmd === "-h" || cmd === "--help") { process.stdout.write(HELP); return 0; }

  try {
    if (cmd === "install") return runInstall(rest, env);
    if (cmd === "hook") return runHook(rest, env);
    if (cmd === "orphans") return runOrphans(rest, env);
    if (cmd === "drift") return runDrift(rest, env);
    if (cmd === "--") return runRaw(rest, env);
    if (GRAPH_VERBS.has(cmd)) return runGraph(cmd, rest, env);

    process.stderr.write(`gmux: unknown command '${cmd}'\n\n${HELP}`);
    return 1;
  } catch (e) {
    process.stderr.write(`gmux: ${e instanceof Error ? e.message : String(e)}\n`);
    return 1;
  }
}

// Executed directly (via bin/gmux -> dist/gmux.js). The bundle's guard is false through the
// dynamic import in bin/gmux, so bin calls main() explicitly.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main(process.argv.slice(2)).then((code) => process.exit(code));
}

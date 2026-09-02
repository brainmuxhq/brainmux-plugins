#!/usr/bin/env node
import { fileURLToPath } from "node:url";
import { runInstall } from "./commands/install.js";
import { runGraph, runRaw } from "./commands/graph.js";
import { CODEGRAPH_VERSION } from "./core/codegraph.js";

const HELP = `gmux — brainmux/graphmux CLI (local codebase memory; vendors CodeGraph v${CODEGRAPH_VERSION})

  gmux install                    download + SHA256-verify the pinned CodeGraph binary (telemetry off),
                                  then write the "codegraph" MCP config for delegates / Claude Code
  gmux index [path]               build/rebuild the code graph for a repo
  gmux status [path]              show index status (files, nodes, edges, staleness)
  gmux sync [path]                sync changes since last index
  gmux -- <codegraph args...>     raw passthrough to the vendored engine (explore, callers, impact, …)

  then: bmux delegate <brain> --memory "<task>"   (llmproxy grounds the cheap brain on the graph)
`;

const PASSTHRU = new Set(["index", "status", "sync"]);

export async function main(argv: string[], env: NodeJS.ProcessEnv = process.env): Promise<number> {
  const cmd = argv[0];
  const rest = argv.slice(1);
  if (!cmd || cmd === "-h" || cmd === "--help") { process.stdout.write(HELP); return 0; }

  try {
    if (cmd === "install") return runInstall(rest, env);
    if (cmd === "--") return runRaw(rest, env);
    if (PASSTHRU.has(cmd)) return runGraph(cmd, rest, env);

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

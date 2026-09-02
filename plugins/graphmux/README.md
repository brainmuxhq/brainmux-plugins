# graphmux

Local, deterministic **codebase memory** for Claude Code and `bmux` delegates. A cheap brain
grounds on the real call-graph (definitions, callers, callees, blast-radius, verbatim source)
instead of hallucinating — fewer tokens, fewer tool calls, no fabricated files/symbols.

graphmux is a **thin wrapper** over a vendored core — [CodeGraph](https://github.com/colbymchenry/codegraph)
(MIT, tree-sitter → local SQLite, no embeddings, no external DB, 100% local). Per brainmux
house-style we don't reimplement the engine: we pin the exact release + SHA256, verify it, and
own only the `gmux` control layer. **Telemetry is forced off** (`DO_NOT_TRACK=1`).

## Install (Claude Code plugin)

```
/plugin marketplace add brainmuxhq/brainmux
/plugin install graphmux@brainmux
```

## Commands

```
gmux install                 download + SHA256-verify the pinned CodeGraph binary, write the MCP config
gmux index [path]            build/rebuild the code graph for a repo
gmux status [path]           index status (files, nodes, edges, staleness)
gmux sync [path]             sync changes since last index
gmux -- <codegraph args>     raw passthrough (explore, callers, callees, impact, node, files, …)
```

## Use it

```
gmux install
gmux index ~/code/myrepo
bmux delegate coder --memory "list every caller of getPort and update the signature"
```

`bmux delegate --memory` (llmproxy) injects graphmux's MCP config + pre-allows the read-only
graph tools, so the delegate queries the graph before acting.

Manual grounding, no delegate:
```
gmux -- explore "how does auth work"
gmux -- callers getPort
gmux -- impact getPort
```

## Notes

- **State:** the binary is cached under `~/.brainmux/graphmux/<version>/`; the MCP config is
  written to `~/.brainmux/generated/graphmux-mcp.json`.
- **Project index:** `gmux index` writes `.codegraph/` in your repo — add it to `.gitignore`.
- **Updates are deliberate:** the CodeGraph version + SHA are pinned in `src/core/codegraph.ts`;
  bump them together when we choose. No auto-upgrade, no fork.
- **Requires:** `curl` + `tar` (macOS/Linux) to fetch/extract the pinned binary on first use.

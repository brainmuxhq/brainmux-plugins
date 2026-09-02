---
name: graphmux
description: Use to give an agent a local, deterministic code graph — install/index a repo's call-graph, answer code-structure questions (callers, callees, impact/blast-radius, explore), or ground a bmux delegate on real code via `--memory`. Triggers on "who calls X", "what breaks if I change Y", "index the codebase", "map this repo", or grounding a cheap brain.
---

# graphmux — local code graph via `gmux`

## What this is
`graphmux` gives agents a **deterministic** code graph: definitions, callers, callees, impact/
blast-radius, and verbatim source — from a local index, no embeddings, no network, 100% offline.
It is a **thin wrapper** over a vendored core ([CodeGraph](https://github.com/colbymchenry/codegraph),
MIT, tree-sitter → SQLite). Telemetry is forced off. Always invoke as `${CLAUDE_PLUGIN_ROOT}/bin/gmux …`.

Prefer this over grep/Read for structural questions: it returns the *enclosing function* and real
call paths (grep returns lines and misses call structure), and it cuts tokens/tool-calls sharply.

## Natural-language execution (run it yourself)
When the user asks a graphmux job in plain language, run the command yourself with Bash and report
one line of what you ran. These are safe → run directly:
```sh
${CLAUDE_PLUGIN_ROOT}/bin/gmux install          # download + SHA256-verify the pinned binary, write the MCP config (telemetry off)
${CLAUDE_PLUGIN_ROOT}/bin/gmux index [path]      # build/rebuild the code graph for a repo
${CLAUDE_PLUGIN_ROOT}/bin/gmux status [path]     # index stats + staleness
${CLAUDE_PLUGIN_ROOT}/bin/gmux sync [path]       # sync changes since last index
${CLAUDE_PLUGIN_ROOT}/bin/gmux -- <args>         # raw query: explore / callers / callees / impact / node / files
```
First use needs `gmux install` once (fetches the pinned binary; needs `curl` + `tar`).

## Answer code-structure questions directly
```sh
gmux -- explore "how does auth work"     # relevant symbols + call paths + blast-radius + verbatim source, one shot
gmux -- callers getPort                   # every function that calls getPort (name + file:line)
gmux -- impact getPort                    # what changing getPort affects (blast radius)
gmux -- node runSpend                     # one symbol's source + caller/callee trail
```
Run these when the user asks "who calls X", "what breaks if I change Y", "trace this", "map the repo".
Ground your own edits with `impact`/`callers` before changing a widely-used symbol.

## Ground a delegate (with llmproxy)
`bmux delegate <brain> --memory "<task>"` wires graphmux's MCP into the cheap brain (isolated —
only the graph loads, no host MCP) so it queries real callers/impact instead of hallucinating.
Requires `gmux install` first. Suggest `--memory` whenever delegating a task that reasons about
code structure (refactors, "update every caller of…", impact analysis).

## Notes
- **State:** binary cached under `~/.brainmux/graphmux/<version>/`; MCP config at
  `~/.brainmux/generated/graphmux-mcp.json` (server name `graphmux`).
- **Project index:** `gmux index` writes `.codegraph/` in the repo — suggest adding it to `.gitignore`.
- **Freshness:** the index auto-syncs on file changes; after a big change, `gmux status` shows staleness.
- **Updates are pinned:** the CodeGraph version + SHA live in the plugin; we bump them deliberately (no auto-upgrade, no fork).

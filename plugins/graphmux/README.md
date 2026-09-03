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
/plugin marketplace add brainmuxhq/brainmux-plugins
/plugin install graphmux@brainmux
```

## Commands

```
gmux install                 download + SHA256-verify the pinned CodeGraph binary, write the MCP config
gmux index [path]            build/rebuild the code graph for a repo
gmux status | sync [path]    index status / sync changes since last index
gmux callers <sym>           who calls <sym>   (auto --limit 1000 — avoids the silent cap)
gmux impact <sym>            blast radius of changing <sym>  (transitive, no cap — prefer for "what breaks")
gmux node <sym>              one symbol's source + caller/callee trail  (auto --limit 1000)
gmux explore "<query>"       relevant symbols + call paths + verbatim source, one shot
gmux callees | files [args]  more graph queries
gmux orphans [path] [opts]   bulk dead/orphan candidates: symbols with 0 incoming calls/refs,
                             framework roots excluded  ·  --exports --all --lang=ts,py --json  (Node >=22)
gmux -- <codegraph args>     raw passthrough (no smart defaults — you manage --limit)
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
gmux explore "how does auth work"
gmux callers getPort
gmux impact getPort
gmux orphans                 # dead-code candidates across the repo (verify before deleting)
gmux orphans --exports       # exported symbols with no in-repo caller (unused public surface)
```

## Known limits (dogfooded on a 26k-node repo)

It's a **static** call-graph — great for synchronous, lexically-visible calls; blind to some
dynamic/framework wiring. Use it as a fast pre-scan a human/Opus verifies, not a blind source of truth.

- **CodeGraph silently caps `callers`/`node` at `--limit 20`.** The first-class `gmux callers`/`gmux node`
  verbs inject `--limit 1000` for you; only raw `gmux -- callers …` and the delegate MCP tool still cap —
  there pass `--limit`, or use **`impact`** (no cap, transitive, more complete).
- **"No callers" ≠ dead code** — queue workers, Next.js entry points, event handlers and registry-lazy
  imports look call-less. Check for a framework entry before deleting.
- **`gmux orphans` = candidates, not proof** — it drops the framework entry points above by heuristic,
  but member-access (`obj.method`), same-file JSX and dynamic dispatch still hide real callers. Treat the
  list as a pre-scan; verify (e.g. `gmux node <sym>`) before deleting. `--all` shows the unfiltered set.
- **Ripgrep, don't trust the graph, for:** CommonJS `exports.X = () => {}` handlers, ORM calls
  (`prisma.<model>.…`), queue enqueue↔worker pairs, middleware chains (`app.use(...spread)`).
- **Generic/same-named symbols collide** — run `gmux -- node <sym>` first to see the definition count.
- **`explore`** is good for English-named static code; weak on non-English domain terms + dynamic `require()`.

## Notes

- **State:** the binary is cached under `~/.brainmux/graphmux/<version>/`; the MCP config is
  written to `~/.brainmux/generated/graphmux-mcp.json`.
- **Project index:** `gmux index` writes `.codegraph/` in your repo — add it to `.gitignore`.
- **Updates are deliberate:** the CodeGraph version + SHA are pinned in `src/core/codegraph.ts`;
  bump them together when we choose. No auto-upgrade, no fork.
- **Requires:** `curl` + `tar` (macOS/Linux) to fetch/extract the pinned binary on first use.

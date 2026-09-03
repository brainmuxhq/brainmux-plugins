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
${CLAUDE_PLUGIN_ROOT}/bin/gmux sync [path]       # sync changes since last index (run after edits)
${CLAUDE_PLUGIN_ROOT}/bin/gmux orphans [path]    # dead/orphan candidates (--exports --all --lang --json; Node >=22)
${CLAUDE_PLUGIN_ROOT}/bin/gmux -- <args>         # raw query: explore / callers / callees / impact / node / files
```
First use needs `gmux install` once (fetches the pinned binary; needs `curl` + `tar`).

## Answer code-structure questions directly
First-class verbs (no `--` needed); `callers`/`node` auto-inject `--limit 1000` so the silent cap can't bite:
```sh
gmux explore "how does auth work"     # relevant symbols + call paths + verbatim source, one shot
gmux callers getPort                   # who calls getPort  (auto --limit 1000)
gmux impact getPort                    # blast radius of changing getPort  (transitive, no cap — PREFER for "what breaks")
gmux node getPort                      # one symbol's source + caller/callee trail  (auto --limit 1000)
gmux -- <raw codegraph args>           # escape hatch: raw passthrough, NO smart defaults (you manage --limit)
```
Run these when the user asks "who calls X", "what breaks if I change Y", "trace this", "map the repo".
Ground your own edits with `impact` before changing a widely-used symbol.

## Limits — how to trust the answer (dogfooded on a 26k-node repo)
graphmux is a **static** call-graph: excellent for synchronous, lexically-visible calls; blind to
some dynamic/framework wiring. Follow these or you'll get confidently-wrong answers:

- **CodeGraph silently caps `callers`/`node` at `--limit 20`** (no "…N more"; the MCP tool + `gmux -- callers`
  inherit it). The first-class `gmux callers`/`gmux node` verbs now inject `--limit 1000` for you, so the
  silent under-count is handled — but **the raw `gmux -- callers …` and the delegate MCP tool still cap**:
  there, pass `--limit` or (better) use **`impact`** (no cap, transitive, more complete than `callers`).
- **"No callers found" ≠ dead code.** Framework/queue entry points look call-less: queue workers,
  Next.js `getServerSideProps`/API routes/page default exports, inline event handlers, registry-lazy
  (`registerX('k', () => import())`). Never delete on "no callers" alone — check for a framework entry.
- **Ripgrep these zones; don't trust the graph:** CommonJS `exports.X = async () => {}` route handlers
  (invisible), ORM calls (`prisma.<model>.…`, DB blast-radius is off-graph), queue enqueue↔worker pairs
  (`boss.send(Q)` ↔ `queue.work(Q, …)` — edge is broken), middleware chains (`app.use(...spread)`).
- **Generic / same-named symbols** (`create`, `error`, `deleteUser`, `getServerSideProps`) collide into
  one node → run `gmux -- node <sym>` first to see how many definitions exist, then trust callers/callees.
- **`explore`** is good for English-named static code; weak on non-English domain terms (query in the
  code's language) and dynamic `require()`. Treat it as a lead, not proof.

Bottom line: **fast pre-scan that a human/Opus verifies** — not yet a blindly-trusted source of truth.

## Ground a delegate (with llmproxy)
`bmux delegate <brain> --memory "<task>"` wires graphmux's MCP into the cheap brain (isolated —
only the graph loads, no host MCP) so it queries real callers/impact instead of hallucinating.
Requires `gmux install` first. Suggest `--memory` whenever delegating a task that reasons about
code structure (refactors, "update every caller of…", impact analysis).

**Command by tool name — don't leave it fuzzy.** A cheap brain, told loosely to "list callers", tends
to pick `codegraph_explore` (fuzzy) over `codegraph_callers`/`codegraph_impact` (exact) and then mixes
in false positives or invents results. Name the exact tool in the task: *"call `codegraph_impact <sym>`
and list its output verbatim — do not use explore."* Then Opus verifies (the graph is a lead, not gospel).

## Notes
- **State:** binary cached under `~/.brainmux/graphmux/<version>/`; MCP config at
  `~/.brainmux/generated/graphmux-mcp.json` (server name `graphmux`).
- **Project index:** `gmux index` writes `.codegraph/` in the repo — suggest adding it to `.gitignore`.
- **Freshness (the CLI does NOT watch files):** after edits the index is stale until you run `gmux sync`
  (or `gmux index`). `gmux status` reports the last-index state and can lag uncommitted edits. For hands-off
  freshness, `gmux hook install [path]` wires a git hook that runs `codegraph sync -q` on every
  commit/merge/checkout — so the index self-updates on git events (not per-save).
- **Updates are pinned:** the CodeGraph version + SHA live in the plugin; we bump them deliberately (no auto-upgrade, no fork).

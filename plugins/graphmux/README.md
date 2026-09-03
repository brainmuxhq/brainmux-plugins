<p align="center">
  <img src="../../brand/graphmux.svg" width="84" height="84" alt="graphmux" />
</p>

<h1 align="center">graphmux</h1>

<p align="center"><strong>Give your AI a deterministic map of your codebase — 100% local, zero hallucination.</strong></p>

<p align="center">
  <img src="https://img.shields.io/badge/Claude%20Code-plugin-8B8CF9?style=flat-square" alt="Claude Code plugin" />
  <img src="https://img.shields.io/badge/100%25-local-4FD1C5?style=flat-square" alt="100% local" />
  <img src="https://img.shields.io/badge/telemetry-off-3fb950?style=flat-square" alt="telemetry off" />
  <img src="https://img.shields.io/badge/license-MIT-blue?style=flat-square" alt="MIT" />
</p>

---

AI coding agents guess at your code structure. They grep, they infer, they invent a `getUser` in a
file that doesn't exist, they "update all the callers" and miss four. **graphmux replaces the guess
with a fact:** a real call-graph of your repo — every definition, caller, callee and blast-radius —
built locally from your source and served to the agent on demand. No embeddings, no cloud, no
"probably."

```sh
gmux install && gmux index .
bmux delegate coder --memory "update every caller of getPort to take a string"
```

The delegate now *queries the graph* before it writes a line — so it edits the **actual** callers,
not the ones it imagined.

## Why it makes you say "waaw"

- **Your cheap AI suddenly knows your code.** `bmux delegate --memory` drops a budget model onto the
  real graph in a sandbox. Grounded on facts, a $0.10 model stops fabricating files and symbols — the
  expensive part of your quota goes to judgment, not to grunt work it now gets *right*.
- **Ask "what breaks if I change this?" and get a real answer.** `gmux impact <sym>` walks the
  transitive blast-radius — the thing you actually want before a refactor, not a fuzzy text search.
- **Find the dead code nobody dares delete.** `gmux orphans` lists every symbol with zero callers
  across the whole repo, framework entry points filtered out — in one command.
- **See the drift a static graph is blind to.** `gmux drift <sym>` fuses the certain call-graph with
  a targeted grep of exactly the zones no static analyzer can see (ORM calls, queue workers,
  middleware, framework entry points) — and tells you which is which.
- **It's yours and it stays yours.** Local SQLite, telemetry forced off, a SHA256-verified pinned
  binary. Nothing about your code leaves the machine. Ever.

## graphmux vs. the CodeGraph core — what we actually add

graphmux is a **thin wrapper**, by design. The parsing engine is
[CodeGraph](https://github.com/colbymchenry/codegraph) (MIT, tree-sitter → local SQLite) — it does
the hard work of turning source into a graph, and we don't reimplement a line of it. What we add is
the layer a real team **and its AI agents** need to actually *use* that engine safely and turn it
into a maintenance instrument:

| | CodeGraph (the engine) | **graphmux (what we add)** |
|---|---|---|
| Source → call-graph | ✅ tree-sitter → local SQLite | used as-is — no reimplementation |
| Install | fetch a binary yourself | pinned release, **SHA256-verified**, mirrored, one `gmux install` |
| Telemetry | — | **forced off** (`DO_NOT_TRACK=1`) — provably local |
| AI grounding | raw MCP server | **`bmux delegate --memory`** — a cheap brain queries the graph in an isolated MCP sandbox before it acts |
| "What's dead?" | — | **`gmux orphans`** — bulk zero-caller scan, framework roots excluded |
| "What breaks?" | `callers` (silent `--limit 20` → under-counts) | **`gmux impact`** (uncapped, transitive) + smart `--limit 1000` on `callers`/`node` |
| Dynamic/framework wiring | invisible to *any* static graph | **`gmux drift`** — graph + blind-zone grep (ORM / queue / handler / middleware / Next), per-repo config cascade |
| Freshness | manual re-index | **`gmux hook`** — git-event auto-reindex (post-commit/merge/checkout) |
| Updates | you track upstream | pinned version + SHA in one file; deliberate bumps, **no fork** |

Same core, our packaging — that's the whole brainmux house-style. You get an engine maintained by its
upstream community, wrapped in exactly the control, safety and agent-ergonomics we'd want ourselves.

## Install

```
/plugin marketplace add brainmuxhq/brainmux-plugins
/plugin install graphmux@brainmux
```

Then, once per machine + repo:

```
gmux install                 # download + SHA256-verify the pinned CodeGraph binary, write the MCP config
gmux index ~/code/myrepo     # build the graph for your repo (.codegraph/ — add it to .gitignore)
```

Requires `curl` + `tar` (macOS/Linux) to fetch the pinned binary on first use.

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
                             framework roots excluded  ·  auto-syncs first (--no-sync to skip)
                             --exports --all --lang=ts,py --json  (Node >=22)
gmux hook install|uninstall|status [path]
                             git hook (post-commit/merge/checkout) that auto-syncs the index —
                             the CLI does NOT watch files, so this is the hands-off auto-reindex
gmux drift <sym|model> [path]
                             [graph] callers+impact (certain) + [grep-unverified] the graph-BLIND
                             zones (ORM/queue/handler/middleware/Next), symbol-scoped. Zones are a
                             config cascade (default < ~/.brainmux/graphmux-zones.json < repo
                             .graphmux/zones.json < --zone label=regex); `--list-zones` shows them.
gmux -- <codegraph args>     raw passthrough (no smart defaults — you manage --limit)
```

## Use it

Grounded delegation (the headline use — `bmux delegate --memory` from the
[llmproxy](../llmproxy/) plugin injects graphmux's MCP config + pre-allows the read-only graph
tools, so the cheap brain queries the graph before acting):

```
gmux install
gmux index ~/code/myrepo
bmux delegate coder --memory "list every caller of getPort and update the signature"
```

Manual grounding, no delegate:

```
gmux explore "how does auth work"
gmux callers getPort            # who calls it
gmux impact getPort             # what a change ripples into
gmux orphans                    # dead-code candidates across the repo (verify before deleting)
gmux orphans --exports          # exported symbols with no in-repo caller (unused public surface)
gmux drift Profil               # a model/symbol's graph edges + the blind-zone wiring around it
```

## Known limits (dogfooded on a 26k-node repo)

It's a **static** call-graph — great for synchronous, lexically-visible calls; blind to some
dynamic/framework wiring. Use it as a fast pre-scan a human/Opus verifies, not a blind source of
truth. graphmux is honest about this — `gmux drift` exists precisely to grep the zones below.

- **CodeGraph silently caps `callers`/`node` at `--limit 20`.** The first-class `gmux callers`/`gmux node`
  verbs inject `--limit 1000` for you; only raw `gmux -- callers …` and the delegate MCP tool still cap —
  there pass `--limit`, or use **`impact`** (no cap, transitive, more complete).
- **"No callers" ≠ dead code** — queue workers, framework entry points, event handlers and registry-lazy
  imports look call-less. Check for a framework entry before deleting.
- **`gmux orphans` = candidates, not proof** — it drops framework entry points by heuristic, but
  member-access (`obj.method`), same-file JSX and dynamic dispatch still hide real callers. Treat the
  list as a pre-scan; verify (e.g. `gmux node <sym>`) before deleting. `--all` shows the unfiltered set.
- **Ripgrep (or `gmux drift`), don't trust the graph, for:** CommonJS `exports.X = () => {}` handlers,
  ORM calls (`prisma.<model>.…`), queue enqueue↔worker pairs, middleware chains (`app.use(...spread)`).
- **Generic/same-named symbols collide** — run `gmux -- node <sym>` first to see the definition count.
- **`explore`** is good for English-named static code; weak on non-English domain terms + dynamic `require()`.

## Notes

- **State:** the binary is cached under `~/.brainmux/graphmux/<version>/`; the MCP config is written
  to `~/.brainmux/generated/graphmux-mcp.json` (server name `graphmux` → `mcp__graphmux__codegraph_*`).
- **Project index:** `gmux index` writes `.codegraph/` in your repo — add it to `.gitignore`.
- **Freshness:** the CLI does **not** watch files — after edits it's stale until `gmux sync` (or
  `gmux index`). `gmux orphans` auto-syncs first; other verbs read the index as-is. For hands-off
  freshness, `gmux hook install` wires a git hook so the index self-updates on git events.
- **Updates are deliberate:** the CodeGraph version + SHA are pinned in `src/core/codegraph.ts`; bump
  them together when we choose. No auto-upgrade, no fork.

---

<p align="center">
  <img src="../../brand/brainmux.svg" width="26" height="26" alt="brainmux" /><br />
  <sub>Part of <a href="https://brainmux.com"><strong>brainmux</strong></a> — LLM tooling for Claude Code.
  Engine: <a href="https://github.com/colbymchenry/codegraph">CodeGraph</a> (MIT) · License: MIT</sub>
</p>

# graphmux — Codebase Memory Plugin — Design

**Date:** 2026-09-02
**Status:** Approved (direction + core validated) — pending spec review → implementation plan
**Supersedes:** `2026-09-02-codebase-memory-cognee-design.md` (Cognee direction dropped — see §1).
**Depends on:** llmproxy on `main` (delegate, generate/paths patterns, esbuild bundle); brainmux monorepo + marketplace.

## 0. One-paragraph summary

`graphmux` is the **second brainmux plugin** (`@brainmux/graphmux`, command `gmux`), living in the monorepo at `plugins/graphmux/`. It gives coding agents — and specifically `bmux delegate` — a **deterministic, local, code-specialized memory layer** so a cheap brain grounds on the real call-graph instead of hallucinating. Per the brainmux **#1 principle** (vendor a mature core, thin-wrap it, pin + controlled-update, no fork), graphmux vendors **CodeGraph** (MIT, colbymchenry) as the core engine and ships only a thin `gmux` wrapper (install/index/status/wire-mcp, telemetry forced off) plus a zero-coupling integration point for `bmux delegate --memory`.

## 1. Why CodeGraph, why not Cognee (validated)

The earlier Cognee plan was dropped after research + a live trial:
- **2026 consensus + academic evidence:** for CODE, deterministic AST/tree-sitter graphs beat LLM-extracted knowledge graphs (arXiv 2601.08773: LLM-mediated extraction is stochastic + schema-noncompliant). Cognee's `codify` is LLM-extraction and its benchmarks are HotPotQA (Wikipedia), not code.
- **Cognee = heavy** (Python + graph DB + vector store + embeddings + LLM calls). Violates the "small contained core" spirit.
- **CodeGraph validated live (2026-09-02) on our own source** — see §7 for the trial. Accurate, deterministic (grep-cross-checked), 180 ms to index 19 files, zero external deps, telemetry cleanly disabled.

Runner-up backends (Serena LSP, codebase-memory-mcp) are documented as future swap options behind the same wrapper contract (§6.4); v1 ships CodeGraph.

## 2. The core — CodeGraph (vendored, not written by us)

Facts established by the trial (`v1.6.0`, linux-x64):
- **Self-contained artifact:** one directory (`bin/codegraph` + a bundled `node`); per-platform release tarball (~62 MB) with a published `SHA256SUMS`. No system deps.
- **Engine:** tree-sitter → SQLite (`node:sqlite`, WAL) in `.codegraph/codegraph.db` inside the project. **No external DB, no embeddings, no network** to index.
- **CLI:** `init`/`index`/`sync`/`status`/`query`/`explore`/`context`/`node`/`files`/`callers`/`callees`/`impact`/`affected`/`install`/`uninstall`/`daemon`/`telemetry`/`upgrade`.
- **MCP tools:** `codegraph_explore` (default; NL query → relevant symbols + call paths + blast-radius + **verbatim on-disk source** with a "do not re-Read" instruction), `codegraph_node`, `codegraph_search`, `codegraph_callers`, `codegraph_callees`, `codegraph_impact`, `codegraph_files`, `codegraph_status`.
- **`codegraph install`** self-wires the MCP into agents (Claude Code, Cursor, Codex, …).
- **Freshness:** native OS file-watcher daemon, debounced auto-sync, ⚠️ staleness banner on responses referencing a pending file.
- **Telemetry:** off via `DO_NOT_TRACK=1` / `CODEGRAPH_TELEMETRY=0`; background update check off via `CODEGRAPH_NO_UPDATE_CHECK=1`. "Off means off" (no connection, no opt-out ping) — verified in TELEMETRY.md + the auditable `telemetry-worker/`.
- **License:** MIT; source (Rust kernel + TS) in-repo → forkable later if ever needed.

## 3. Vendoring form — pinned binary (house-style, honest reconciliation)

The #1 principle's intent = **vendor the core, pin it, mirror it, controlled updates, thin wrapper, no fork.** LiteLLM meets that as a *container* because it is a heavy Python service. **CodeGraph is already a self-contained single-dir binary**, and it is a *per-project filesystem tool* that (a) must read the working repo and write `.codegraph/` there, and (b) is designed to serve MCP over **stdio** as an agent-launched subprocess.

Therefore the correct isolation unit here is the **pinned binary**, not a container:
- The binary *is* the reproducible artifact — a container around it adds no reproducibility and breaks the simple stdio/per-project model (per-workdir bind-mounts + forcing HTTP transport).
- We still get every property the principle wants: **pin** (exact version + SHA256), **mirror** (copy release assets to our own `brainmuxhq/brainmux-plugins` releases for upstream-death insurance), **controlled update** (bump the pinned version when *we* choose), **thin wrapper** (`gmux`), **no fork**.

> **Decision needing sign-off:** container vs pinned-binary. Recommendation: **pinned-binary** (rationale above). If uniform-container is preferred for ops symmetry, note the cost: per-workdir mount management + HTTP-transport wiring + no reproducibility gain. Container remains possible; not recommended for this tool.

Pin constants live in `plugins/graphmux/src/core/codegraph.ts` beside the download logic:
```ts
export const CODEGRAPH_VERSION = "1.6.0";
export const CODEGRAPH_SHA256 = { "linux-x64": "de3391f79ed42622d937e6cd5b7642a7ea8bb7d1473607e80b879ba73ef216b0", /* darwin-arm64, darwin-x64, linux-arm64, win32-x64, win32-arm64 … */ };
// primary: our mirror (brainmuxhq/brainmux-plugins releases); fallback: upstream colbymchenry/codegraph
```

## 4. The wrapper — `gmux` (thin control layer, our code)

Mirrors llmproxy layout + discipline. `gmux` never reimplements code intelligence; it manages the vendored binary and enforces our defaults.

- `gmux install` — resolve platform → download the pinned release asset (our mirror, fallback upstream) → **verify SHA256** → cache under `~/.brainmux/graphmux/<version>/` (install-shim pattern; version-agnostic launcher). Then wire the MCP (§5). **Always exports `DO_NOT_TRACK=1` + `CODEGRAPH_TELEMETRY=0` + `CODEGRAPH_NO_UPDATE_CHECK=1`** → telemetry off by default (brainmux local-first ethos); a `--telemetry` opt-in flips it on.
- `gmux index [path]` — wrap `codegraph init/index` (telemetry-off env).
- `gmux status [path]` — wrap `codegraph status`.
- `gmux sync [path]` / `gmux daemon` — wrap freshness controls.
- `gmux upgrade` — bump to a new pinned version *we* choose (re-verify SHA); never auto-upgrades.
- `.codegraph/` lands in the user's project → README documents it + suggests a `.gitignore` line.

State/paths: `~/.brainmux/graphmux/` (binary cache) — consistent with BRAINMUX_HOME. No project code lives outside the monorepo.

## 5. Integration with `bmux delegate` — zero hard coupling

graphmux and llmproxy stay independent; they meet only at a documented MCP contract.

- graphmux writes a known MCP config (server name **`codegraph`**) — either via `codegraph install` into the Claude Code config, or a brainmux-owned `~/.brainmux/generated/graphmux-mcp.json`.
- llmproxy gains `bmux delegate --memory`: injects that MCP config into the delegate's `claude -p` (reusing the existing `--mcp-config` / `--allow-tools` plumbing) and allows `mcp__codegraph__explore mcp__codegraph__callers mcp__codegraph__callees mcp__codegraph__impact mcp__codegraph__node`. The delegate prompt instructs: query the graph before acting (grounding, like `--verify` forces tool use).
- **Contract = the MCP name + config path only.** No code import between plugins; each works standalone (graphmux benefits any Claude Code user; llmproxy delegate benefits when graphmux is present). If graphmux isn't installed, `--memory` prints a clear "install graphmux" message (no silent failure).

## 6. Architecture & layering

- **Monorepo:** `plugins/graphmux/` beside `plugins/llmproxy/`; add a `graphmux` entry to `.claude-plugin/marketplace.json` (bump only the plugin entry version, not the top-level marketplace version).
- **Clean-arch (one direction `cli → commands → core`), mirroring llmproxy:**
  - `core/codegraph.ts` — pin constants, platform resolution, download + **SHA256 verify** (pure where possible), telemetry-off env assembly, path/cache resolution.
  - `core/mcp.ts` — pure builder for the `codegraph` MCP config object (golden-testable).
  - `commands/{install,index,status,upgrade}.ts` — IO orchestration; meaningful errors + exit codes (no silent catch).
  - `cli.ts` — dispatch + HELP.
  - `bin/gmux` + esbuild self-contained bundle `dist/gmux.js` (zero runtime deps; the CodeGraph binary is downloaded+verified, never bundled).
- **Skills (light, no bloat):** a `graphmux` skill (setup: install → index → wire) + a one-paragraph addition to llmproxy's `delegate` skill on when to use `--memory`. No heavyweight new skill.
- **README (same-commit rule):** `plugins/graphmux/README.md` created with the command list + examples; every new flag updates it in the same commit.
- **Backend abstraction (future, not v1):** the wrapper contract (MCP name + a small set of grounding tools) is backend-agnostic, so Serena/codebase-memory-mcp could be swapped behind it later without changing llmproxy. v1 hardwires CodeGraph; do not over-abstract now.

## 7. Validation already done (trial, 2026-09-02)

On `plugins/llmproxy/src` copied into an isolated dir (real repo untouched, no `.codegraph` pollution):
- Install: official `v1.6.0` release, **SHA256 verified** (`de3391f7…`), telemetry-off honored.
- Index: 19 TS files → 199 nodes / 499 edges in **180 ms**, 0.71 MB SQLite, no network/DB/embeddings.
- `callers aggregateSpend` → `runSpend` (spend.ts:7); `callees` → `toNum` + `BrainSpend`; `impact toNum` → transitive toNum→aggregateSpend→runSpend. **All correct, grep-cross-checked, deterministic** — and it returns the *enclosing function*, which grep cannot.
- `explore "delegate stream progress rendering"` (no symbol name) → 23 relevant symbols + blast-radius + **verbatim source + "do not re-Read"** → grounding + token/tool-call savings demonstrated.

This is the acceptance bar; the implementation's smoke test reproduces it.

## 8. Testing (test-first)

- **Unit (no network):** `core/mcp.ts` config builder golden; platform→asset-name resolution; SHA-verify accept/reject logic (fixture); version-pin resolution + mirror/fallback ordering; telemetry-off env assembly.
- **Integration smoke (network/binary-gated):** `gmux install` downloads+verifies the pinned binary; `gmux index` on our own repo; `mcp__codegraph__*` reachable; reproduces §7 numbers.
- **Delegate grounding gate:** `bmux delegate <brain> --memory "list every caller of <known symbol>"` returns the *actual* callers (cross-checked vs `codegraph callers` / ripgrep) — grounds, does not fabricate.

## 9. Non-goals (YAGNI)

- Reimplementing any code-intelligence (we vendor CodeGraph).
- Forking CodeGraph (pin + wrapper; fork only if a real customization need appears, MIT permits).
- Containerizing the engine (pinned binary is the isolation unit; revisit only if §3 sign-off flips).
- Multi-backend abstraction now (Serena/codebase-memory-mcp deferred behind the wrapper contract).
- Auto-indexing arbitrary repos without user action; enabling telemetry by default.

## 10. Rollout

1. Sign off §3 (pinned-binary vs container). 2. Mirror pinned `v1.6.0` assets → our releases; record SHAs. 3. `plugins/graphmux/` skeleton (core/commands/cli/bin + bundle) + golden unit tests. 4. `gmux install/index/status/upgrade`. 5. Smoke on our own repo (§7 gate). 6. `bmux delegate --memory` wiring in llmproxy + grounding gate. 7. Skills + READMEs (same commit). 8. marketplace.json entry; version. 9. Make any mirrored artifacts public.

## 11. References

- Trial results: this session (2026-09-02).
- CodeGraph: https://github.com/colbymchenry/codegraph (MIT) · telemetry: repo `TELEMETRY.md` + `telemetry-worker/`.
- Evidence AST>LLM-graph for code: arXiv 2601.08773.
- House-style principle: `CLAUDE.md` §"EN BÜYÜK İLKE" + memory `vendoring-house-style`.
- Precedent: `docs/specs/2026-09-02-openrouter-model-picker-design.md`, llmproxy `core/generate.ts` + `commands/shim.ts` (install-shim pattern).

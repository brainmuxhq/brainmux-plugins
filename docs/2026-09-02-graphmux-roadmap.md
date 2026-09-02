# graphmux — dogfood findings + roadmap

**Date:** 2026-09-02 · **Source:** riskmatik dogfood (5 parallel agents, every finding cross-checked
with real `gmux` output + ripgrep ground-truth). Index: CodeGraph v1.6.0 · 2,409 files · 26,145 nodes ·
63,101 edges · 2.1 s.

## Verdict
graphmux is **deterministic, fast, offline** and production-grade for **synchronous / lexically-visible**
code (`impact` especially). It's a **static** call-graph, so it's blind to some dynamic/framework wiring,
and it has one silent under-count trap. Use it as a fast pre-scan a human/Opus verifies.

Accuracy measured: FE TS/TSX ~97% (real miss 0 once `--limit` raised; JSX/hooks/types all captured) ·
BE JS `const`/`function`/class-method ~98–100% · BE JS `exports.X = async()=>{}` ~0% (invisible) ·
`impact` transitive + more complete than `callers` · `explore` mixed (weak on non-English domain + dynamic require).

## House-style split (per CLAUDE.md #1 principle)
We thin-wrap CodeGraph; we do **not** rewrite the engine. So:

### DONE — in our wrapper (shipped, graphmux 0.1.4)
Encoded the hard-won usage discipline where the agent actually reads it — **no core change**:
- graphmux **skill** + **README**: "Limits — how to trust it" (silent cap → always `--limit 500`;
  blast-radius → `impact`; "no callers ≠ dead code"; ripgrep zones = `exports.X` / Prisma / pg-boss /
  middleware; generic-name collision → `node` first; `explore` non-English/dynamic caveat).
- llmproxy **delegate skill** `--memory`: command by exact tool name (`codegraph_impact <sym>`, verbatim),
  not a loose "list callers" (cheap brain otherwise picks fuzzy `explore` + fabricates).

This banks ~all the practical *safety* of the findings without touching the core.

### NOT OURS — CodeGraph core (upstream-candidate; we do NOT build — file/track only)
Building these = becoming CodeGraph maintainers (violates #1 principle). File upstream; fork only if
upstream goes dead **and** a finding is critical and unfixed.

| Pri | Finding | Upstream ask |
|---|---|---|
| P0-A | `callers`/`node` silently cap at `--limit 20` (no "…N more"; JSON/MCP inherit) | trivial: emit "…N more (use --limit)" or raise default |
| P1-C | `exports.X = async()=>{}` (CommonJS) handlers not indexed → 67+ route handlers invisible | tree-sitter query for `exports.X = arrow/async` as a node |
| P1-A | queue enqueue↔worker edge broken (`boss.send(Q)` ↔ `queue.work(Q,h)`); `app.use(...spread)` middleware; Next.js entry points | framework/queue-aware edges (CodeGraph already does 17 frameworks) |
| P1-B | ORM off-graph (`prisma.<model>.op`) → no schema→code blast-radius | Prisma-schema-aware model nodes |
| P0-B | name-collision merges same-named symbols (`deleteUser` app↔supabase, `create`×11) | type-aware resolution pass, conservative gate (unknown > mis-wired) |
| P2 | no diff/PR mode; single-shot index staleness | `git diff` → impact traversal; incremental file-watch re-parse |
| — | `explore` relevance fails on non-English domain terms (kota→apply mis-match) | multilingual symbol-token relevance |

### Ready-to-file upstream issue drafts
**Issue 1 (P0-A, quick win):** "`callers`/`node` silently truncate at default `--limit 20` with no
indication." Repro: a high-fan-in symbol → `callers X` returns 20; `callers X --limit 500` returns 174;
header says "20" but never "…154 more". `impact`/`node` (`+N more`) don't have this. Ask: print a
"…N more (raise --limit)" hint, or don't cap silently. High blast-radius: consumers under-count and
trust it.

**Issue 2 (P1-C):** "CommonJS `exports.X = async () => {}` route handlers are not indexed as symbols."
`node getKazaList` → "Symbol not found" though it's the real handler wired at `kazaRoutes.js:96`. Affects
Express apps using the `exports.X = arrow` controller style. Ask: index that assignment form as a node.

**Filed upstream (2026-09-02):**
- Issue 1 → [colbymchenry/codegraph#1674](https://github.com/colbymchenry/codegraph/issues/1674)
- Issue 2 → [colbymchenry/codegraph#1675](https://github.com/colbymchenry/codegraph/issues/1675)

## Non-goal
Vector/embedding search — graphmux's embedding-free determinism is its edge (2026 consensus: structural
retrieval > vector-RAG for code). Deepen accuracy (type) + freshness (incremental) + diff-awareness instead.

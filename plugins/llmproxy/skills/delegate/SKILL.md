---
name: delegate
description: Use when heavy, low-judgment grunt work is about to run on this expensive Opus session and would burn Anthropic subscription quota — bulk implementation from a spec, drift/pattern detection sweeps across many files, mechanical refactors, or research/summary passes. Also when the user says delegate, offload, "use the cheap model", or "save my quota".
---

# delegate — offload grunt work to cheap OpenRouter brains

## Overview
`bmux delegate` (the brainmux/llmproxy CLI) hands a bounded task to a cheap OpenRouter
"brain" via a headless `claude -p`, and returns its final text. **Those brains run on a
separate pay-as-you-go meter — they do NOT consume the Anthropic subscription quota at
all.** So the split is: this Opus session stays the orchestrator (architecture, review,
final fix); the bulk/detection half runs on a cheap brain; then Opus consolidates.

**The Task/Agent tool cannot reach these brains** — subagents inherit this session's brain
(Opus). To reach a cheap brain you MUST shell out to `bmux delegate` via Bash.

## When to delegate vs keep on Opus

| Delegate to cheap brain | Keep on Opus |
|---|---|
| Bulk implementation from a crisp spec | Architecture, interface/contract design |
| Drift / pattern / smell detection across many files | Consolidating findings, deciding the fix |
| Mechanical refactor (rename, format, var→const) | Reviewing delegated output (never rubber-stamp) |
| Summarize / extract from long text | Any hard reasoning or subtle correctness call |

## Two core workflows

**New project:** Opus designs skeleton + contracts → `bmux delegate coder --write` implements
each unit against the spec → Opus reviews the diff and fixes.

**Drift research (existing code):** `bmux delegate coder` (read-only) detects likely spots and
returns a `file:line` list → Opus verifies each, consolidates, and fixes the real ones.

## Quick reference

```sh
bmux delegate <brain> [options] "<task>"
printf '%s' "<long task>" | bmux delegate <brain> [options] -
```

Brains: `chat` (cheap summary) · `deep` (hard analysis) · `coder` (coding). The available
brains come from `brains.yaml` — run `bmux config list` to see them.

Modes: default = **analyze** (READ-ONLY: Read/Grep/Glob, no edits/shell — safe for
detection sweeps) · `--write` (lets it EDIT files, shell still blocked) · `--yolo`
(no permission checks — risky, only in a throwaway dir/worktree).

Options: `-C <dir>` run in a subdir/worktree · `--json` stable envelope
`{brain, ok, result, input_tokens, output_tokens, num_turns, duration_ms, cost_usd_estimate}` ·
`--stream` (aka `-v`) show a live progress indicator · `--mcp` (alias `--with-mcp`) give the
worker the host's MCP servers (off by default).

Every call echoes its config to stderr so you know what went out:
`delegate: coder · analyze · mcp off`.

## MCP servers (`--mcp`, default OFF) + `--allow-tools`
A delegated worker does NOT get the host's MCP servers unless you pass `--mcp`. This is
deliberate: loading them (Vercel/GSC/Chrome/render/…) adds ~35k+ input tokens per call and
a grunt task never uses them — measured 30 tools / ~33k tokens without vs 147 tools / ~69k
with. Keep the default for bulk/detection/refactor work. Add `--mcp` only when the task
genuinely needs one (e.g. `context7` for live docs, `brave` for web search) — then it pays
the token cost just for that call.

**`--mcp` alone is not enough headless.** In analyze/write mode the worker still needs
*permission* to call a tool, and a headless `claude -p` can't answer a permission prompt —
so `--mcp` loads brave but the search is blocked. Use `--allow-tools <csv>` to pre-allow the
exact tools so it runs without a prompt (and without `--yolo`, which opens everything):

```sh
bmux delegate dsflash --allow-tools mcp__brave-search__brave_web_search "verify: is X still in force? cite the source"
```
An `mcp__…` name in `--allow-tools` implies `--mcp` (the server must load to be callable).
`--allow-tools` also works for built-ins (e.g. `--allow-tools Bash` to let an analyze worker
run a command). Prefer this narrow grant over `--yolo` for grounded/web tasks.

## Grounding — cheap brains invent facts
A cheap brain with **no web access confidently fabricates** factual claims (regulation names,
"X was repealed", library APIs). It is strong on *bounded, calibrated* work (one-file audit,
clear spec) but must NOT be trusted as a fact-checker. For anything factual: either verify it
yourself, or ground the worker with `--mcp --allow-tools mcp__brave-search__brave_web_search`
and tell it to cite sources. Treat every unsourced factual claim as unverified.

**Availability ≠ use.** Even with the tool allowed, a cheap model often skips it and answers
from memory anyway (then invents a plausible-looking source URL — observed live). So in the
task itself, *force* the tool: e.g. "You MUST call `brave_web_search` before answering. Do NOT
answer from memory. Quote the exact text and the real URL you fetched." A URL in the answer is
NOT proof it searched — cross-check that a tool call actually happened (`--stream` shows `🔧
brave_web_search`; an empty `↳` summary means it never called a tool).

## Concurrency — sequential for quality
Under heavy concurrency (many parallel `bmux delegate` on one brain) the model degrades and
rate-limits — garbled/typo output. Run delegates **sequentially or at low concurrency** when
output quality matters; reserve fan-out for cheap, independent detection passes you'll verify anyway.

## Progress indicator (`--stream`) — for a human at a terminal
Add `--stream` (aka `-v`) for a single, self-rewriting progress line while the worker runs:

```
⏳ coder · 5/34 · Wiring the parser      ← updates in place
✅ done coder · 34/34 · 41.2s            ← replaces it when finished
   ↳ 6 files: a.ts, b.ts, c.ts · 3 edits ← what it actually touched
```

`X/Y` is real completed/total when the worker keeps a todo list (TodoWrite, i.e. `--write`
tasks); read-only sweeps show a `step N` counter instead. The closing `↳` line summarizes
**what it touched** (files read/edited + edit count) — a compact "what did it do" without the
full transcript. It costs **no extra tokens** (parsed from the event stream, just a
serialization change) and writes **no files**; stdout still carries only the clean final
answer. **The live line renders only on a real TTY** — it is suppressed for a piped/tool
consumer by design (a `\r` line is meaningless to a machine). So `--stream` is for a human
watching their own terminal; an orchestrator gets nothing live from it (see below).

## Reporting to the user (orchestrator discipline)
When you (an orchestrating agent) run a delegate via Bash, the worker's output is buffered
and returned to *you* at completion — the user's terminal is not your subprocess's TTY, so
`--stream` can't reach them live. This matches idiomatic Claude Code delegation: a subagent
**returns a summary at the end**, it does not stream progress to the parent. So:

- **After every delegate, report a one-line status to the user unprompted** — which brain,
  the task, and the result/outcome (e.g. "coder scanned src/ → 3 TODOs, listed below").
  Don't make them ask what happened.
- **Don't** try to give live progress by writing a log file or polling — that burns tokens
  and/or leaves artifacts for no real gain. Final-summary-at-completion is the norm.
- If you need the worker's cost/session metadata, use `--json` and read `result` +
  `total_cost_usd`. Real per-brain spend is `bmux spend`.
- If the **user** wants to watch a long run live, they run `bmux delegate … --stream` in
  their **own** terminal.

## Consolidation discipline (required)
Cheap brains are less reliable than Opus. After a delegate call, Opus **verifies** the
output against the real files — treat it as a claim to check, not a fact. Do not merge or
report delegated results as done without reading the actual diff/lines. (Detection sweeps
especially over-report: confirm each hit.)

## Common mistakes
- **Vague spec → wandering brain.** Give `--write` a tight, unambiguous scope or it drifts.
- **Parallel writes to the same files.** Point each `--write` delegate at its own `-C`
  worktree/subdir, or they race and lose edits.
- **Delegating the judgment.** Delegate the volume, not the decision. The fix/merge is Opus's.
- **Reaching for the Agent tool.** That stays on Opus. Only `bmux delegate` hits cheap brains.
- **Nesting.** A delegated worker cannot delegate again (guarded via `DELEGATE_DEPTH`).

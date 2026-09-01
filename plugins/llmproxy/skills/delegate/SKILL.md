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

Options: `-C <dir>` run in a subdir/worktree · `--json` machine-readable output ·
`--stream` (aka `-v`) show a live progress indicator · `--mcp` give the worker the
host's MCP servers (off by default).

Every call echoes its config to stderr so you know what went out:
`delegate: coder · analyze · mcp off`.

## MCP servers (`--mcp`, default OFF)
A delegated worker does NOT get the host's MCP servers unless you pass `--mcp`. This is
deliberate: loading them (Vercel/GSC/Chrome/render/…) adds ~35k+ input tokens per call and
a grunt task never uses them — measured 30 tools / ~33k tokens without vs 147 tools / ~69k
with. Keep the default for bulk/detection/refactor work. Add `--mcp` only when the task
genuinely needs one (e.g. `context7` for live docs, `brave` for web search) — then it pays
the token cost just for that call.

## Progress indicator (`--stream`)
By default a delegate call is silent until it prints the final answer. Add `--stream` for
a single, self-rewriting progress line on stderr while it runs — no full transcript:

```
⏳ coder · 5/34 · Wiring the parser      ← updates in place
✅ done coder · 34/34 · 41.2s            ← replaces it when finished
```

`X/Y` is real completed/total when the worker keeps a todo list (TodoWrite, i.e. `--write`
tasks); read-only sweeps show a `step N` counter instead. stdout still carries only the
clean final answer, so `--stream` is safe to pipe/consume. `--stream` costs **no extra
tokens** — it only changes how the worker's output is serialized, not the work it does.
Real per-brain spend is `bmux spend`.

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

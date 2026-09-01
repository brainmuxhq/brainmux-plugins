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

Options: `-C <dir>` run in a subdir/worktree · `--json` machine-readable output.

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

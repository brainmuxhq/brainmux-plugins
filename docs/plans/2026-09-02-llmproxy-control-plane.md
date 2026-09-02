# llmproxy Control Plane Implementation Plan (Plan 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `@brainmux/llmproxy` a cleanly installable Claude Code plugin — ship the built CLI, add the `delegate` + `brainmux` skills and a `/brainmux` slash command, and retire the superseded `claude-proxy` prototype.

**Architecture:** The core migration already built the `bmux` CLI (TypeScript → `dist/src/cli.js`, invoked by `bin/bmux`). This plan adds the control surface around it: commit `dist/` (guarded against drift) so a marketplace-from-git install runs with no build step; move the prototype `delegate` skill into the plugin and add a `brainmux` management skill; add one thin `/brainmux` slash command; then delete the prototype and its residue.

**Tech Stack:** Claude Code plugin (skills = Markdown with YAML frontmatter, commands = Markdown), Node/TypeScript CLI (already built), git.

## Global Constraints

- **Best-practice, maintainable, NO patchwork (Ali's overriding criterion):** one source of truth per concern; no parallel/duplicated layers; `dist/` is generated from `src/` and never hand-edited.
- **Single CLI invocation path:** skills and commands call `${CLAUDE_PLUGIN_ROOT}/bin/bmux …`. Never a second hardcoded path.
- **`src/` is the source of truth; `dist/` is generated.** Committed `dist/` must always match a fresh `npm run build` (enforced by `dist-check`).
- **delegate skill is MOVED, not copied** — exactly one copy exists after this plan (`~/.claude/skills/delegate` is deleted).
- **Node ≥18, ESM, NodeNext.** The 38 existing unit tests + the live smoke stay green — this plan changes none of `src/`'s behavior.
- **Cleanup is gated on verification passing** (Task 5 green before Task 6 deletes anything).
- **Commit after every task**, Conventional Commits.

## File Structure

All paths under repo root `~/Development/Projects/brainmux/`.

| File | Responsibility |
|---|---|
| `.gitignore` | Stop ignoring `plugins/llmproxy/dist/`. |
| `plugins/llmproxy/package.json` | Add `prepare` + `dist-check` scripts. |
| `plugins/llmproxy/dist/**` | Committed build output (generated from `src/`). |
| `plugins/llmproxy/skills/delegate/SKILL.md` | Delegation skill (moved from `~/.claude/skills/delegate`, updated to `bmux delegate`). |
| `plugins/llmproxy/skills/brainmux/SKILL.md` | New skill: teach Claude to manage brains via `bmux` + point to LiteLLM UI. |
| `plugins/llmproxy/commands/brainmux.md` | Single `/brainmux <subcommand>` thin wrapper over the CLI. |
| `plugins/llmproxy/.claude-plugin/plugin.json` | Confirm/declare skills + commands per the plugin schema. |
| `CLAUDE.md` | Handoff updated; prototype/residue notes removed. |
| (external) `~/Development/Projects/claude-proxy/` | Deleted. |
| (external) `~/.claude/skills/delegate/` | Deleted (moved into plugin). |
| (external) `~/.config/fish/functions/claude-{chat,deep,coder}.fish` | Deleted (broken). |
| (external) `~/.claude/settings.json` | Stale `claude-proxy` allow rule removed. |

---

### Task 1: Ship the built CLI — commit `dist/`, guard against drift

**Files:**
- Modify: `.gitignore`
- Modify: `plugins/llmproxy/package.json`
- Create (commit): `plugins/llmproxy/dist/**`

**Interfaces:**
- Consumes: the existing build (`npm run build` → `dist/src/cli.js`, invoked by `bin/bmux`).
- Produces: a repo where `node plugins/llmproxy/bin/bmux --help` works from a fresh checkout with no build step; `npm run dist-check` verifies `dist/` is fresh.

- [ ] **Step 1: Find and remove the `dist` ignore.**

Run: `cd ~/Development/Projects/brainmux && grep -rn 'dist' .gitignore plugins/llmproxy/.gitignore 2>/dev/null`
Then edit whichever `.gitignore` ignores it so `plugins/llmproxy/dist/` is NO longer ignored. If the root `.gitignore` has a blanket `dist/`, replace that line with a negation for the plugin, e.g. keep `dist/` but add `!plugins/llmproxy/dist/` and `!plugins/llmproxy/dist/**`. Verify:

Run: `git check-ignore plugins/llmproxy/dist/src/cli.js; echo "ignored=$?"`
Expected: `ignored=1` (NOT ignored). If it prints the path with `ignored=0`, the ignore rule still matches — fix it.

- [ ] **Step 2: Add `prepare` + `dist-check` scripts.** Edit `plugins/llmproxy/package.json` `scripts` to:

```json
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "prepare": "npm run build",
    "dist-check": "npm run build && git diff --exit-code -- dist",
    "test": "npm run build && node --test \"dist/test/**/*.test.js\""
  },
```

- [ ] **Step 3: Build fresh and stage `dist/`.**

```bash
cd ~/Development/Projects/brainmux/plugins/llmproxy && npm run build
cd ~/Development/Projects/brainmux && git add plugins/llmproxy/dist plugins/llmproxy/package.json .gitignore
```
Note: commit only `dist/src/` and `dist/test/` compiled output. Confirm no stray files:

Run: `git status --short plugins/llmproxy/dist | head`
Expected: added `.js` (and `.d.ts`) files under `dist/src/` and `dist/test/`.

- [ ] **Step 4: Verify `dist-check` passes (dist matches src).**

Run: `cd ~/Development/Projects/brainmux/plugins/llmproxy && npm run dist-check; echo "exit=$?"`
Expected: `exit=0` (build produced no diff vs staged `dist/`).

- [ ] **Step 5: Verify a no-build run works (simulates fresh install).**

Run: `cd /tmp && node ~/Development/Projects/brainmux/plugins/llmproxy/bin/bmux --help; echo "exit=$?"`
Expected: prints the help block, `exit=0`.

- [ ] **Step 6: Commit.**

```bash
cd ~/Development/Projects/brainmux
git commit -m "build(llmproxy): ship compiled dist/, guard freshness with dist-check"
```

---

### Task 2: Move the `delegate` skill into the plugin

**Files:**
- Create: `plugins/llmproxy/skills/delegate/SKILL.md`
- Delete: `~/.claude/skills/delegate/SKILL.md` (and the now-empty dir)

**Interfaces:**
- Consumes: the `bmux delegate <brain> [--write|--yolo] [-C dir] [--json] "<task>"` CLI subcommand (built in the core migration).
- Produces: exactly one delegate skill, inside the plugin, invoking `bmux delegate`.

- [ ] **Step 1: Create the plugin skill.** Write `plugins/llmproxy/skills/delegate/SKILL.md`:

```markdown
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
returns `file:line` list → Opus verifies each, consolidates, and fixes the real ones.

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
```

- [ ] **Step 2: Delete the old copy** (so only one exists):

```bash
rm -rf ~/.claude/skills/delegate
```

- [ ] **Step 3: Verify one copy + correct invocation.**

Run: `ls ~/.claude/skills/delegate 2>&1; grep -c 'bmux delegate' ~/Development/Projects/brainmux/plugins/llmproxy/skills/delegate/SKILL.md; grep -c 'bin/delegate' ~/Development/Projects/brainmux/plugins/llmproxy/skills/delegate/SKILL.md`
Expected: old dir "No such file or directory"; `bmux delegate` count ≥ 3; `bin/delegate` count = 0.

- [ ] **Step 4: Commit.**

```bash
cd ~/Development/Projects/brainmux
git add plugins/llmproxy/skills/delegate/SKILL.md
git commit -m "feat(llmproxy): move delegate skill into plugin, target bmux delegate"
```

---

### Task 3: Add the `brainmux` management skill

**Files:**
- Create: `plugins/llmproxy/skills/brainmux/SKILL.md`

**Interfaces:**
- Consumes: the `bmux` CLI surface (`init | up | down | restart | ps | logs | health | test | config …`) and per-brain LiteLLM UI at `http://127.0.0.1:<port>/ui`.
- Produces: a skill that makes Claude drive brain lifecycle/config via `${CLAUDE_PLUGIN_ROOT}/bin/bmux` and hand spend/logs to the LiteLLM UI.

- [ ] **Step 1: Create the skill.** Write `plugins/llmproxy/skills/brainmux/SKILL.md`:

```markdown
---
name: brainmux
description: Use to manage llmproxy "brains" — add/remove a brain, switch a brain's model, add a provider API key, start/stop/check the proxy stack, or answer "how much have I spent". Triggers on brain/model/key/stack/spend management for the bmux/brainmux/LiteLLM proxy setup.
---

# brainmux — manage the proxy brains via `bmux`

## What this is
`brainmux`/`llmproxy` runs cheap LLM "brains" as local LiteLLM proxies (one Docker
container per brain, isolated by port), declared in a single `brains.yaml` SSOT. The
`bmux` CLI is the control plane. Always invoke it as `${CLAUDE_PLUGIN_ROOT}/bin/bmux …`.

## SSOT rule (do not break)
`brains.yaml` (in `~/.brainmux/`, or `$BRAINMUX_HOME`) is the single source of truth. Change
brains ONLY through `bmux config …`, which rewrites `brains.yaml` and regenerates the
compose/config/init under `generated/`. **Never hand-edit anything in `generated/`** — it is
overwritten on the next `bmux up`/`config` call.

## Lifecycle
```sh
bmux init                    # scaffold ~/.brainmux (brains.yaml, .env chmod 600, generated/)
bmux up | down | restart     # manage the stack (up/restart regenerate from brains.yaml first)
bmux ps | logs [brain]       # inspect
bmux health                  # liveliness per brain (UP/DOWN)
bmux test                    # POST /v1/messages to each brain (text or thinking = alive)
```

## Config (edits brains.yaml → regenerates)
```sh
bmux config list                                   # show brains (name, port, model, providerKey)
bmux config add-brain <name> <port> <model> [providerKey]   # default providerKey OPENROUTER_API_KEY
bmux config remove-brain <name>
bmux config set-model <name> <model>
bmux config add-key <ENV_VAR> <value>              # write a provider key to .env (never brains.yaml)
```
After `add-brain`/`set-model`/`remove-brain`, run `bmux up` (or `restart`) to apply. `bmux init`
auto-generates master keys + salt + Postgres password; the user supplies provider keys via
`add-key`.

## Spend / usage / logs → LiteLLM UI (don't rebuild it)
For spend, request logs, and parameter tuning, point the user at the **LiteLLM UI** for the
brain in question: `http://127.0.0.1:<port>/ui` (log in with that brain's master key from
`~/.brainmux/.env`). Do NOT build a custom dashboard — the LiteLLM UI already owns
observability. `bmux config list` shows each brain's port.

## Discipline
- Secrets (`.env`) are never committed and never printed back to the user.
- Cheap-brain *delegation* is a separate skill ([[delegate]]); this skill is about managing
  the brains themselves.
- Prefer one small change at a time: edit via `bmux config`, then `bmux up`, then `bmux health`.
```

- [ ] **Step 2: Verify the skill references the plugin-root CLI path and the LiteLLM UI.**

Run: `grep -c 'CLAUDE_PLUGIN_ROOT' ~/Development/Projects/brainmux/plugins/llmproxy/skills/brainmux/SKILL.md; grep -c '/ui' ~/Development/Projects/brainmux/plugins/llmproxy/skills/brainmux/SKILL.md`
Expected: both ≥ 1.

- [ ] **Step 3: Commit.**

```bash
cd ~/Development/Projects/brainmux
git add plugins/llmproxy/skills/brainmux/SKILL.md
git commit -m "feat(llmproxy): add brainmux skill for brain/stack/config management"
```

---

### Task 4: Add the `/brainmux` slash command (thin wrapper)

**Files:**
- Create: `plugins/llmproxy/commands/brainmux.md`

**Interfaces:**
- Consumes: `${CLAUDE_PLUGIN_ROOT}/bin/bmux`.
- Produces: `/brainmux <subcommand> [args]` that runs the CLI and reports output.

- [ ] **Step 1: Create the command.** Write `plugins/llmproxy/commands/brainmux.md`:

```markdown
---
description: Run the brainmux (bmux) CLI — manage brains and the proxy stack.
argument-hint: <subcommand> [args]   e.g. up | health | test | config list
---

Run the brainmux CLI for the user's request, using the plugin's bundled binary.

The user asked: `bmux $ARGUMENTS`

Do this:
1. Run `${CLAUDE_PLUGIN_ROOT}/bin/bmux $ARGUMENTS` with the Bash tool and report the result concisely.
2. **Exception — interactive brain launch:** if the subcommand is a bare brain name
   (`chat`, `deep`, `coder`, or any brain from `bmux config list`) with no further
   management verb, do NOT run it here — it execs an interactive Claude Code session.
   Instead tell the user to run `bmux <brain>` directly in their terminal.
3. If it fails with "brains.yaml not found", suggest `bmux init`. If a provider key is
   missing, suggest `bmux config add-key OPENROUTER_API_KEY <value>`.
```

- [ ] **Step 2: Verify.**

Run: `grep -c 'CLAUDE_PLUGIN_ROOT' ~/Development/Projects/brainmux/plugins/llmproxy/commands/brainmux.md; grep -c 'ARGUMENTS' ~/Development/Projects/brainmux/plugins/llmproxy/commands/brainmux.md`
Expected: both ≥ 1.

- [ ] **Step 3: Commit.**

```bash
cd ~/Development/Projects/brainmux
git add plugins/llmproxy/commands/brainmux.md
git commit -m "feat(llmproxy): add /brainmux slash command wrapping the CLI"
```

---

### Task 5: Confirm the plugin manifest + verify a real install

**Files:**
- Modify (if needed): `plugins/llmproxy/.claude-plugin/plugin.json`

**Interfaces:**
- Consumes: the skills (`skills/delegate`, `skills/brainmux`), the command (`commands/brainmux.md`), the shipped `dist/`.
- Produces: a plugin that loads both skills + the command when installed.

- [ ] **Step 1: Check whether the plugin schema needs explicit skill/command lists.** Read `plugins/llmproxy/.claude-plugin/plugin.json`. Claude Code discovers `skills/` and `commands/` by convention; only add explicit arrays if the install (Step 3) fails to surface them. If the current schema documents `skills`/`commands` keys, add them:

```json
  "skills": ["./skills/delegate", "./skills/brainmux"],
  "commands": ["./commands/brainmux.md"]
```
(Leave the file unchanged if convention-based discovery works in Step 3.)

- [ ] **Step 2: Fresh-clone no-build check.**

```bash
TMP="$(mktemp -d)"; git -C ~/Development/Projects/brainmux worktree add "$TMP/clone" HEAD
node "$TMP/clone/plugins/llmproxy/bin/bmux" --help; echo "exit=$?"
git -C ~/Development/Projects/brainmux worktree remove --force "$TMP/clone"; rm -rf "$TMP"
```
Expected: help printed, `exit=0` — proves the committed `dist/` runs with no build step from a clean checkout.

- [ ] **Step 3: Local install check (manual, requires a Claude Code session).** In Claude Code:
  `/plugin marketplace add ~/Development/Projects/brainmux` then `/plugin install llmproxy`.
  Confirm: the `delegate` and `brainmux` skills appear in the skills list, and `/brainmux health`
  runs the CLI (prints brain UP/DOWN or a "run bmux init" hint). If skills/command do NOT appear,
  add the explicit arrays from Step 1 to `plugin.json`, reinstall, and re-verify.

- [ ] **Step 4: Commit (only if plugin.json changed).**

```bash
cd ~/Development/Projects/brainmux
git add plugins/llmproxy/.claude-plugin/plugin.json
git commit -m "chore(llmproxy): declare skills + commands in plugin manifest"
```
(If no change was needed, skip the commit and note "manifest unchanged — discovery is convention-based" in the report.)

---

### Task 6: Retire the `claude-proxy` prototype + residue

> Gated on Task 5 green. Ali authorized removing the prototype folder ("işimiz bitince kaldıralım").

**Files:**
- Delete: `~/Development/Projects/claude-proxy/`
- Delete: `~/.config/fish/functions/claude-{chat,deep,coder}.fish`
- Modify: `~/.claude/settings.json`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Confirm the replacement is proven before deleting.** Re-run `cd ~/Development/Projects/brainmux/plugins/llmproxy && npm run dist-check && npm test` — expect `dist-check` exit 0 and 38/38 tests. Confirm Task 5's install check passed. Only then proceed.

- [ ] **Step 2: Remove the broken fish functions.**

Run: `rm -f ~/.config/fish/functions/claude-chat.fish ~/.config/fish/functions/claude-deep.fish ~/.config/fish/functions/claude-coder.fish`

- [ ] **Step 3: Remove the stale allow rule in `~/.claude/settings.json`.** Read it; find any entry referencing `claude-proxy/bin/delegate` (e.g. `Bash(.../claude-proxy/bin/delegate:*)`) and delete that entry. Delegation now runs via `bmux delegate`. Apply the minimal JSON edit; keep the file valid.

- [ ] **Step 4: Delete the prototype folder.**

Run: `rm -rf ~/Development/Projects/claude-proxy`
If this fails with permission denied on `data/postgres` (root-owned by the old container), remove that subtree via a throwaway root container first, then retry:
```bash
docker run --rm -v ~/Development/Projects/claude-proxy:/x alpine sh -c 'rm -rf /x/..?* /x/.[!.]* /x/*' && rmdir ~/Development/Projects/claude-proxy
```
If it still cannot be removed, ask Ali to run `sudo rm -rf ~/Development/Projects/claude-proxy` via `! sudo …`.
Verify: `ls ~/Development/Projects/claude-proxy 2>&1` → "No such file or directory".

- [ ] **Step 5: Update `CLAUDE.md` handoff.** Edit the "Durum & sıradaki adımlar" section: mark the core migration + control plane DONE (branch `feat/llmproxy-migration`, live-smoke green, skills+commands shipped); DELETE the "Çalışan prototip (kaynak, DOKUNMA ad)" block and the "Bilinen kalıntı (temizle)" block (both resolved); and remove the parenthetical in "Ne bu proje" that says the local `claude-proxy` folder stays. Leave Plan 3 (OpenRouter model-picker) as the next step.

- [ ] **Step 6: Commit.**

```bash
cd ~/Development/Projects/brainmux
git add CLAUDE.md
git commit -m "chore: retire claude-proxy prototype + residue, update handoff"
```

---

## Self-Review

**Spec coverage (2026-09-02 control-plane spec):** §2 distribution → Task 1 (commit dist + prepare + dist-check) + merge noted for after final review. §3 delegate skill move → Task 2 (move + delete old + bmux delegate). §4 brainmux skill → Task 3. §5 slash command → Task 4. §6 cleanup → Task 6. §7 manifest → Task 5. §8 testing → Task 1 (dist-check, no-build run), Task 5 (fresh-clone + install), Task 6 Step 1 (regression). §9 non-goals respected (no OpenRouter, no npm publish, no per-verb commands).

**Placeholder scan:** no TBD/TODO. Task 5's plugin.json edit is conditional-on-empirical-result (install check), not a placeholder — the concrete arrays to add are given. Task 1 Step 1's exact `.gitignore` line is discovered then edited with a shown negation pattern.

**Consistency:** the CLI is invoked as `${CLAUDE_PLUGIN_ROOT}/bin/bmux` in both skills and the command (Global Constraint). `bmux delegate` (not `bin/delegate`) used in the delegate skill. `dist-check` script name identical in Task 1 and Task 6. delegate skill deleted from `~/.claude` (Task 2) and verified single-copy — matches the "no parallel layer" constraint.

## Post-plan (after all tasks + final whole-branch review)
Merge `feat/llmproxy-migration` → `main` and push so `/plugin marketplace add brainmuxhq/brainmux-plugins` resolves. Then Plan 3: the OpenRouter model-picker + `openrouter.yaml` SSOT.

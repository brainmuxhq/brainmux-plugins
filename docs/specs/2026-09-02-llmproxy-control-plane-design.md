# llmproxy Control Plane — Design (Plan 2)

**Date:** 2026-09-02
**Status:** Approved (design) — pending spec review → implementation plan
**Depends on:** the core migration (brains.yaml→generator→`bmux` CLI, live-smoke green) is complete on branch `feat/llmproxy-migration`.

## 1. Purpose

Turn the working `bmux` CLI into a **cleanly installable Claude Code plugin** with its control surface: the skills and slash commands that teach Claude Code to drive brains, plus the distribution wiring so a marketplace install actually runs. Overriding constraint (Ali): **best-practice, maintainable, no patchwork** — one source of truth per concern, no parallel/duplicated layers, no build drift.

Out of scope (→ Plan 3): the OpenRouter model-picker + `openrouter.yaml` SSOT (see [[openrouter-model-picker]]).

## 2. Distribution — make the plugin runnable when installed

The skills/commands invoke `${CLAUDE_PLUGIN_ROOT}/bin/bmux`, which loads `dist/src/cli.js`. A marketplace install pulls the repo from GitHub without running a build, so the compiled output must be present.

- **Ship `dist/`:** remove `plugins/llmproxy/dist/` from `.gitignore`; build and commit it.
- **Guard against drift (the anti-patchwork piece):** `src/` is the single source of truth; `dist/` is generated. Add:
  - `"prepare": "npm run build"` to `package.json` (rebuilds on `npm install`).
  - `"dist-check": "npm run build && git diff --exit-code -- dist"` — fails if committed `dist/` is stale vs `src/`. Run in CI and available locally. This keeps `dist/` honest so it never becomes a hand-edited patch.
- **Merge:** after Plan 2 tasks + the final whole-branch review, merge `feat/llmproxy-migration` → `main` and push, so `/plugin marketplace add brainmuxhq/brainmux-plugins` resolves.

## 3. `delegate` skill — move into the plugin (no parallel copy)

The working prototype skill lives at `~/.claude/skills/delegate/SKILL.md` and references the deleted `claude-proxy` `bin/delegate`. It becomes the plugin's skill.

- **Move** (not copy) → `plugins/llmproxy/skills/delegate/SKILL.md`, and **delete** the old `~/.claude/skills/delegate/` so only one copy exists.
- **Update invocation:** `bin/delegate <brain> …` → `bmux delegate <brain> …` (the CLI subcommand built in the core migration). Drop all `claude-proxy`-relative path instructions.
- **Preserve the discipline verbatim** (it is the value): modes analyze/`--write`/`--yolo`; recursion guard; brains run on a separate meter; the Task/Agent tool cannot reach brains (only `bmux delegate` does); Opus must verify delegated output (no rubber-stamp); tight-scope + per-worktree `-C` guidance.

## 4. `brainmux` skill — new, teaches brain management

A skill that teaches Claude Code to manage brains conversationally via the CLI, and to hand off observability to LiteLLM's own UI (never rebuild it).

- **Covers:** lifecycle (`bmux init | up | down | restart | ps | logs | health | test`) and config (`bmux config add-brain | remove-brain | set-model | add-key | list`). States the SSOT rule: edit `brains.yaml` via `bmux config`, which regenerates + can restart — never hand-edit `generated/`.
- **Observability handoff:** for spend/usage/logs/param tuning, point the user at the **LiteLLM UI** for the relevant brain (`http://127.0.0.1:<port>/ui`, master key from `.env`) — link, don't reimplement.
- **Trigger (description):** brain/model/provider-key/spend/stack-management asks, or "add a brain", "switch model", "how much have I spent".
- Invokes the CLI as `${CLAUDE_PLUGIN_ROOT}/bin/bmux …` so it works from an installed plugin.

## 5. Slash commands — one thin wrapper

- Single file `plugins/llmproxy/commands/brainmux.md` → `/brainmux <subcommand> [args]`. Its body runs `${CLAUDE_PLUGIN_ROOT}/bin/bmux $ARGUMENTS` and reports the result. One command mirrors the whole CLI surface (`/brainmux up`, `/brainmux health`, `/brainmux config list`, …) — no per-subcommand duplication.
- Rationale: the CLI is already the surface; the command is a thin pass-through. Granular per-verb commands would duplicate the CLI's own dispatch (patchwork) for no gain.

## 6. Cleanup — retire the prototype (supersedes the migration plan's Task 17)

Now that the plugin carries the CLI + skills + commands, the `claude-proxy` prototype is fully superseded. Gated on Plan 2 verification green:

- Delete `~/Development/Projects/claude-proxy/` (its Postgres data is root-owned → may need `sudo`; ask Ali to run it).
- Remove the broken `~/.config/fish/functions/claude-{chat,deep,coder}.fish` (they point at deleted `bin/claude-*`).
- Remove the stale `Bash(.../claude-proxy/bin/delegate:*)` allow rule in `~/.claude/settings.json`.
- Update `CLAUDE.md` handoff: mark core + control-plane done; drop the "DOKUNMA ad / çalışan prototip" and "bilinen kalıntı" blocks (resolved); leave Plan 3 (OpenRouter picker) as next.

## 7. Manifests

- `plugin.json` already declares the plugin; confirm it correctly advertises `skills/` and `commands/` per the current Claude Code plugin schema (fix if the schema needs explicit lists).
- Bump versions off `0.0.0` only at the actual marketplace publish (keep out of this plan unless publishing now).

## 8. Testing / verification

Skills and commands are Markdown — no unit tests. Verify structurally + by a real install:

- `npm run dist-check` passes (committed `dist/` matches `src/`).
- The existing 38 unit tests + live smoke stay green (unchanged by this plan).
- **Fresh-clone check:** clone the repo to a temp dir, `node plugins/llmproxy/bin/bmux --help` works with **no build step** (proves shipped `dist/` is sufficient).
- **Install check:** `/plugin marketplace add <local repo>` then `/plugin install llmproxy`; confirm the `delegate` + `brainmux` skills load and `/brainmux health` runs the CLI.
- delegate skill: confirm it references `bmux delegate` and the old `~/.claude/skills/delegate` is gone (one copy).

## 9. Non-goals (YAGNI)

- OpenRouter model-picker / `openrouter.yaml` SSOT → Plan 3.
- npm publish as a second distribution channel → deferred (marketplace-from-git is the one channel now).
- Per-verb slash commands, custom spend UI, MCP control server → not built.

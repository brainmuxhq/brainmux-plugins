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
bmux spend [--since 1h|30m|7d] # per-brain requests/tokens/spend roll-up; --since scopes a recent window
bmux statusline install      # opt-in Claude Code status line (dir·git·brain·context%·cost·OR balance)
bmux install-shim            # version-agnostic bmux on ~/.local/bin (works from non-interactive shells)
```
When the user asks to "enable/turn on the status line", run `bmux statusline install` (add `--force`
only if they confirm replacing an existing one). It needs `jq`, writes
`~/.claude/brainmux-statusline.sh` + settings.json (non-destructive without `--force`), and takes
effect after they restart Claude Code — tell them to restart.

## Config (edits brains.yaml → regenerates)
```sh
bmux config list                                            # brains: name, port, model, providerKey
bmux config add-brain <name> <port> <model> [providerKey]   # default providerKey OPENROUTER_API_KEY
bmux config remove-brain <name>
bmux config set-model <name> <model>
bmux config add-key <ENV_VAR> <value>                       # write a provider key to .env
bmux config add-template <name> "<prompt>" | list-templates # reusable delegate task templates
```
Templates persist in `~/.brainmux/templates.yaml` (user entries override built-in `audit`/
`drift-scan`/`review`/`todo-scan`); used via `bmux delegate --template <name>`. You may set a
template on the user's behalf from a natural-language request.
After `add-brain`/`set-model`/`remove-brain`, run `bmux up` (or `restart`) to apply. `bmux init`
auto-generates master keys + salt + Postgres password; the user supplies provider keys via
`add-key` (secrets live in `.env`, never in `brains.yaml`).

## Model discovery (OpenRouter)
For "which model / how much / what's good for X" questions, use the **live** catalog — never
recommend a model slug from memory (models + prices change):
- `bmux models --use-cases` — the use-case guidance catalog (chat/coding/deep/cheap/long).
- `bmux models [query]` — live OpenRouter models: `id · ctx · $in/out per 1M · modality`, cheapest first.
- `bmux models --json [query]` — full records (benchmarks, supported_parameters, reasoning, modalities) for deeper judgment.

Flow: run `bmux models --use-cases` + `bmux models [query]`, pick per the use-case guidance from the
**live output**, propose it to the user, and on confirmation wire it with `bmux config set-model <brain> <id>`
(or `add-brain`), then `bmux up`. Verify a new slug actually works with `bmux test`.

## Spend / usage / logs → LiteLLM UI (don't rebuild it)
For a quick "how much have I spent" answer, run `bmux spend` — a per-brain requests/tokens/spend
roll-up read from LiteLLM's `/spend/logs`. For request logs, charts, and parameter tuning, point
the user at the **LiteLLM UI** for the brain: `http://127.0.0.1:<port>/ui`, log in with username
`admin` and that brain's master key (`<BRAIN>_MASTER_KEY` in `~/.brainmux/.env`; `bmux up` prints
the URLs + key names). Do NOT build a custom web dashboard — the LiteLLM UI already owns
observability. `bmux config list` shows each brain's port.

## Discipline
- **Default provider = OpenRouter; do NOT present a provider-choice menu on setup.** One OpenRouter
  key reaches thousands of models across providers (DeepSeek/Qwen/GLM/GPT/Gemini…), so setup assumes
  OpenRouter: have the user add `OPENROUTER_API_KEY` (hidden, separate terminal) — nothing else. Use a
  direct provider (`deepseek/…`, `openai/…`) only if the user explicitly asks; never ask them to pick a provider first.
- **Provider keys: the user adds them, never via chat.** When a provider key is missing, tell
  the user to run — **in a separate terminal, not the chat** — `bmux config add-key OPENROUTER_API_KEY`
  **with the value OMITTED**; it prompts for the key hidden (no echo), so the secret never touches
  argv, shell history, or the conversation transcript. Never ask the user to paste a key into the
  chat (a pasted key leaks into the transcript/logs), and never echo it.
- Secrets (`.env`, chmod 600) are never committed and never printed back to the user.
- Cheap-brain *delegation* is a separate skill ([[delegate]]); this skill is about managing
  the brains themselves.
- Prefer one small change at a time: edit via `bmux config`, then `bmux up`, then `bmux health`.

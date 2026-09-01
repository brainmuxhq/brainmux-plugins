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
bmux config list                                            # brains: name, port, model, providerKey
bmux config add-brain <name> <port> <model> [providerKey]   # default providerKey OPENROUTER_API_KEY
bmux config remove-brain <name>
bmux config set-model <name> <model>
bmux config add-key <ENV_VAR> <value>                       # write a provider key to .env
```
After `add-brain`/`set-model`/`remove-brain`, run `bmux up` (or `restart`) to apply. `bmux init`
auto-generates master keys + salt + Postgres password; the user supplies provider keys via
`add-key` (secrets live in `.env`, never in `brains.yaml`).

## Spend / usage / logs → LiteLLM UI (don't rebuild it)
For spend, request logs, and parameter tuning, point the user at the **LiteLLM UI** for the
brain in question: `http://127.0.0.1:<port>/ui` (log in with that brain's master key from
`~/.brainmux/.env`). Do NOT build a custom dashboard — the LiteLLM UI already owns
observability. `bmux config list` shows each brain's port.

## Discipline
- **Provider keys: the user adds them, never via chat.** When a provider key is missing, tell
  the user to run — **in a separate terminal, not the chat** — `bmux config add-key OPENROUTER_API_KEY`
  **with the value OMITTED**; it prompts for the key hidden (no echo), so the secret never touches
  argv, shell history, or the conversation transcript. Never ask the user to paste a key into the
  chat (a pasted key leaks into the transcript/logs), and never echo it.
- Secrets (`.env`, chmod 600) are never committed and never printed back to the user.
- Cheap-brain *delegation* is a separate skill ([[delegate]]); this skill is about managing
  the brains themselves.
- Prefer one small change at a time: edit via `bmux config`, then `bmux up`, then `bmux health`.

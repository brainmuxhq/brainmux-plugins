# @brainmux/llmproxy

Run [Claude Code](https://claude.com/claude-code) on cheap/alternate LLM **brains** (local
[LiteLLM](https://docs.litellm.ai) gateways to [OpenRouter](https://openrouter.ai) models) and
**delegate** grunt/detection work to them — so your Opus subscription quota goes to architecture
and review, not grunt work. The brains run on a separate pay-as-you-go meter and never touch
your Anthropic quota.

## Requirements

- Claude Code (already installed + logged in).
- Docker running (one LiteLLM container per brain + one Postgres).
- An [OpenRouter](https://openrouter.ai/keys) API key (one key reaches thousands of models).

## Install

```
/plugin marketplace add brainmuxhq/brainmux
/plugin install llmproxy@brainmux
/reload-plugins
```

`brainmuxhq/brainmux` is the repo **source** (owner/repo); `brainmux` is the marketplace
**name** — that's why the plugin id is `llmproxy@brainmux`.

## Quickstart

Easiest: just ask Claude Code — *"set up brainmux"* — the bundled `brainmux` skill walks you
through it. Or run the CLI yourself (it lives at `${CLAUDE_PLUGIN_ROOT}/bin/bmux`; alias it to
`bmux` if you like):

```sh
bmux init                              # scaffold ~/.brainmux (brains.yaml, .env, generated/)
bmux config add-key OPENROUTER_API_KEY # omit the value → hidden prompt (key never echoed)
bmux up                                # start the stack (3 default brains + Postgres)
bmux test                              # smoke every brain via /v1/messages
```

Default brains: `chat` (qwen3.7-flash), `deep` (glm-5.2), `coder` (qwen3-coder-next) — all via
OpenRouter. Change or add brains with `bmux config` (below).

## Commands

```
bmux init                                   scaffold ~/.brainmux
bmux up | down | restart                    manage the stack (regenerates from brains.yaml)
bmux ps | logs [brain] | health             inspect
bmux chat | deep | coder [claude args...]   launch Claude Code on a brain (interactive)
bmux delegate <brain> [--write|--yolo] [-C dir] [--json] [--stream] [--mcp] "<task>"  headless one-shot
bmux config add-brain <name> <port> <model> [providerKey]
bmux config remove-brain <name> | set-model <name> <model>
bmux config add-key <ENV_VAR> [value] | list
bmux test                                   smoke every brain via /v1/messages
bmux spend                                  per-brain requests / tokens / spend
bmux models [query] | --use-cases | --json  browse the live OpenRouter catalog
bmux statusline install [--force]           enable the Claude Code status line
```

## Pick a model (live)

```sh
bmux models --use-cases     # guidance catalog: chat / coding / deep / cheap / long
bmux models qwen            # live OpenRouter models matching "qwen", cheapest first
bmux models --json coder    # full records (benchmarks, params, modalities)
```
The `brainmux` skill teaches Claude to recommend a model **from this live list** (not from
memory) for your use-case, then wire it with `bmux config set-model <brain> <id>`.

## Delegate grunt work

```sh
bmux delegate coder "find and list every TODO in src/, file:line only"    # read-only
bmux delegate coder --write -C ./scratch "implement the spec in SPEC.md"   # edits, tight scope
bmux delegate coder --stream "find and list every TODO in src/"           # live progress line
bmux delegate coder --mcp "read the react docs via context7 and summarize hooks"  # opt-in MCP
bmux delegate dsflash --allow-tools mcp__brave-search__brave_web_search "verify X, cite source"  # grounded, no --yolo
```
Delegated brains run headless on the pay-as-you-go meter. Opus stays the orchestrator and
**verifies** their output — see the `delegate` skill. `--stream` (or `-v`) shows a single
live progress line (`⏳ coder · 5/34 · <current step>`) while it runs, then a closing summary
of what it touched (`↳ 6 files: a.ts, b.ts · 3 edits`) — no extra tokens, just a
serialization change; the clean final answer still goes to stdout. Every call echoes
its config (`delegate: coder · analyze · mcp off`). Workers get **no host MCP servers by
default** (saves ~35k+ tokens/call for grunt work); pass `--mcp` for the rare task that
needs one. Real per-brain spend is `bmux spend`.

## Status line (optional)

```sh
bmux statusline install          # enable it (needs jq); --force to replace an existing one
```
Adds a Claude Code status line showing `📁 dir · 🌿 git · 🧠 brain (proxy) / 🤖 model · ⚡ effort ·
🧠 context% · 💰 cost · 💳 OpenRouter balance · ±lines · ⏱️ time`. The active brain name comes
from the launcher (`$BRAINMUX_BRAIN`), so it never drifts when `brains.yaml` changes. It is
**opt-in** (Claude Code plugins can't auto-set a status line) and **non-destructive** — if you
already have a `statusLine`, it is left alone unless you pass `--force`. Restart Claude Code (or
start a new session) after installing.

## How it works

`brains.yaml` (in `~/.brainmux/`, zod-validated) is the single source of truth. `bmux` generates
a Docker Compose file + one LiteLLM config per brain + the Postgres init SQL from it. Each brain
is an isolated LiteLLM container routed by **port** (`model_name: "*"`), and `bmux <brain>` points
Claude Code at that port. Edit brains only via `bmux config` — never hand-edit `generated/`.

## Security

Secrets (provider + master keys, salt, Postgres password) live only in `~/.brainmux/.env`
(chmod 600), never in `brains.yaml`, never committed. Add provider keys with `bmux config
add-key <ENV_VAR>` (value omitted → hidden prompt) in a terminal — don't paste keys into chat.

## Observability

`bmux spend` prints a quick per-brain requests/tokens/spend roll-up in the terminal. For the
full picture — request logs, charts, parameter tuning — open each brain's **LiteLLM UI** at
`http://127.0.0.1:<port>/ui` and log in with username `admin` and that brain's master key
(`<BRAIN>_MASTER_KEY` in `~/.brainmux/.env`). `bmux up` prints the URLs + key names on start.
Ground-truth billing (all brains combined) is your [OpenRouter dashboard](https://openrouter.ai/activity).

---

Brand: [brainmux.com](https://brainmux.com) · Engine: LiteLLM (MIT core, pinned + mirrored) · License: MIT

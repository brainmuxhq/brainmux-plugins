<p align="center">
  <img src="../../brand/llmproxy.svg" width="84" height="84" alt="llmproxy" />
</p>

<h1 align="center">llmproxy</h1>

<p align="center"><strong>Run Claude Code on cheap brains — your Opus quota goes to judgment, not grunt work.</strong></p>

<p align="center">
  <img src="https://img.shields.io/badge/Claude%20Code-plugin-E8B341?style=flat-square" alt="Claude Code plugin" />
  <img src="https://img.shields.io/badge/saves-Opus%20quota-4FD1C5?style=flat-square" alt="saves Opus quota" />
  <img src="https://img.shields.io/badge/runs-Docker-3fb950?style=flat-square" alt="Docker" />
  <img src="https://img.shields.io/badge/license-MIT-blue?style=flat-square" alt="MIT" />
</p>

---

Run [Claude Code](https://claude.com/claude-code) on cheap/alternate LLM **brains** (local
[LiteLLM](https://docs.litellm.ai) gateways to [OpenRouter](https://openrouter.ai) models) and
**delegate** grunt/detection work to them — so your Opus subscription quota goes to architecture
and review, not grunt work. The brains run on a separate pay-as-you-go meter and never touch
your Anthropic quota.

## Requirements

- Claude Code (already installed + logged in).
- Docker running (one LiteLLM container per brain + one Postgres).
- An [OpenRouter](https://openrouter.ai/keys) API key (one key reaches thousands of models).

(Only [direct brains](#direct-brains-self-hosted-endpoint)? Then no Docker and no OpenRouter key are needed.)

## Install

```
/plugin marketplace add brainmuxhq/brainmux-plugins
/plugin install llmproxy@brainmux
/reload-plugins
```

`brainmuxhq/brainmux-plugins` is the repo **source** (owner/repo); `brainmux` is the marketplace
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
bmux delegate <brain> [--write|--yolo] [-C dir] [--json] [--stream] [--mcp] [--verify] [--memory] [--thinking off|low|medium|deep] "<task>"  headless one-shot
bmux config add-brain <name> <port> <model> [providerKey]
bmux config add-direct <name> <url> <model> <authTokenFile> [maxOutputTokens] [contextWindow]   direct brain (no LiteLLM)
bmux config remove-brain <name> | set-model <name> <model>
bmux config add-key <ENV_VAR> [value] | list
bmux config add-template <name> "<prompt>" | list-templates   reusable delegate task templates
bmux test                                   smoke every brain via /v1/messages (direct: Bearer)
bmux spend [--since 1h|30m|7d]              per-brain requests / tokens / spend (--since scopes a window)
bmux models [query] | --use-cases | --json  browse the live OpenRouter catalog
bmux statusline install [--force]           enable the Claude Code status line
bmux install-shim [--force]                 put a version-agnostic bmux on ~/.local/bin (any shell)
```

## Direct brains (self-hosted endpoint)

A brain can point **straight at a server that already speaks the Anthropic Messages API**
(`/v1/messages` with tool use — e.g. vLLM) instead of a LiteLLM container. Give it a `url`
instead of a `port`:

```yaml
# ~/.brainmux/brains.yaml
version: 1
brains:
  ev: { url: "http://192.0.2.10:8000", model: qwen3.8-27b, authTokenFile: ~/.config/brainmux/ev-llm-key, contextWindow: 131072 }
  # optional: maxOutputTokens: 32000   (default 20000)
  # optional: thinking: low             (off|low|medium|deep, default medium)
```

| field | meaning |
|---|---|
| `url` | endpoint root, `http://` or `https://` (Claude Code appends `/v1/messages`) |
| `model` | the server's model id — sent in every request (all Claude Code model slots point at it) |
| `authTokenFile` | file holding the token, sent as `Authorization: Bearer …`. Read **at run time**; must be `chmod 600` (bmux refuses a group/world-readable file). Never copied into `.env`, never printed. |
| `maxOutputTokens` | the child's `CLAUDE_CODE_MAX_OUTPUT_TOKENS` (default 20000). Small limits leave reasoning models with thinking-only replies / half tool calls. |
| `contextWindow` | the model's real context window (input + output), e.g. `131072`. **Set it.** Claude Code assumes 200K for a model it doesn't know, so without it a long task grows past the server's limit and dies with `API Error: 400 … maximum context length`. With it bmux sets `CLAUDE_CODE_MAX_CONTEXT_TOKENS` so the worker compacts once its input reaches `contextWindow − max_tokens − 8192` (e.g. 102400 at `medium`, 86016 at `deep`). |
| `thinking` | how much the model may think per request: `off` · `low` · `medium` (default) · `deep` — see below. `bmux delegate --thinking` overrides it per task. |

### Thinking level

Every request to a direct brain carries a **thinking budget** (the server enforces it), so the
model can't think for minutes on a simple task:

| level | request sent | use for |
|---|---|---|
| `off` | `thinking: {type: "disabled"}`, no effort | lookups, extraction, formatting, mechanical edits |
| `low` | `thinking: {type: "enabled", budget_tokens: 4096}`, effort `low` | small, clear tasks |
| `medium` (default) | `budget_tokens: 16384`, effort `medium` | normal coding / analysis |
| `deep` | `budget_tokens: 32768`, effort `xhigh` | hard bugs, tricky design questions |

`max_tokens` is kept at least `budget + 4096` (room for the answer), so `deep` raises it to
36864 and `medium` to 20480 when `maxOutputTokens` is lower. The effort is never `high` or `max`
(vLLM rejects both), whatever your Claude Code settings say. Under the hood bmux sets
`MAX_THINKING_TOKENS`, `CLAUDE_CODE_EFFORT_LEVEL`, `CLAUDE_CODE_MAX_OUTPUT_TOKENS` and
`CLAUDE_CODE_MODEL_CAPABILITIES` (marks the model as budget-thinking, effort `low|medium|xhigh`)
for the child `claude`; the interactive `bmux ev` uses the brain's level too.

```sh
bmux delegate ev --thinking off "list every exported function in src/core/env.ts"
bmux delegate ev --thinking deep "trace how parseBrains rejects a duplicate port and explain each step"
```

`bmux ev` / `bmux delegate ev …` set `ANTHROPIC_BASE_URL=<url>`, `ANTHROPIC_AUTH_TOKEN=<file
content>`, `ANTHROPIC_MODEL` (+ opus/sonnet/haiku/small-fast/subagent model vars) `=<model>` and
remove `ANTHROPIC_API_KEY` from the child (it would be sent as `x-api-key`). Direct brains are
not part of the stack: compose generation, `up`/`ps`/`health` and `spend` skip them, and they
bind no local port. `bmux test` probes them with Bearer auth.

Add one with `bmux config add-direct ev http://192.0.2.10:8000 qwen3.8-27b ~/.config/brainmux/ev-llm-key 20000 131072`.

`bmux delegate --json` on a direct brain reports `cost_usd_estimate: 0` — the server is
self-hosted, and the worker's own estimate would use Anthropic prices. `ok` is `false` whenever
the worker failed (an API error's text is in `result`), so `--retry` and scripts see it.
For a **direct-only** setup (no LiteLLM brains), write `brains.yaml` like the block above
*before* `bmux init` — init keeps an existing `brains.yaml`, writes no stack secrets and needs no Docker.

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
bmux delegate deep --verify "which of these 5 regulations are still in force?"  # draft → web-check each claim
bmux delegate coder --template drift-scan -C .   # expand a saved template (built-in or your own)
bmux delegate dsflash --retry 2 "..."            # auto-retry up to 2x on an empty/failed result
bmux delegate coder --memory "update every caller of getPort"  # ground on the local code graph (needs graphmux: gmux install)
```

`--memory` wires the [graphmux](../graphmux) plugin's local code-graph MCP (deterministic
call-graph, no embeddings) so the brain queries real symbols/callers/impact instead of guessing.
Isolated (`--mcp-config` + strict) so it doesn't pull host MCP servers. Install once: `gmux install`.
Templates: built-ins `audit` · `drift-scan` · `review` · `todo-scan`; add your own with
`bmux config add-template <name> "<prompt>"` (stored in `~/.brainmux/templates.yaml`), list with
`bmux config list-templates`.
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
(chmod 600), never in `brains.yaml`, never committed. A direct brain's token stays in its own
`authTokenFile` (chmod 600 enforced); `brains.yaml` holds only the path. Add provider keys with `bmux config
add-key <ENV_VAR>` (value omitted → hidden prompt) in a terminal — don't paste keys into chat.

## Observability

`bmux spend` prints a quick per-brain requests/tokens/spend roll-up in the terminal. For the
full picture — request logs, charts, parameter tuning — open each brain's **LiteLLM UI** at
`http://127.0.0.1:<port>/ui` and log in with username `admin` and that brain's master key
(`<BRAIN>_MASTER_KEY` in `~/.brainmux/.env`). `bmux up` prints the URLs + key names on start.
Ground-truth billing (all brains combined) is your [OpenRouter dashboard](https://openrouter.ai/activity).

---

<p align="center">
  <img src="../../brand/brainmux.svg" width="26" height="26" alt="brainmux" /><br />
  <sub>Part of <a href="https://brainmux.com"><strong>brainmux</strong></a> — LLM tooling for Claude Code.
  Engine: <a href="https://docs.litellm.ai">LiteLLM</a> (MIT core, pinned + mirrored) · License: MIT</sub>
</p>

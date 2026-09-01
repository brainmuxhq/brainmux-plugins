# brainmux — Architecture Design

**Date:** 2026-09-01
**Status:** Approved (design), pending spec review → implementation plan
**Product:** `brainmux` — the first plugin in the **brainmux** monorepo.

## 1. Purpose

Let a developer drive **Claude Code** with cheap/alternate "brains" (LiteLLM proxies to
OpenRouter models) so grunt/detection work is offloaded off the Anthropic subscription
quota, while Opus stays the orchestrator. Everything is managed conversationally from
inside Claude Code in the terminal.

**Value:** the Anthropic quota is the bottleneck (Pro 5x). Proxy brains run on a separate
pay-as-you-go meter (OpenRouter) and never touch that quota. brainmux makes offloading a
first-class, low-friction workflow.

## 2. Boundary (what we do NOT own)

- **Claude Code** is assumed already installed and logged in on the user's machine. brainmux
  does **not** bundle, install, configure, or modify it. (Claude Code is proprietary —
  redistribution is not permitted; we only set env vars for our own launches.)
- **LiteLLM** is a vendored engine (MIT core), not our code. We pin + mirror its image and
  generate its config. We never ship its `enterprise/` directory.

## 3. Distribution

- **Marketplace monorepo:** `brainmuxhq/brainmux` (marketplace name `brainmux`),
  npm workspaces, home to a family of `@brainmux/*` plugins. brainmux is the first.
- **Plugin:** installed via `/plugin marketplace add brainmuxhq/brainmux` →
  `/plugin install brainmux`. Bundles the CLI + skills + slash commands.
- **npm (optional):** `@brainmux/llmproxy` for users who want `bmux` outside Claude Code.
- The Node CLI lives inside the plugin (`${CLAUDE_PLUGIN_ROOT}/bin/bmux`); Node is present
  because Claude Code requires it — no extra runtime dependency.

## 4. Code ↔ State separation

```
CODE   → the plugin / npm package (versioned, read-only)
STATE  → ~/.brainmux/   (BRAINMUX_HOME, overridable)
          ├─ brains.yaml            # declarative SSOT (the user's brains)
          ├─ .env                   # secrets, chmod 600 (provider + master keys)
          ├─ generated/
          │   ├─ compose.yaml       # generated — do not hand-edit
          │   └─ init/*.sql
          └─ data/postgres          # persistent DB state
```

Updating code (`npm update` / plugin update) never disturbs user state.

## 5. Repo structure (source)

```
brainmux/
├─ .claude-plugin/marketplace.json   # lists plugins: brainmux, (future…)
├─ package.json                       # npm workspaces
├─ plugins/
│   └─ llmproxy/
│       ├─ .claude-plugin/plugin.json # declares skills + commands
│       ├─ package.json               # @brainmux/llmproxy
│       ├─ bin/bmux                    # CLI entry (node dist/cli.js)
│       ├─ src/
│       │   ├─ cli.ts                  # arg parse → dispatch (thin)
│       │   ├─ commands/  launch · delegate · stack · config · init · test
│       │   └─ core/  manifest · generate · env · docker · paths
│       ├─ templates/  compose + litellm-brain templates
│       ├─ skills/  delegate/ · brainmux/
│       ├─ commands/  brainmux slash commands
│       ├─ test/  unit (manifest, generate golden) + smoke.sh
│       └─ README.md · .env.example
└─ README.md
```

## 6. Config SSOT — `brains.yaml`

The single source of truth. Validated with a zod schema.

```yaml
version: 1
brains:
  chat:  { port: 4567, model: openrouter/qwen/qwen3.7-flash,     providerKey: OPENROUTER_API_KEY }
  deep:  { port: 4568, model: openrouter/z-ai/glm-5.2,           providerKey: OPENROUTER_API_KEY }
  coder: { port: 4569, model: openrouter/qwen/qwen3-coder-next,  providerKey: OPENROUTER_API_KEY }
```

`bmux config add-brain|set-model|remove-brain` edits this file → regenerates → restarts.
Master keys are auto-generated at `init` (`openssl rand`) and written to `.env`; provider
keys are user-supplied. Secrets never live in `brains.yaml`.

## 7. Generator

`brains.yaml` → deterministic, idempotent generation of:
- one LiteLLM **config yaml per brain** (`model_name: "*"` → the brain's backend model,
  `drop_params: true`),
- one **compose service per brain** (`<<: *litellm-base`, its port, `DATABASE_URL`,
  `LITELLM_MASTER_KEY`), plus the shared Postgres service,
- `init/01-databases.sql` (`CREATE DATABASE litellm_<brain>;` per brain).

Generation is golden-file tested: the current three brains must reproduce byte-equivalent
(modulo formatting) working artifacts before switchover.

## 8. Runtime (Docker, DB retained)

```
brains.yaml ──generate──► N LiteLLM containers (one per brain) + 1 Postgres
                          each brain isolated by PORT (bmux controls ANTHROPIC_BASE_URL)
```

- **Routing is by port**, not model name: Claude Code sends an opaque/hashed model id to the
  proxy (verified 2026-09-01 — a custom `--model` string arrives as a hash), so per-instance
  `model_name: "*"` wildcard is the routing mechanism. One LiteLLM instance per brain.
- **One Postgres** instance, one database per brain (LiteLLM instances each own their tables).
  `STORE_MODEL_IN_DB=True`. Retained for spend history, request logs, virtual keys, admin UI,
  and future growth (teams, budgets, usage analytics).
- **Image:** pinned by digest and mirrored to a brainmux-owned registry (GHCR: ghcr.io/brainmuxhq) (see §12).
- Single-instance-via-virtual-keys (fewer containers, scales to many brains) is a **v2**
  optimization — deferred because key→model routing with opaque model ids is unverified, and
  we do not run two parallel routing schemes.

## 9. Control plane

Two complementary surfaces; no custom web UI is built.

| Surface | Role | Notes |
|---|---|---|
| **Claude Code + bmux** (primary) | Declarative brain lifecycle: add/remove brain, set model, add key, up/down, delegate | SSOT = `brains.yaml` + `.env`; skills teach CC to run `bmux …` |
| **LiteLLM UI** (observability) | Spend/usage dashboards, request logs, model param tuning, key/budget management | Free (OSS + our DB); linked, not rebuilt. One UI per brain/port. |

Rationale: the LiteLLM UI covers spend/logs/params/keys well, but cannot add **brains**
(containers+ports) and using it for model management would move state into the DB and break
the declarative `brains.yaml` SSOT. So it is a read-mostly power surface, not the primary
control plane.

**Plugin control-plane pieces:**
- `skills/delegate` — offload grunt/detection to a brain (headless `claude -p`), Opus
  consolidates. (Already prototyped.)
- `skills/brainmux` — teaches Claude Code to run `bmux config …` for brain/key/model
  management and to point the user at the LiteLLM UI for spend.
- `commands/` — slash commands (`/brainmux up`, `/brainmux add-brain`, `/brainmux spend`, …)
  as thin wrappers over the CLI.
- Control surface = skills + slash commands driving the `bmux` CLI. An **MCP server**
  exposing structured tools (`add_brain`, `set_model`, `get_spend`, …) is a **v2** option.

## 10. `bmux` CLI surface

```
bmux init                          scaffold ~/.brainmux (brains.yaml, .env, gen), pull image
bmux up | down | restart | ps | logs [svc] | health
bmux chat | deep | coder [claude args…]     launch Claude Code on a brain (exec, user cwd)
bmux delegate <brain> [--write|--yolo] [-C dir] [--json] "<task>"
bmux config add-brain|remove-brain|set-model|add-key|list
bmux test                          smoke test all brains via /v1/messages
bmux ui [brain]                    print/open the LiteLLM UI URL for a brain
```

- Brain launch runs in the **user's** cwd; lifecycle/config commands operate on
  `BRAINMUX_HOME`.
- `delegate` keeps its modes: analyze (read-only, default), `--write` (acceptEdits),
  `--yolo` (skip permissions). Recursion-guarded (`DELEGATE_DEPTH`). Opus must verify
  delegated output.

## 11. Error handling

- `brains.yaml` invalid → zod produces a precise, human-readable message.
- Missing `.env` key → bmux states which key and how to add it (`bmux config add-key`).
- Docker not installed/running → detect and instruct.
- Port already in use → detected at `config add-brain`.
- A brain unreachable → `bmux health` / `bmux test` reports it (valid Anthropic message =
  alive, including thinking-only responses).

## 12. Image mirroring

Pin the LiteLLM image by digest and mirror it to a brainmux-owned registry (GHCR: ghcr.io/brainmuxhq) so the product
does not depend on upstream staying alive:

```
upstream (pinned): ghcr.io/berriai/litellm-database@sha256:5ead13edd4efd89f32dab349c1f19447d395affca53f3aeae00f5e6e01b8c08d
mirror:            ghcr.io/brainmuxhq/brainmux-litellm@<digest>
```

Generated compose references the mirror digest. MIT permits this; exclude `enterprise/`.
Also keep an offline `docker save` tarball as a disaster backup. (GHCR ghcr.io/brainmuxhq — chosen)

## 13. Migration (claude-proxy → brainmux)

1. Restructure the current `claude-proxy` repo into `brainmux/plugins/llmproxy/`.
2. Author `brains.yaml` capturing the current three brains.
3. Build the generator; prove golden-parity against the current working compose/config/init.
4. Move state to `~/.brainmux/` (optionally migrate `data/postgres` to keep spend history).
5. Rewrite the CLI from POSIX sh to Node/TS (launch, delegate, stack, config, init, test).
6. Package skills + commands into the plugin; publish the marketplace.

## 14. Testing

- **Unit:** manifest parse/validate; generator golden-file (brains.yaml → compose/config/init);
  `.env` read/write (incl. chmod 600).
- **Integration:** `smoke.sh` — `bmux up` then a real `/v1/messages` per brain (accept text
  or thinking-only as alive).
- **CI:** unit tests run without Docker; smoke is Docker-gated.

## 15. Non-goals / deferred (YAGNI)

- Custom web UI (LiteLLM UI covers observability).
- Single-container virtual-key routing (v2).
- MCP server control surface (v2).
- Bundling/installing Claude Code (out of scope — user brings their own).
- SaaS key provisioning (user supplies their own OpenRouter key).

## 16. Open items for implementation

- Registry: GHCR (ghcr.io/brainmuxhq) — resolved.
- Exact plugin manifest schema (`plugin.json`) fields for skills + commands.
- Whether `data/postgres` is migrated or reset on first `bmux init`.

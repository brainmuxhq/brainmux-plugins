# brainmux

LLM tooling for [Claude Code](https://claude.com/claude-code) — a marketplace of plugins that let
Claude Code drive cheap/alternate LLM "brains", so your Opus quota goes to architecture and
review, not grunt work.

## The idea

The Anthropic subscription quota is the bottleneck. brainmux routes Claude Code to
[LiteLLM](https://docs.litellm.ai) gateways backed by cheap [OpenRouter](https://openrouter.ai)
models (a separate pay-as-you-go meter that never touches your Anthropic quota), and lets Opus
**delegate** grunt/detection work to them while staying the orchestrator.

## Plugins

| Plugin | What it does |
|---|---|
| [`llmproxy`](plugins/llmproxy/) | Run Claude Code on cheap/alternate LLM brains + delegate grunt work, managed by the `bmux` CLI + skills. |
| [`graphmux`](plugins/graphmux/) | Give agents (and `bmux delegate --memory`) a local, deterministic code graph via the `gmux` CLI — callers · impact · dead-code scan (`orphans`) · drift-scan (graph + blind-zone grep) · git-hook auto-reindex. Thin wrapper over CodeGraph. |

Same house-style for both: vendor a mature open-source core (LiteLLM, CodeGraph), pin it, and wrap
it in a thin control layer — same core, our packaging.

## Install

```
/plugin marketplace add brainmuxhq/brainmux-plugins
/plugin install llmproxy@brainmux
/plugin install graphmux@brainmux
/reload-plugins
```

`brainmuxhq/brainmux-plugins` is the repo **source** (GitHub owner/repo); `brainmux` is the marketplace
**name** — hence the plugin ids `llmproxy@brainmux` / `graphmux@brainmux`. See each plugin's README
([llmproxy](plugins/llmproxy/README.md) · [graphmux](plugins/graphmux/README.md)) for setup + usage.

## Structure

```
.claude-plugin/marketplace.json   # marketplace "brainmux" → lists plugins
plugins/<name>/                   # each plugin (Claude Code plugin + Node CLI)
docs/specs · docs/plans           # design + implementation records
```

Requirements: Docker + an OpenRouter API key (see the plugin README).

---

Brand: [brainmux.com](https://brainmux.com) · Engines: LiteLLM · CodeGraph (MIT cores) · License: MIT

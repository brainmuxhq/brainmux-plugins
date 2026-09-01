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

## Install

```
/plugin marketplace add brainmuxhq/brainmux
/plugin install llmproxy@brainmux
/reload-plugins
```

`brainmuxhq/brainmux` is the repo **source** (GitHub owner/repo); `brainmux` is the marketplace
**name** — hence the plugin id `llmproxy@brainmux`. See [`plugins/llmproxy/README.md`](plugins/llmproxy/README.md)
for setup + usage.

## Structure

```
.claude-plugin/marketplace.json   # marketplace "brainmux" → lists plugins
plugins/<name>/                   # each plugin (Claude Code plugin + Node CLI)
docs/specs · docs/plans           # design + implementation records
```

Requirements: Docker + an OpenRouter API key (see the plugin README).

---

Brand: [brainmux.com](https://brainmux.com) · Engine: LiteLLM (MIT core) · License: MIT

# brainmux

LLM tooling for [Claude Code](https://claude.com/claude-code). A family of plugins that let
Claude Code drive cheap/alternate LLM "brains", so your Opus quota is spent on architecture
and review — not grunt work.

> **Status:** early scaffolding. Architecture approved; first plugin (`llmproxy`) in
> development. See `CLAUDE.md` for design decisions.

## The idea

The Anthropic subscription quota is the bottleneck. brainmux routes Claude Code to
[LiteLLM](https://docs.litellm.ai) gateways backed by cheap OpenRouter models (a separate
pay-as-you-go meter that never touches your Anthropic quota), and lets Opus **delegate**
grunt/detection work to them while staying the orchestrator.

## Plugins

| Plugin | What it does |
|---|---|
| `llmproxy` | Run Claude Code on cheap/alternate LLM brains + delegate grunt work (first plugin) |

## Install (planned)

```sh
/plugin marketplace add brainmuxhq/brainmux
/plugin install llmproxy
```

## Structure

```
plugins/<name>/        # each plugin (Claude Code plugin + Node CLI)
.claude-plugin/marketplace.json
```

Brand: [brainmux.com](https://brainmux.com). Engine: LiteLLM (MIT core).

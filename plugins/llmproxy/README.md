# @brainmux/llmproxy

Run [Claude Code](https://claude.com/claude-code) on cheap/alternate LLM "brains" (LiteLLM
gateways to OpenRouter models) and **delegate** grunt/detection work to them — so your Opus
subscription quota is spent on architecture and review, not grunt work.

> **Status:** scaffold. Logic is being migrated from the `claude-proxy` prototype into this
> Node/TS package. See the repo root `CLAUDE.md` and `docs/specs/` for the design.

## Install (planned)

```sh
/plugin marketplace add brainmuxhq/brainmux
/plugin install llmproxy
```

## Command surface (planned)

```
bmux init | up | down | restart | ps | logs | health
bmux chat | deep | coder [claude args...]
bmux delegate <brain> [--write|--yolo] [-C dir] [--json] "<task>"
bmux config add-brain | remove-brain | set-model | add-key | list
bmux test | ui
```

Brand: [brainmux.com](https://brainmux.com). Engine: LiteLLM (MIT core).

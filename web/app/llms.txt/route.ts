import { FAQ } from "../faq";

// /llms.txt — a plain-text brief for AI answer engines (GEO). Derived from the same
// FAQ source as the page + JSON-LD.
export const dynamic = "force-static";

export function GET() {
  const faq = FAQ.map((f) => `Q: ${f.q}\nA: ${f.a}`).join("\n\n");

  const body = `# brainmux

> LLM tooling for Claude Code. Run Claude Code on cheap alternate LLM models and
> delegate grunt work to them, keeping your Opus quota for architecture and review.

## What it is
brainmux is a brand of tools for Claude Code. Its first tool, llmproxy (CLI: bmux),
routes Claude Code to cheap OpenRouter models through local LiteLLM proxies — one
proxy ("brain") per model, isolated by port. A single brains.yaml is the source of
truth; bmux generates the Docker Compose stack from it. Its second tool, graphmux
(CLI: gmux), gives agents a local, deterministic code graph (callers, callees, impact,
verbatim source) so they ground on your codebase instead of guessing — a thin wrapper
over the CodeGraph engine (tree-sitter to a local SQLite graph; no embeddings, no
cloud, telemetry off). Each tool wraps a mature open-source core (LiteLLM, CodeGraph)
in a thin, version-pinned layer.

## Key facts
- One OpenRouter key reaches thousands of models (DeepSeek, Qwen, GLM, Kimi, GPT, Gemini, and more).
- The brains run pay-as-you-go on OpenRouter and never touch your Anthropic subscription quota.
- Opus stays the orchestrator; cheap brains do the volume (bulk edits, detection sweeps); Opus reviews and fixes.
- Free and MIT-licensed. Requires Docker and an OpenRouter API key.

## Install (in Claude Code)
/plugin marketplace add brainmuxhq/brainmux-plugins
/plugin install llmproxy@brainmux

## Quickstart (terminal)
bmux init
bmux config add-key OPENROUTER_API_KEY   # hidden prompt; key not echoed
bmux up
bmux test

## Commands
bmux init | up | down | restart | ps | logs [brain] | health
bmux <brain> [claude args]        # launch Claude Code on a brain (chat/deep/coder)
bmux delegate <brain> "<task>"    # headless grunt work; Opus verifies
bmux config add-brain | remove-brain | set-model | add-key | list
bmux models [query] | --use-cases | --json   # live OpenRouter catalog
bmux spend                        # per-brain requests/tokens/spend
bmux test                         # smoke every brain via /v1/messages

## graphmux (CLI: gmux)
- Local, deterministic code graph for Claude Code and bmux delegates — no embeddings, no cloud, telemetry off.
- Install: /plugin install graphmux@brainmux
- gmux install                 # download + SHA256-verify the pinned CodeGraph binary, write the MCP config
- gmux index [path]            # build/rebuild the code graph for a repo
- gmux status | sync [path]    # index stats / sync changes
- gmux -- explore | callers | callees | impact | node   # query the graph
- bmux delegate <brain> --memory "<task>"   # ground a cheap brain on the code graph (stops hallucination)

## Links
- GitHub: https://github.com/brainmuxhq/brainmux-plugins
- Site: https://brainmux.com
- Engines: LiteLLM (MIT) + CodeGraph (MIT)

## FAQ
${faq}
`;

  return new Response(body, {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}

// Single source of truth for FAQ content — feeds the visible FAQ section,
// the FAQPage JSON-LD (SEO), and /llms.txt (GEO). Edit here only.
export interface Faq {
  q: string;
  a: string;
}

export const FAQ: Faq[] = [
  {
    q: "What is brainmux?",
    a: "brainmux is LLM tooling for Claude Code. Its first tool, llmproxy, lets you run Claude Code on cheap alternate LLM models and delegate grunt work to them — so your Opus subscription quota goes to architecture and review, not busywork.",
  },
  {
    q: "What is llmproxy?",
    a: "llmproxy is a Claude Code plugin (CLI: bmux) that routes Claude Code to cheap OpenRouter models via local LiteLLM proxies. One OpenRouter key reaches thousands of models across providers like DeepSeek, Qwen, GLM, GPT and Gemini.",
  },
  {
    q: "What is graphmux?",
    a: "graphmux is the second brainmux plugin (CLI: gmux). It gives Claude Code and bmux delegates a local, deterministic code graph — real callers, callees, impact and verbatim source — so agents ground on your actual codebase instead of guessing. It's a thin wrapper over the vendored CodeGraph engine (tree-sitter to a local SQLite graph): no embeddings, no cloud.",
  },
  {
    q: "Does graphmux send my code anywhere?",
    a: "No. graphmux indexes your repo into a local SQLite graph on your own machine — no embeddings API, no cloud upload, and the vendored engine's telemetry is forced off by default. Install it with `/plugin install graphmux@brainmux`, then `gmux install` and `gmux index`.",
  },
  {
    q: "How does graphmux stop cheap brains from hallucinating?",
    a: "Run `bmux delegate <brain> --memory \"<task>\"`. It wires graphmux's code-graph MCP into the cheap brain (isolated — no host MCP noise), so the brain looks up real callers, callees and impact before it acts, instead of inventing file paths or symbol names.",
  },
  {
    q: "Does it use my Anthropic or Opus quota?",
    a: "No. The cheap brains run pay-as-you-go on OpenRouter, on a separate meter that never touches your Anthropic subscription quota. Opus stays the orchestrator; the cheap brains do the volume.",
  },
  {
    q: "What models can I use?",
    a: "Any model on OpenRouter — DeepSeek, Qwen, GLM, Kimi, GPT, Gemini and hundreds more — with a single key. `bmux models` browses the live catalog by price, context and use-case, so you never guess a stale model slug.",
  },
  {
    q: "How much does it cost?",
    a: "llmproxy is free and MIT-licensed. You only pay OpenRouter's pay-as-you-go per-token price for the models you actually use — usually cents. Your Anthropic subscription quota is untouched.",
  },
  {
    q: "How do I install it?",
    a: "In Claude Code, run `/plugin marketplace add brainmuxhq/brainmux` then `/plugin install llmproxy@brainmux`. Then `bmux init`, add your OpenRouter key (`bmux config add-key OPENROUTER_API_KEY`), `bmux up`, and `bmux test`.",
  },
  {
    q: "Do I need Docker?",
    a: "Yes. Each brain runs as a local LiteLLM Docker container isolated by port, with one shared Postgres. brainmux generates the whole Docker Compose stack from a single brains.yaml file.",
  },
];

// Thinking level for a DIRECT brain: how much the child Claude Code lets the model think.
//
// A direct endpoint (vLLM) speaks the Anthropic Messages API but is a model Claude Code does
// not know, so by default Claude Code sends `thinking: {type: "adaptive"}` (no budget — the
// model once thought for 11 minutes on a simple task) plus whatever effort the user's
// settings.json says (e.g. "xhigh", or "high"/"max", which vLLM rejects with HTTP 400).
//
// The child is steered with env vars only (verified against Claude Code 2.1.281 with a local
// fake /v1/messages server):
//   CLAUDE_CODE_MODEL_CAPABILITIES  "<model>=caps" — declares the model budget-thinking
//                                   (-adaptive_thinking), able to turn thinking off
//                                   (-rejects_disabled_thinking), effort low|medium|xhigh
//                                   only (-max_effort; "high" is never requested)
//   MAX_THINKING_TOKENS             N>0 → thinking {type:"enabled", budget_tokens:N}; 0 → {type:"disabled"}
//   CLAUDE_CODE_EFFORT_LEVEL        output_config.effort; wins over --effort and settings.json
//   CLAUDE_CODE_MAX_OUTPUT_TOKENS   max_tokens; must stay above the budget (Claude Code clamps
//                                   the budget to max_tokens-1 otherwise)

export const THINKING_LEVELS = ["off", "low", "medium", "deep"] as const;
export type ThinkingLevel = (typeof THINKING_LEVELS)[number];
export const DEFAULT_THINKING: ThinkingLevel = "medium";

/** Budget + effort per level. vLLM accepts effort low|medium|xhigh only ("high"/"max" → 400). */
export const THINKING: Record<ThinkingLevel, { budget: number; effort: "low" | "medium" | "xhigh" } | null> = {
  off: null,
  low: { budget: 4096, effort: "low" },
  medium: { budget: 16384, effort: "medium" },
  deep: { budget: 32768, effort: "xhigh" },
};

/** Output tokens kept for the answer after a fully used thinking budget. */
export const ANSWER_ROOM = 4096;

export function isThinkingLevel(v: string): v is ThinkingLevel {
  return (THINKING_LEVELS as readonly string[]).includes(v);
}

/** The env a child `claude` needs for this level (set) and the inherited vars that would interfere (unset). */
export function thinkingEnv(level: ThinkingLevel, model: string, maxOutputTokens: number): { set: Record<string, string>; unset: string[] } {
  const t = THINKING[level];
  const caps = ["thinking", "-adaptive_thinking", "-rejects_disabled_thinking", "-max_effort"];
  // Off sends no effort at all (-effort); otherwise effort is on and xhigh is allowed.
  caps.push(...(t ? ["effort", "xhigh_effort"] : ["-effort", "-xhigh_effort"]));
  const set: Record<string, string> = {
    CLAUDE_CODE_MODEL_CAPABILITIES: `${model.toLowerCase()}=${caps.join(",")}`,
    MAX_THINKING_TOKENS: String(t ? t.budget : 0),
    CLAUDE_CODE_MAX_OUTPUT_TOKENS: String(t ? Math.max(maxOutputTokens, t.budget + ANSWER_ROOM) : maxOutputTokens),
  };
  if (t) set.CLAUDE_CODE_EFFORT_LEVEL = t.effort;
  // CLAUDE_CODE_DISABLE_THINKING would drop both the budget and the explicit {type:"disabled"}.
  const unset = ["CLAUDE_CODE_DISABLE_THINKING", ...(t ? [] : ["CLAUDE_CODE_EFFORT_LEVEL"])];
  return { set, unset };
}

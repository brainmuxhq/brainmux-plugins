// Context window for a DIRECT brain, so the child Claude Code compacts BEFORE the server rejects
// the request (vLLM: input + max_tokens must fit the model's window, else HTTP 400).
//
// Claude Code does not know a self-hosted model and assumes a 200K window. Measured on Claude
// Code 2.1.281 with a local fake /v1/messages server: CLAUDE_CODE_MAX_CONTEXT_TOKENS=W sets the
// window for an unknown model, and a headless (-p) run compacts once the input reaches
//   W − min(max_tokens, 20000) − 3000
// (not earlier). bmux therefore reports a W that puts that point at
//   contextWindow − max_tokens − SAFETY
// SAFETY covers what Claude Code adds after the server's last token count (tool results it
// only estimates, with a tokenizer different from the model's).

export const CONTEXT_SAFETY = 8192;
const CC_OUTPUT_RESERVE_CAP = 20000; // Claude Code reserves min(max_tokens, 20000) for output
const CC_BLOCKING_BUFFER = 3000; // …and compacts this far below the remaining window
const MIN_USABLE_INPUT = 16384; // below this a coding agent can't work; refuse the config

/** Input-token count at which the child compacts, for this window and max_tokens. */
export function compactAt(contextWindow: number, maxTokens: number): number {
  return contextWindow - maxTokens - CONTEXT_SAFETY;
}

/** The env that makes the child compact in time; throws if the window can't hold max_tokens. */
export function contextEnv(contextWindow: number, maxTokens: number): Record<string, string> {
  const at = compactAt(contextWindow, maxTokens);
  if (at < MIN_USABLE_INPUT) {
    throw new Error(
      `contextWindow ${contextWindow} is too small for max_tokens ${maxTokens} (leaves ${at} input tokens; need ≥ ${MIN_USABLE_INPUT}) — lower maxOutputTokens/thinking or fix contextWindow`,
    );
  }
  return { CLAUDE_CODE_MAX_CONTEXT_TOKENS: String(at + Math.min(maxTokens, CC_OUTPUT_RESERVE_CAP) + CC_BLOCKING_BUFFER) };
}

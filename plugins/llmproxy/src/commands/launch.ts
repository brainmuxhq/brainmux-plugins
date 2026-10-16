import { spawnSync } from "node:child_process";
import { resolvePaths } from "../core/paths.js";
import { loadBrains, isDirect, DEFAULT_MAX_OUTPUT_TOKENS } from "../core/manifest.js";
import { getKey } from "../core/env.js";
import { masterKeyVar } from "../core/generate.js";
import { readAuthToken } from "../core/authtoken.js";
import { contextEnv } from "../core/context.js";
import { DEFAULT_THINKING, thinkingEnv, type ThinkingLevel } from "../core/thinking.js";

export interface LaunchPlan {
  brain: string;
  model: string;
  base: string;
  direct: boolean;
  thinking: ThinkingLevel | null; // direct brains only; null for a LiteLLM brain
  set: Record<string, string>; // env vars the child `claude` gets
  unset: string[]; // env vars removed from the child (a stale key would win over / conflict with `set`)
}

// Claude Code's model slots. A LiteLLM brain routes any model id (wildcard `*`), but a direct
// endpoint only knows its own model id, so every slot (main, opus/sonnet/haiku/fable aliases,
// background "small fast" model, subagents) must name it.
const MODEL_SLOTS = [
  "ANTHROPIC_MODEL",
  "ANTHROPIC_DEFAULT_OPUS_MODEL",
  "ANTHROPIC_DEFAULT_SONNET_MODEL",
  "ANTHROPIC_DEFAULT_HAIKU_MODEL",
  "ANTHROPIC_DEFAULT_FABLE_MODEL",
  "ANTHROPIC_SMALL_FAST_MODEL",
  "CLAUDE_CODE_SUBAGENT_MODEL",
];

/**
 * Resolve how to run the child `claude` on a brain. `thinking` overrides the brain's
 * configured level (direct brains only — a LiteLLM brain rejects it).
 */
export function planLaunch(brain: string, env: NodeJS.ProcessEnv = process.env, thinking?: ThinkingLevel): LaunchPlan {
  const paths = resolvePaths(env);
  const cfg = loadBrains(paths.brainsYaml);
  const b = cfg.brains[brain];
  if (!b) throw new Error(`unknown brain '${brain}' (have: ${Object.keys(cfg.brains).join(", ")})`);
  const meta = { BRAINMUX_BRAIN: brain, BRAINMUX_MODEL: b.model };

  if (isDirect(b)) {
    // Bearer auth: ANTHROPIC_AUTH_TOKEN. ANTHROPIC_API_KEY would be sent as x-api-key (and
    // take over), so it is removed from the child env.
    const base = b.url.replace(/\/+$/, "");
    const level = thinking ?? b.thinking ?? DEFAULT_THINKING;
    const th = thinkingEnv(level, b.model, b.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS);
    const ctx = b.contextWindow ? contextEnv(b.contextWindow, Number(th.set.CLAUDE_CODE_MAX_OUTPUT_TOKENS)) : {};
    const set: Record<string, string> = {
      ANTHROPIC_BASE_URL: base,
      ANTHROPIC_AUTH_TOKEN: readAuthToken(b.authTokenFile, env.HOME || undefined),
      ...th.set, // thinking budget/effort + CLAUDE_CODE_MAX_OUTPUT_TOKENS
      ...ctx, // CLAUDE_CODE_MAX_CONTEXT_TOKENS (when contextWindow is set)
      ...meta,
    };
    for (const k of MODEL_SLOTS) set[k] = b.model;
    return { brain, model: b.model, base, direct: true, thinking: level, set, unset: ["ANTHROPIC_API_KEY", ...th.unset, ...(b.contextWindow ? [] : ["CLAUDE_CODE_MAX_CONTEXT_TOKENS"])] };
  }
  if (thinking) throw new Error(`--thinking is for direct brains only ('${brain}' is a LiteLLM brain)`);

  const apiKey = getKey(paths.envFile, masterKeyVar(brain));
  if (!apiKey) throw new Error(`${masterKeyVar(brain)} missing in ${paths.envFile} — run \`bmux init\`.`);
  const base = `http://127.0.0.1:${b.port}`;
  return {
    brain, model: b.model, base, direct: false, thinking: null,
    set: { ANTHROPIC_BASE_URL: base, ANTHROPIC_API_KEY: apiKey, ...meta },
    unset: ["ANTHROPIC_AUTH_TOKEN"],
  };
}

/** The child env for a plan: parent env + the plan's vars, minus the ones it unsets. */
export function brainEnv(plan: LaunchPlan, env: NodeJS.ProcessEnv, extra: Record<string, string> = {}): NodeJS.ProcessEnv {
  const out: NodeJS.ProcessEnv = { ...env, ...plan.set, ...extra };
  for (const k of plan.unset) delete out[k];
  return out;
}

export function runLaunch(brain: string, claudeArgs: string[], env: NodeJS.ProcessEnv = process.env): number {
  const plan = planLaunch(brain, env);
  // BRAINMUX_BRAIN/MODEL (in plan.set) let the status line name the active brain from the SSOT
  // the router used — no hardcoded port→name map to drift when brains.yaml changes.
  const r = spawnSync("claude", claudeArgs, { stdio: "inherit", env: brainEnv(plan, env) });
  return r.status ?? 1;
}

import { spawnSync } from "node:child_process";
import { resolvePaths } from "../core/paths.js";
import { loadBrains } from "../core/manifest.js";
import { getKey } from "../core/env.js";
import { masterKeyVar } from "../core/generate.js";

export interface LaunchPlan { base: string; apiKey: string; brain: string; model: string; }

export function planLaunch(brain: string, env: NodeJS.ProcessEnv = process.env): LaunchPlan {
  const paths = resolvePaths(env);
  const cfg = loadBrains(paths.brainsYaml);
  const b = cfg.brains[brain];
  if (!b) throw new Error(`unknown brain '${brain}' (have: ${Object.keys(cfg.brains).join(", ")})`);
  const apiKey = getKey(paths.envFile, masterKeyVar(brain));
  if (!apiKey) throw new Error(`${masterKeyVar(brain)} missing in ${paths.envFile} — run \`bmux init\`.`);
  return { base: `http://127.0.0.1:${b.port}`, apiKey, brain, model: b.model };
}

export function runLaunch(brain: string, claudeArgs: string[], env: NodeJS.ProcessEnv = process.env): number {
  const plan = planLaunch(brain, env);
  const r = spawnSync("claude", claudeArgs, {
    stdio: "inherit",
    // BRAINMUX_BRAIN/MODEL let the status line name the active brain from the SSOT the router
    // used — no hardcoded port→name map to drift when brains.yaml changes.
    env: {
      ...env,
      ANTHROPIC_BASE_URL: plan.base,
      ANTHROPIC_API_KEY: plan.apiKey,
      BRAINMUX_BRAIN: plan.brain,
      BRAINMUX_MODEL: plan.model,
    },
  });
  return r.status ?? 1;
}

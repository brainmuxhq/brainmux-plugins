import { spawnSync } from "node:child_process";
import { resolvePaths } from "../core/paths.js";
import { loadBrains } from "../core/manifest.js";
import { getKey } from "../core/env.js";
import { masterKeyVar } from "../core/generate.js";
export function planLaunch(brain, env = process.env) {
    const paths = resolvePaths(env);
    const cfg = loadBrains(paths.brainsYaml);
    const b = cfg.brains[brain];
    if (!b)
        throw new Error(`unknown brain '${brain}' (have: ${Object.keys(cfg.brains).join(", ")})`);
    const apiKey = getKey(paths.envFile, masterKeyVar(brain));
    if (!apiKey)
        throw new Error(`${masterKeyVar(brain)} missing in ${paths.envFile} — run \`bmux init\`.`);
    return { base: `http://127.0.0.1:${b.port}`, apiKey };
}
export function runLaunch(brain, claudeArgs, env = process.env) {
    const plan = planLaunch(brain, env);
    const r = spawnSync("claude", claudeArgs, {
        stdio: "inherit",
        env: { ...env, ANTHROPIC_BASE_URL: plan.base, ANTHROPIC_API_KEY: plan.apiKey },
    });
    return r.status ?? 1;
}

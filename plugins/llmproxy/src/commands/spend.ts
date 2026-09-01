import { resolvePaths } from "../core/paths.js";
import { loadBrains } from "../core/manifest.js";
import { getKey } from "../core/env.js";
import { masterKeyVar } from "../core/generate.js";
import { aggregateSpend, formatSpend, fetchSpendLogs, type BrainSpend } from "../core/spend.js";

export async function runSpend(_rest: string[] = [], env: NodeJS.ProcessEnv = process.env): Promise<number> {
  const paths = resolvePaths(env);
  const cfg = loadBrains(paths.brainsYaml);
  const results: BrainSpend[] = [];
  const ports: Record<string, number> = {};
  for (const [name, b] of Object.entries(cfg.brains)) {
    ports[name] = b.port;
    const key = getKey(paths.envFile, masterKeyVar(name));
    if (!key) {
      results.push({ brain: name, ok: false, requests: 0, tokens: 0, spend: 0, note: `${masterKeyVar(name)} missing in .env — run \`bmux init\`` });
      continue;
    }
    try {
      results.push(aggregateSpend(name, await fetchSpendLogs(b.port, key)));
    } catch (e) {
      results.push({ brain: name, ok: false, requests: 0, tokens: 0, spend: 0, note: (e as Error).message });
    }
  }
  console.log(formatSpend(results, ports));
  return results.some((r) => r.ok) ? 0 : 1; // non-zero only if no brain was reachable (stack down / no keys)
}

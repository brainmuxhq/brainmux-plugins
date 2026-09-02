import { resolvePaths } from "../core/paths.js";
import { loadBrains } from "../core/manifest.js";
import { getKey } from "../core/env.js";
import { masterKeyVar } from "../core/generate.js";
import { aggregateSpend, formatSpend, fetchSpendLogs, sinceMs, type BrainSpend } from "../core/spend.js";

export async function runSpend(rest: string[] = [], env: NodeJS.ProcessEnv = process.env): Promise<number> {
  const paths = resolvePaths(env);
  const cfg = loadBrains(paths.brainsYaml);
  // `--since <window>` scopes the roll-up to a recent time window (e.g. this session's cost).
  const si = rest.indexOf("--since");
  const since = si >= 0 ? rest[si + 1] : undefined;
  const cutoff = since ? Date.now() - sinceMs(since) : undefined;
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
      results.push(aggregateSpend(name, await fetchSpendLogs(b.port, key), cutoff));
    } catch (e) {
      results.push({ brain: name, ok: false, requests: 0, tokens: 0, spend: 0, note: (e as Error).message });
    }
  }
  if (since) console.log(`spend since ${since}:`);
  console.log(formatSpend(results, ports));
  return results.some((r) => r.ok) ? 0 : 1; // non-zero only if no brain was reachable (stack down / no keys)
}

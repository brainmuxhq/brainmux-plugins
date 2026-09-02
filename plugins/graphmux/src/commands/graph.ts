import { resolvePaths } from "../core/paths.js";
import { resolveBinary, runCodegraph } from "../core/codegraph.js";

// gmux verb → CodeGraph argv. `index` maps to `init -y` (non-interactive first build; this is
// a wrapper for automation/delegates, so we default to no prompts — use `gmux -- init` for the
// interactive form). Everything else maps 1:1.
const VERB: Record<string, string[]> = {
  index: ["init", "-y"],
  status: ["status"],
  sync: ["sync"],
};

// First-class query verbs, so `gmux callers X` works without `--` (and gets our smart defaults).
// `gmux -- <raw>` stays a no-frills escape hatch.
export const GRAPH_VERBS = new Set([
  "index", "status", "sync",
  "callers", "callees", "node", "impact", "explore", "files", "query", "context",
]);

// CodeGraph silently caps `callers`/`node` at `--limit 20` (upstream #1674). Our wrapper injects a
// high default when the user didn't set one, so the silent under-count can't produce false confidence.
// (The core default stays theirs; the smart default is ours — house-style.)
const SMART_LIMITED = new Set(["callers", "node"]);
const DEFAULT_LIMIT = "1000";

// Thin passthroughs to the vendored engine (telemetry forced off inside runCodegraph).
// The binary is downloaded+verified on first use.
export function runGraph(sub: string, argv: string[], env: NodeJS.ProcessEnv = process.env): number {
  const bin = resolveBinary(resolvePaths(env));
  const pre = VERB[sub] ?? [sub];
  const hasLimit = argv.some((a) => a === "--limit" || a.startsWith("--limit="));
  const extra = SMART_LIMITED.has(sub) && !hasLimit ? [...argv, "--limit", DEFAULT_LIMIT] : argv;
  return runCodegraph(bin, [...pre, ...extra], env);
}

// `gmux -- <args...>` — raw passthrough to CodeGraph for anything not surfaced above
// (explore, callers, callees, impact, node, files, …), still with telemetry off.
export function runRaw(argv: string[], env: NodeJS.ProcessEnv = process.env): number {
  const bin = resolveBinary(resolvePaths(env));
  return runCodegraph(bin, argv, env);
}

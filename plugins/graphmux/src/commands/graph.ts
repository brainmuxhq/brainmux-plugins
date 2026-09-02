import { resolvePaths } from "../core/paths.js";
import { resolveBinary, runCodegraph } from "../core/codegraph.js";

// gmux verb → CodeGraph argv. `index` maps to `init -y` (non-interactive first build; this is
// a wrapper for automation/delegates, so we default to no prompts — use `gmux -- init` for the
// interactive form). status/sync pass straight through.
const VERB: Record<string, string[]> = {
  index: ["init", "-y"],
  status: ["status"],
  sync: ["sync"],
};

// Thin passthroughs to the vendored engine (telemetry forced off inside runCodegraph).
// The binary is downloaded+verified on first use.
export function runGraph(sub: string, argv: string[], env: NodeJS.ProcessEnv = process.env): number {
  const bin = resolveBinary(resolvePaths(env));
  const pre = VERB[sub] ?? [sub];
  return runCodegraph(bin, [...pre, ...argv], env);
}

// `gmux -- <args...>` — raw passthrough to CodeGraph for anything not surfaced above
// (explore, callers, callees, impact, node, files, …), still with telemetry off.
export function runRaw(argv: string[], env: NodeJS.ProcessEnv = process.env): number {
  const bin = resolveBinary(resolvePaths(env));
  return runCodegraph(bin, argv, env);
}

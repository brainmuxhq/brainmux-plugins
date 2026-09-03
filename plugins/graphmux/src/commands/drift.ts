import path from "node:path";
import { spawnSync } from "node:child_process";
import { resolvePaths } from "../core/paths.js";
import { resolveBinary, captureCodegraph, syncIndex } from "../core/codegraph.js";
import { buildZoneLayers, resolveZones, parseZoneFlags, type ResolvedZone } from "../core/zones.js";

// `gmux drift <symbol|model>` — Flavor A: deterministic call-graph + auto-grep the graph-BLIND zones,
// keeping only blind-zone lines mentioning the symbol. Static call-graphs are certain for lexical
// calls but blind to ORM/CommonJS-handler/queue/middleware/Next-entry wiring — where drift hides.
// Output: [graph]=certain, [grep-unverified]=verify. Model-scoped sweet spot: `gmux drift Profil`.
//
// Blind zones are a CONFIG CASCADE (see core/zones): defaults < ~/.brainmux/graphmux-zones.json <
// repo .graphmux/zones.json < --zone. An AI using this via the skill should detect the repo's stack
// and inject matching zones (repo config) before drift. `gmux drift --list-zones` shows the resolved set.

export interface DriftArgs {
  symbol: string;
  projectPath: string;
  json: boolean;
  noSync: boolean;
  listZones: boolean;
}

export function parseArgs(argv: string[], cwd: string = process.cwd()): DriftArgs {
  const positional: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--zone") { i++; continue; } // skip its value so it isn't taken as symbol/path
    if (a.startsWith("-")) continue;
    positional.push(a);
  }
  return {
    symbol: positional[0] ?? "",
    projectPath: path.resolve(cwd, positional[1] ?? "."),
    json: argv.includes("--json"),
    noSync: argv.includes("--no-sync"),
    listZones: argv.includes("--list-zones"),
  };
}

// Pure: keep only lines mentioning the symbol (case-insensitive) — the model/symbol scope.
export function filterBySymbol(lines: string[], symbol: string): string[] {
  const s = symbol.toLowerCase();
  return lines.filter((l) => l.toLowerCase().includes(s));
}

// grep the working tree, shell-less (spawnSync array → no glob explosion), skipping vendor/build dirs.
function grepZone(projectPath: string, pattern: string): string[] {
  const r = spawnSync(
    "grep",
    ["-rnE", "--color=never", "--include=*.ts", "--include=*.tsx", "--include=*.js", "--include=*.jsx",
      "--exclude-dir=node_modules", "--exclude-dir=.next", "--exclude-dir=dist", "--exclude-dir=.git",
      "-e", pattern, projectPath],
    { encoding: "utf8", maxBuffer: 10 * 1024 * 1024 },
  );
  if (r.status !== 0) return []; // exit 1 = no match
  return (r.stdout ?? "").trim().split("\n").filter(Boolean);
}

export interface DriftResult {
  symbol: string;
  graph: string;
  zones: { label: string; note: string; source: string; hits: string[] }[];
}

export function collectDrift(projectPath: string, symbol: string, graph: string, zones: ResolvedZone[]): DriftResult {
  const found = zones
    .map((z) => ({ label: z.label, note: z.note, source: z.source, hits: filterBySymbol(grepZone(projectPath, z.re), symbol) }))
    .filter((z) => z.hits.length > 0);
  return { symbol, graph: graph.trim(), zones: found };
}

function render(r: DriftResult): string {
  const out: string[] = [`\n═══ [graph] ${r.symbol} — kesin (callers + impact) ═══`];
  out.push(r.graph || "  (grafta kayıt yok)");
  out.push(`\n═══ [grep-unverified] ${r.symbol} — graph-körü zonlar · DOĞRULA ═══`);
  if (r.zones.length === 0) {
    out.push("  temiz (bu sembolü içeren aktif kör-zon deseni yok).");
  } else {
    for (const z of r.zones) {
      out.push(`\n[${z.label}] — ${z.note}`);
      for (const h of z.hits) out.push("  " + h);
    }
  }
  out.push("\n⚠ [grep-unverified] = aday, kesin değil — graph bu wiring'i bağlayamaz, elle doğrula.");
  out.push("  zonlar: repo .graphmux/zones.json · ~/.brainmux/graphmux-zones.json · --zone label=regex  (gmux drift --list-zones)");
  return out.join("\n") + "\n";
}

export async function runDrift(argv: string[], env: NodeJS.ProcessEnv = process.env): Promise<number> {
  const { symbol, projectPath, json, noSync, listZones } = parseArgs(argv);
  const layers = buildZoneLayers(resolvePaths(env).home, projectPath, parseZoneFlags(argv));
  const { zones, warnings } = resolveZones(layers);
  for (const w of warnings) process.stderr.write(`gmux drift: zon atlandı — ${w}\n`);

  // Introspection — resolved zones + their source (config-cascade debug).
  if (listZones) {
    if (json) {
      process.stdout.write(JSON.stringify(zones, null, 2) + "\n");
      return 0;
    }
    process.stdout.write(`Aktif kör-zonlar (${zones.length}) — cascade: default < user < repo < --zone\n`);
    for (const z of zones) process.stdout.write(`  ${z.label.padEnd(14)} [${z.source}]  ${z.re}\n`);
    return 0;
  }

  if (!symbol) {
    process.stderr.write("gmux drift <symbol|model> [path] [--zone label=regex] [--list-zones]\n");
    return 1;
  }
  if (!noSync) syncIndex(projectPath);

  let graph = "";
  try {
    const bin = resolveBinary(resolvePaths(env));
    const callers = captureCodegraph(bin, ["callers", symbol, "--limit", "1000"]).stdout.trim();
    const impact = captureCodegraph(bin, ["impact", symbol, "--limit", "1000"]).stdout.trim();
    graph = [callers, impact].filter(Boolean).join("\n\n");
  } catch {
    graph = "";
  }

  const result = collectDrift(projectPath, symbol, graph, zones);
  process.stdout.write(json ? JSON.stringify(result, null, 2) + "\n" : render(result));
  return 0;
}

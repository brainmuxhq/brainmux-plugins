import fs from "node:fs";
import path from "node:path";

// Blind-zone registry with a layered config cascade (the ESLint/Prettier/tsconfig pattern):
// built-in defaults < user global < repo-local < CLI flags. Same label overrides; `enabled:false`
// disables an inherited zone. Every resolved zone carries its source (for `--list-zones` + errors).
// Frameworks/versions change, so the defaults are just defaults — teams own their zones in-repo.

export interface BlindZone {
  label: string;
  re: string; // ERE for grep -E; must also compile as a JS RegExp (validated)
  note?: string;
  enabled?: boolean; // default true; false removes an inherited zone
}

export interface ResolvedZone {
  label: string;
  re: string;
  note: string;
  source: string;
}

// Sensible defaults for a JS/TS Node stack. Everything here is overridable per repo/user.
export const DEFAULT_BLIND_ZONES: BlindZone[] = [
  { label: "orm", re: "\\.(create|findUnique|findFirst|findMany|update|updateMany|delete|deleteMany|upsert)\\(", note: "ORM DB blast-radius çağrı-grafında yok" },
  { label: "cjs-handler", re: "exports\\.[A-Za-z0-9_]+ *= *async", note: "CommonJS route handler graph'ta görünmez" },
  { label: "queue", re: "\\.(send|work)\\(", note: "enqueue↔worker kenarı kopuk" },
  { label: "middleware", re: "app\\.use\\(", note: "middleware zinciri call-less" },
  { label: "next-entry", re: "getServerSideProps|getStaticProps|getStaticPaths|getInitialProps", note: "Next entry-point call-less" },
];

export interface ZoneLayer {
  source: string;
  zones: unknown[]; // raw (validated per-entry) so a bad file can't crash resolution
}

// Pure: validate one raw zone. Returns the clean zone or an error string (never throws).
export function validateZone(raw: unknown): { zone?: BlindZone; error?: string } {
  if (!raw || typeof raw !== "object") return { error: "zone is not an object" };
  const o = raw as Record<string, unknown>;
  if (typeof o.label !== "string" || !o.label.trim()) return { error: "zone missing non-empty 'label'" };
  if (o.enabled === false) return { zone: { label: o.label, re: "", note: "", enabled: false } };
  if (typeof o.re !== "string" || !o.re) return { error: `zone '${o.label}': missing 're'` };
  try {
    new RegExp(o.re);
  } catch (e) {
    return { error: `zone '${o.label}': invalid regex — ${e instanceof Error ? e.message : String(e)}` };
  }
  return { zone: { label: o.label, re: o.re, note: typeof o.note === "string" ? o.note : "", enabled: true } };
}

// Pure cascade: merge layers low→high by label. `enabled:false` removes an inherited label.
// Invalid entries are collected as warnings (skipped, not fatal). Returns resolved zones + warnings.
export function resolveZones(layers: ZoneLayer[]): { zones: ResolvedZone[]; warnings: string[] } {
  const byLabel = new Map<string, ResolvedZone>();
  const warnings: string[] = [];
  for (const layer of layers) {
    for (const raw of layer.zones) {
      const { zone, error } = validateZone(raw);
      if (error) {
        warnings.push(`[${layer.source}] ${error}`);
        continue;
      }
      if (zone!.enabled === false) {
        byLabel.delete(zone!.label);
        continue;
      }
      byLabel.set(zone!.label, { label: zone!.label, re: zone!.re, note: zone!.note ?? "", source: layer.source });
    }
  }
  return { zones: [...byLabel.values()], warnings };
}

// Pure: `--zone "label=regex"` (repeatable) → raw zones (validated later in the cascade).
export function parseZoneFlags(argv: string[]): BlindZone[] {
  const out: BlindZone[] = [];
  for (let i = 0; i < argv.length; i++) {
    let spec: string | undefined;
    if (argv[i].startsWith("--zone=")) spec = argv[i].slice("--zone=".length);
    else if (argv[i] === "--zone") spec = argv[i + 1];
    if (!spec) continue;
    const eq = spec.indexOf("=");
    if (eq <= 0) continue;
    out.push({ label: spec.slice(0, eq).trim(), re: spec.slice(eq + 1).trim(), note: "--zone flag" });
  }
  return out;
}

// IO: read a JSON zone file (array). Missing/bad file → []; malformed entries surface later as warnings.
export function loadJsonZones(file: string): unknown[] {
  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// The cascade sources (low→high precedence). Repo config is team-shared (checked in).
export function buildZoneLayers(homeDir: string, projectPath: string, cliZones: BlindZone[]): ZoneLayer[] {
  return [
    { source: "default", zones: DEFAULT_BLIND_ZONES },
    { source: "user:~/.brainmux/graphmux-zones.json", zones: loadJsonZones(path.join(homeDir, "graphmux-zones.json")) },
    { source: "repo:.graphmux/zones.json", zones: loadJsonZones(path.join(projectPath, ".graphmux", "zones.json")) },
    { source: "--zone", zones: cliZones },
  ];
}

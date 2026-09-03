#!/usr/bin/env node
// version-sync guard — a plugin's version lives in THREE files that must never drift:
//   .claude-plugin/marketplace.json  (the marketplace listing users see)
//   plugins/<name>/package.json
//   plugins/<name>/.claude-plugin/plugin.json
// SSoT invariant: "one version per plugin". CI runs this and fails the build on any mismatch, so a
// forgotten bump (e.g. the marketplace lagging the plugin) can't reach main silently — the exact
// drift that let the graphmux listing sit at 0.1.6 while the plugin shipped 0.2.3.
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => JSON.parse(readFileSync(join(ROOT, p), "utf8"));

const market = read(".claude-plugin/marketplace.json");
const problems = [];

for (const p of market.plugins) {
  const pkg = read(`plugins/${p.name}/package.json`);
  const man = read(`plugins/${p.name}/.claude-plugin/plugin.json`);
  const versions = {
    "marketplace.json": p.version,
    "package.json": pkg.version,
    "plugin.json": man.version,
  };
  if (new Set(Object.values(versions)).size !== 1) {
    problems.push(
      `${p.name}: version drift → ` +
        Object.entries(versions)
          .map(([f, v]) => `${f}=${v}`)
          .join(" · "),
    );
  }
}

if (problems.length) {
  console.error("✗ version-sync guard FAILED:");
  for (const p of problems) console.error("  " + p);
  console.error("\nBump all three files together (package.json + plugin.json + marketplace.json).");
  process.exit(1);
}
console.log(`✓ version-sync: all ${market.plugins.length} plugin versions aligned`);

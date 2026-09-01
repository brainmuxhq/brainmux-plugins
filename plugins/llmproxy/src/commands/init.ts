import fs from "node:fs";
import path from "node:path";
import { resolvePaths, type Paths } from "../core/paths.js";
import { parseBrains, type BrainsConfig } from "../core/manifest.js";
import { generate, masterKeyVar } from "../core/generate.js";
import { readEnv, writeEnv, genSecret } from "../core/env.js";

// The default brains.yaml written on first `bmux init`. Embedded as a constant (not read
// from a file) so it resolves identically whether the CLI runs from the tsc output or the
// shipped esbuild bundle — no import.meta.url/path-depth fragility. Mirrors the templating
// approach in core/generate.ts.
const DEFAULT_BRAINS_YAML = `version: 1
brains:
  chat:  { port: 4567, model: openrouter/qwen/qwen3.7-flash,    providerKey: OPENROUTER_API_KEY }
  deep:  { port: 4568, model: openrouter/z-ai/glm-5.2,          providerKey: OPENROUTER_API_KEY }
  coder: { port: 4569, model: openrouter/qwen/qwen3-coder-next, providerKey: OPENROUTER_API_KEY }
`;

export function writeGenerated(paths: Paths, cfg: BrainsConfig): void {
  const g = generate(cfg);
  fs.mkdirSync(paths.initDir, { recursive: true });
  fs.writeFileSync(paths.composeYaml, g.compose);
  for (const [brain, cfgText] of Object.entries(g.configs)) {
    fs.writeFileSync(paths.brainConfig(brain), cfgText);
  }
  fs.writeFileSync(path.join(paths.initDir, "01-databases.sql"), g.initSql);
}

export function ensureSecrets(paths: Paths, cfg: BrainsConfig): void {
  const env = readEnv(paths.envFile);
  const putIfAbsent = (k: string, v: () => string) => { if (!env.get(k)) env.set(k, v()); };
  putIfAbsent("POSTGRES_PASSWORD", () => genSecret());
  putIfAbsent("LITELLM_SALT_KEY", () => "sk-salt-" + genSecret());
  for (const brain of Object.keys(cfg.brains)) {
    putIfAbsent(masterKeyVar(brain), () => `sk-${brain}-` + genSecret());
    // provider keys are user-supplied; leave a placeholder only if absent
    putIfAbsent(cfg.brains[brain].providerKey, () => "");
  }
  writeEnv(paths.envFile, env);
}

export function runInit(env: NodeJS.ProcessEnv = process.env): number {
  const paths = resolvePaths(env);
  fs.mkdirSync(paths.home, { recursive: true });
  fs.mkdirSync(paths.dataDir, { recursive: true });

  if (!fs.existsSync(paths.brainsYaml)) {
    fs.writeFileSync(paths.brainsYaml, DEFAULT_BRAINS_YAML);
  }
  const cfg = parseBrains(fs.readFileSync(paths.brainsYaml, "utf8"));
  ensureSecrets(paths, cfg);
  writeGenerated(paths, cfg);

  console.log(`bmux: initialized ${paths.home}`);
  console.log(`  brains.yaml, .env (chmod 600), generated/ written.`);
  const missing = Object.values(cfg.brains).map((b) => b.providerKey)
    .filter((k, i, a) => a.indexOf(k) === i)
    .filter((k) => !readEnv(paths.envFile).get(k));
  if (missing.length) {
    console.log(`  next: add provider key(s): ${missing.map((k) => `bmux config add-key ${k} <value>`).join("  ")}`);
  }
  return 0;
}

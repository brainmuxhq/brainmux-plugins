import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolvePaths } from "../core/paths.js";
import { parseBrains } from "../core/manifest.js";
import { generate, masterKeyVar } from "../core/generate.js";
import { readEnv, writeEnv, genSecret } from "../core/env.js";
const here = path.dirname(fileURLToPath(import.meta.url));
// dist/src/commands -> package root -> templates/
const templatesDir = path.resolve(here, "../../../templates");
export function writeGenerated(paths, cfg) {
    const g = generate(cfg);
    fs.mkdirSync(paths.initDir, { recursive: true });
    fs.writeFileSync(paths.composeYaml, g.compose);
    for (const [brain, cfgText] of Object.entries(g.configs)) {
        fs.writeFileSync(paths.brainConfig(brain), cfgText);
    }
    fs.writeFileSync(path.join(paths.initDir, "01-databases.sql"), g.initSql);
}
export function ensureSecrets(paths, cfg) {
    const env = readEnv(paths.envFile);
    const putIfAbsent = (k, v) => { if (!env.get(k))
        env.set(k, v()); };
    putIfAbsent("POSTGRES_PASSWORD", () => genSecret());
    putIfAbsent("LITELLM_SALT_KEY", () => "sk-salt-" + genSecret());
    for (const brain of Object.keys(cfg.brains)) {
        putIfAbsent(masterKeyVar(brain), () => `sk-${brain}-` + genSecret());
        // provider keys are user-supplied; leave a placeholder only if absent
        putIfAbsent(cfg.brains[brain].providerKey, () => "");
    }
    writeEnv(paths.envFile, env);
}
export function runInit(env = process.env) {
    const paths = resolvePaths(env);
    fs.mkdirSync(paths.home, { recursive: true });
    fs.mkdirSync(paths.dataDir, { recursive: true });
    if (!fs.existsSync(paths.brainsYaml)) {
        fs.copyFileSync(path.join(templatesDir, "brains.default.yaml"), paths.brainsYaml);
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

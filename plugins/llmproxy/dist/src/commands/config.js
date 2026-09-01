import fs from "node:fs";
import YAML from "yaml";
import { resolvePaths } from "../core/paths.js";
import { parseBrains } from "../core/manifest.js";
import { writeGenerated, ensureSecrets } from "./init.js";
import { setKey } from "../core/env.js";
function load(paths) {
    return parseBrains(fs.readFileSync(paths.brainsYaml, "utf8"));
}
function save(paths, cfg) {
    // validate the mutated object before persisting, then regenerate
    const validated = parseBrains(YAML.stringify(cfg));
    fs.writeFileSync(paths.brainsYaml, YAML.stringify(validated));
    ensureSecrets(paths, validated);
    writeGenerated(paths, validated);
}
export function addBrain(paths, name, port, model, providerKey) {
    const cfg = load(paths);
    if (cfg.brains[name])
        throw new Error(`brain '${name}' already exists`);
    for (const [n, b] of Object.entries(cfg.brains)) {
        if (b.port === port)
            throw new Error(`port ${port} already used by '${n}'`);
    }
    cfg.brains[name] = { port, model, providerKey };
    save(paths, cfg);
}
export function runConfig(sub, rest, env = process.env) {
    const paths = resolvePaths(env);
    try {
        switch (sub) {
            case "add-brain": {
                const [name, portStr, model, providerKey = "OPENROUTER_API_KEY"] = rest;
                if (!name || !portStr || !model)
                    throw new Error("usage: bmux config add-brain <name> <port> <model> [providerKey]");
                addBrain(paths, name, Number(portStr), model, providerKey);
                console.log(`added brain '${name}' on :${portStr}`);
                return 0;
            }
            case "remove-brain": {
                const [name] = rest;
                const cfg = load(paths);
                if (!cfg.brains[name])
                    throw new Error(`no such brain '${name}'`);
                delete cfg.brains[name];
                save(paths, cfg);
                console.log(`removed brain '${name}' (its DB + master key remain in .env / data)`);
                return 0;
            }
            case "set-model": {
                const [name, model] = rest;
                const cfg = load(paths);
                if (!cfg.brains[name])
                    throw new Error(`no such brain '${name}'`);
                cfg.brains[name].model = model;
                save(paths, cfg);
                console.log(`set '${name}' model = ${model}`);
                return 0;
            }
            case "add-key": {
                const [key, value] = rest;
                if (!key || value === undefined)
                    throw new Error("usage: bmux config add-key <ENV_VAR> <value>");
                setKey(paths.envFile, key, value);
                console.log(`set ${key} in .env`);
                return 0;
            }
            case "list": {
                const cfg = load(paths);
                for (const [name, b] of Object.entries(cfg.brains)) {
                    console.log(`${name.padEnd(8)} :${b.port}  ${b.model}  (${b.providerKey})`);
                }
                return 0;
            }
            default:
                process.stderr.write(`bmux config: unknown subcommand '${sub}'\n`);
                return 1;
        }
    }
    catch (e) {
        process.stderr.write(`bmux config: ${e.message}\n`);
        return 1;
    }
}

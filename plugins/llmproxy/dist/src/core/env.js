import fs from "node:fs";
import crypto from "node:crypto";
export function parseEnv(text) {
    const map = new Map();
    for (const line of text.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#"))
            continue;
        const eq = trimmed.indexOf("=");
        if (eq < 1)
            continue;
        map.set(trimmed.slice(0, eq).trim(), trimmed.slice(eq + 1));
    }
    return map;
}
export function readEnv(file) {
    try {
        return parseEnv(fs.readFileSync(file, "utf8"));
    }
    catch {
        return new Map();
    }
}
export function writeEnv(file, map) {
    const body = [...map.entries()].map(([k, v]) => `${k}=${v}`).join("\n") + "\n";
    fs.writeFileSync(file, body, { mode: 0o600 });
    fs.chmodSync(file, 0o600); // enforce even if file pre-existed with looser mode
}
export function getKey(file, key) {
    return readEnv(file).get(key);
}
export function setKey(file, key, value) {
    const map = readEnv(file);
    map.set(key, value);
    writeEnv(file, map);
}
export function genSecret(bytes = 16) {
    return crypto.randomBytes(bytes).toString("hex");
}

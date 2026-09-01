import { resolvePaths } from "../core/paths.js";
import { loadBrains } from "../core/manifest.js";
import { ensureDocker, runCompose, liveliness } from "../core/docker.js";
import { writeGenerated } from "./init.js";
export async function runStack(sub, rest, env = process.env) {
    const paths = resolvePaths(env);
    if (sub === "up" || sub === "restart") {
        ensureDocker();
        const cfg = loadBrains(paths.brainsYaml);
        writeGenerated(paths, cfg); // regenerate from SSOT before (re)starting
        const args = sub === "restart" ? ["up", "-d", "--force-recreate"] : ["up", "-d"];
        return runCompose(paths, args);
    }
    if (sub === "down") {
        ensureDocker();
        return runCompose(paths, ["down"]);
    }
    if (sub === "ps") {
        ensureDocker();
        return runCompose(paths, ["ps"]);
    }
    if (sub === "logs") {
        ensureDocker();
        return runCompose(paths, ["logs", "-f", ...rest]);
    }
    if (sub === "health") {
        const cfg = loadBrains(paths.brainsYaml);
        let fail = 0;
        for (const [name, b] of Object.entries(cfg.brains)) {
            const ok = await liveliness(b.port);
            process.stdout.write(`${name.padEnd(8)} ${ok ? "UP  " : "DOWN"} (:${b.port})\n`);
            if (!ok)
                fail = 1;
        }
        return fail;
    }
    process.stderr.write(`bmux: unknown stack command '${sub}'\n`);
    return 1;
}

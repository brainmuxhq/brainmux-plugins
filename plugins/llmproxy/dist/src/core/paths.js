import os from "node:os";
import path from "node:path";
export function resolvePaths(env = process.env) {
    const home = env.BRAINMUX_HOME?.trim() || path.join(os.homedir(), ".brainmux");
    const generatedDir = path.join(home, "generated");
    return {
        home,
        brainsYaml: path.join(home, "brains.yaml"),
        envFile: path.join(home, ".env"),
        generatedDir,
        composeYaml: path.join(generatedDir, "compose.yaml"),
        initDir: path.join(generatedDir, "init"),
        dataDir: path.join(home, "data", "postgres"),
        brainConfig: (name) => path.join(generatedDir, `${name}.yaml`),
    };
}

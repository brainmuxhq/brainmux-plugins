import os from "node:os";
import path from "node:path";

export interface Paths {
  home: string;
  brainsYaml: string;
  envFile: string;
  generatedDir: string;
  composeYaml: string;
  initDir: string;
  dataDir: string;
  brainConfig(name: string): string;
}

export function resolvePaths(env: NodeJS.ProcessEnv = process.env): Paths {
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
    brainConfig: (name: string) => path.join(generatedDir, `${name}.yaml`),
  };
}

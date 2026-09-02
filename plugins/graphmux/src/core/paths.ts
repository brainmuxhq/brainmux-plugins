import os from "node:os";
import path from "node:path";

// State lives under BRAINMUX_HOME (default ~/.brainmux), same split as llmproxy:
// code = plugin (versioned), state = ~/.brainmux. The vendored CodeGraph binary is cached
// per-version under graphmux/, and the delegate-facing MCP config is written to generated/.
export interface Paths {
  home: string;
  graphmuxDir: string;
  binCache(version: string): string;
  mcpConfig: string;
}

export function resolvePaths(env: NodeJS.ProcessEnv = process.env): Paths {
  const home = env.BRAINMUX_HOME?.trim() || path.join(os.homedir(), ".brainmux");
  const graphmuxDir = path.join(home, "graphmux");
  return {
    home,
    graphmuxDir,
    binCache: (version: string) => path.join(graphmuxDir, version),
    mcpConfig: path.join(home, "generated", "graphmux-mcp.json"),
  };
}

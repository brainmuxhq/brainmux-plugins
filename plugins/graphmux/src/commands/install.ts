import fs from "node:fs";
import path from "node:path";
import { resolvePaths } from "../core/paths.js";
import { resolveBinary, CODEGRAPH_VERSION } from "../core/codegraph.js";
import { buildMcpConfig, MCP_SERVER_NAME } from "../core/mcp.js";

// `gmux install` — download + SHA256-verify + cache the pinned CodeGraph binary (telemetry off),
// then write the brainmux-owned MCP config that `bmux delegate --memory` (and any Claude Code
// session pointed at it) uses. No hidden network beyond the one pinned artifact fetch.
export function runInstall(_argv: string[], env: NodeJS.ProcessEnv = process.env): number {
  const paths = resolvePaths(env);
  process.stdout.write(`graphmux: installing CodeGraph v${CODEGRAPH_VERSION} (telemetry off)\n`);
  const bin = resolveBinary(paths, (s) => process.stdout.write(`  ${s}\n`));

  const cfg = buildMcpConfig(bin);
  fs.mkdirSync(path.dirname(paths.mcpConfig), { recursive: true });
  fs.writeFileSync(paths.mcpConfig, JSON.stringify(cfg, null, 2) + "\n");

  process.stdout.write(
    `✓ binary:     ${bin}\n` +
      `✓ mcp config: ${paths.mcpConfig} (server "${MCP_SERVER_NAME}")\n` +
      `  next: gmux index <repo>  ·  bmux delegate <brain> --memory "<task>"\n`,
  );
  return 0;
}

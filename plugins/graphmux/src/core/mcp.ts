import { TELEMETRY_OFF } from "./codegraph.js";

// The MCP server graphmux exposes to Claude Code / bmux delegates. We run the vendored engine
// as `codegraph serve --mcp` (stdio, grounded on `codegraph install --print-config claude`) but
// name the server "graphmux" — our wrapper owns the surface, not the vendored core's name (this
// also avoids clashing with a user's own separately-installed "codegraph" MCP).
export const MCP_SERVER_NAME = "graphmux";

// Read-only graph tools the delegate is pre-allowed to call for grounding (no edits). This list
// IS the cross-plugin contract with llmproxy (`bmux delegate --memory`); the two must stay identical.
// Namespaced mcp__<server>__<tool> → mcp__graphmux__<codegraph tool>.
export const GROUNDING_TOOLS = [
  "mcp__graphmux__codegraph_explore",
  "mcp__graphmux__codegraph_callers",
  "mcp__graphmux__codegraph_callees",
  "mcp__graphmux__codegraph_impact",
  "mcp__graphmux__codegraph_node",
  "mcp__graphmux__codegraph_search",
  "mcp__graphmux__codegraph_files",
];

export interface McpServerEntry {
  type: "stdio";
  command: string;
  args: string[];
  env: Record<string, string>;
}
export interface McpConfig {
  mcpServers: Record<string, McpServerEntry>;
}

// Pure: build the mcp.json object. `projectPath` is optional — in MCP mode CodeGraph can use
// the client's rootUri, but pinning it makes a headless delegate deterministic.
export function buildMcpConfig(bin: string, projectPath?: string): McpConfig {
  const args = ["serve", "--mcp"];
  if (projectPath) args.push("-p", projectPath);
  return { mcpServers: { [MCP_SERVER_NAME]: { type: "stdio", command: bin, args, env: { ...TELEMETRY_OFF } } } };
}

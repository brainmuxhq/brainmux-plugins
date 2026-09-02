import { test } from "node:test";
import assert from "node:assert/strict";
import { buildMcpConfig, MCP_SERVER_NAME, GROUNDING_TOOLS } from "../src/core/mcp.js";

test("buildMcpConfig: stdio 'graphmux' server running `serve --mcp`, telemetry off", () => {
  const cfg = buildMcpConfig("/cache/codegraph-linux-x64/bin/codegraph");
  assert.equal(MCP_SERVER_NAME, "graphmux"); // our wrapper owns the surface name, not the vendored core's
  const entry = cfg.mcpServers[MCP_SERVER_NAME];
  assert.ok(entry, "graphmux server present");
  assert.equal(entry.type, "stdio");
  assert.equal(entry.command, "/cache/codegraph-linux-x64/bin/codegraph");
  assert.deepEqual(entry.args, ["serve", "--mcp"]);
  assert.equal(entry.env.DO_NOT_TRACK, "1");
  assert.equal(entry.env.CODEGRAPH_TELEMETRY, "0");
});

test("buildMcpConfig: projectPath pins -p for a deterministic headless delegate", () => {
  const cfg = buildMcpConfig("/bin/codegraph", "/repo");
  assert.deepEqual(cfg.mcpServers[MCP_SERVER_NAME].args, ["serve", "--mcp", "-p", "/repo"]);
});

test("GROUNDING_TOOLS are namespaced under our server (mcp__graphmux__) incl. explore", () => {
  assert.ok(GROUNDING_TOOLS.includes("mcp__graphmux__codegraph_explore"));
  assert.ok(GROUNDING_TOOLS.every((t) => t.startsWith("mcp__graphmux__")));
});

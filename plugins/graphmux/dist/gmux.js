#!/usr/bin/env node
import{createRequire as __cr}from'module';const require=__cr(import.meta.url);

// src/cli.ts
import { fileURLToPath } from "node:url";

// src/commands/install.ts
import fs2 from "node:fs";
import path3 from "node:path";

// src/core/paths.ts
import os from "node:os";
import path from "node:path";
function resolvePaths(env = process.env) {
  const home = env.BRAINMUX_HOME?.trim() || path.join(os.homedir(), ".brainmux");
  const graphmuxDir = path.join(home, "graphmux");
  return {
    home,
    graphmuxDir,
    binCache: (version) => path.join(graphmuxDir, version),
    mcpConfig: path.join(home, "generated", "graphmux-mcp.json")
  };
}

// src/core/codegraph.ts
import fs from "node:fs";
import path2 from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
var CODEGRAPH_VERSION = "1.6.0";
var CODEGRAPH_SHA256 = {
  "linux-x64": "de3391f79ed42622d937e6cd5b7642a7ea8bb7d1473607e80b879ba73ef216b0",
  "linux-arm64": "6dc935a7b8f1a61e688a578b98ea34680eb2e36d7b91db079d64f4011f1a668f",
  "darwin-x64": "cb86a2b62ee676b62a56bf8423600e7d867e752e57f323cdc98c0f6236efd908",
  "darwin-arm64": "1c73033512d55f67be04717e81532e8beaf7be6fb8531f51a179fa23064ad480",
  "win32-x64": "cd76c3c3391f2d40abef12b142151950b6d77abc2d8429e648f89eaa90f5b68a",
  "win32-arm64": "3ca980010bd718a6b5e75be1145806ae6491afb1a59a2cec6cee4bf5c39f1b3a"
};
var MIRROR_BASE = `https://github.com/brainmuxhq/brainmux/releases/download/codegraph-v${CODEGRAPH_VERSION}`;
var UPSTREAM_BASE = "https://github.com/colbymchenry/codegraph/releases/download";
var TELEMETRY_OFF = {
  DO_NOT_TRACK: "1",
  CODEGRAPH_TELEMETRY: "0",
  CODEGRAPH_NO_UPDATE_CHECK: "1"
};
function platformKey(platform = process.platform, arch = process.arch) {
  const key = `${platform}-${arch}`;
  if (!(key in CODEGRAPH_SHA256)) {
    throw new Error(`graphmux: unsupported platform '${key}' (supported: ${Object.keys(CODEGRAPH_SHA256).join(", ")})`);
  }
  return key;
}
function assetName(key) {
  return key.startsWith("win32-") ? `codegraph-${key}.zip` : `codegraph-${key}.tar.gz`;
}
function assetUrl(key, source) {
  const name = assetName(key);
  return source === "mirror" ? `${MIRROR_BASE}/${name}` : `${UPSTREAM_BASE}/v${CODEGRAPH_VERSION}/${name}`;
}
function sha256Hex(buf) {
  return crypto.createHash("sha256").update(buf).digest("hex");
}
function verifySha(buf, expected) {
  const got = sha256Hex(buf);
  if (got.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(got), Buffer.from(expected));
}
function binPath(cacheDir, key = platformKey()) {
  const exe = key.startsWith("win32-") ? "codegraph.exe" : "codegraph";
  return path2.join(cacheDir, `codegraph-${key}`, "bin", exe);
}
function have(cmd) {
  return spawnSync(cmd, ["--version"], { stdio: "ignore" }).status === 0;
}
function install(paths, log = () => {
}) {
  const key = platformKey();
  const cacheDir = paths.binCache(CODEGRAPH_VERSION);
  const dest = binPath(cacheDir, key);
  if (fs.existsSync(dest)) return dest;
  if (!have("curl")) throw new Error("graphmux: `curl` not found \u2014 needed to download the CodeGraph binary");
  if (!have("tar")) throw new Error("graphmux: `tar` not found \u2014 needed to extract the CodeGraph binary");
  fs.mkdirSync(cacheDir, { recursive: true });
  const archive = path2.join(cacheDir, assetName(key));
  const urls = [MIRROR_BASE ? assetUrl(key, "mirror") : "", assetUrl(key, "upstream")].filter(Boolean);
  let ok = false;
  let lastErr = "";
  for (const url of urls) {
    log(`\u2193 ${url}`);
    const r = spawnSync("curl", ["-fsSL", "-o", archive, url], { stdio: ["ignore", "ignore", "pipe"] });
    if (r.status === 0 && fs.existsSync(archive)) {
      ok = true;
      break;
    }
    lastErr = r.stderr?.toString().trim() || `curl exit ${r.status}`;
  }
  if (!ok) throw new Error(`graphmux: download failed \u2014 ${lastErr}`);
  if (!verifySha(fs.readFileSync(archive), CODEGRAPH_SHA256[key])) {
    fs.rmSync(archive, { force: true });
    throw new Error(`graphmux: SHA256 mismatch for ${assetName(key)} \u2014 refusing to use it`);
  }
  log(`\u2713 sha256 ${CODEGRAPH_SHA256[key].slice(0, 12)}\u2026 verified`);
  const tarArgs = key.startsWith("win32-") ? ["-xf", archive, "-C", cacheDir] : ["xzf", archive, "-C", cacheDir];
  if (spawnSync("tar", tarArgs, { stdio: "inherit" }).status !== 0) {
    throw new Error(`graphmux: extract failed (tar) for ${assetName(key)}`);
  }
  fs.rmSync(archive, { force: true });
  if (!fs.existsSync(dest)) throw new Error(`graphmux: extracted but binary not found at ${dest}`);
  fs.chmodSync(dest, 493);
  return dest;
}
function resolveBinary(paths, log) {
  return install(paths, log);
}
function runCodegraph(bin, args, env = process.env) {
  const r = spawnSync(bin, args, { stdio: "inherit", env: { ...env, ...TELEMETRY_OFF } });
  return r.status ?? 1;
}

// src/core/mcp.ts
var MCP_SERVER_NAME = "graphmux";
function buildMcpConfig(bin, projectPath) {
  const args = ["serve", "--mcp"];
  if (projectPath) args.push("-p", projectPath);
  return { mcpServers: { [MCP_SERVER_NAME]: { type: "stdio", command: bin, args, env: { ...TELEMETRY_OFF } } } };
}

// src/commands/install.ts
function runInstall(_argv, env = process.env) {
  const paths = resolvePaths(env);
  process.stdout.write(`graphmux: installing CodeGraph v${CODEGRAPH_VERSION} (telemetry off)
`);
  const bin = resolveBinary(paths, (s) => process.stdout.write(`  ${s}
`));
  const cfg = buildMcpConfig(bin);
  fs2.mkdirSync(path3.dirname(paths.mcpConfig), { recursive: true });
  fs2.writeFileSync(paths.mcpConfig, JSON.stringify(cfg, null, 2) + "\n");
  process.stdout.write(
    `\u2713 binary:     ${bin}
\u2713 mcp config: ${paths.mcpConfig} (server "${MCP_SERVER_NAME}")
  next: gmux index <repo>  \xB7  bmux delegate <brain> --memory "<task>"
`
  );
  return 0;
}

// src/commands/graph.ts
var VERB = {
  index: ["init", "-y"],
  status: ["status"],
  sync: ["sync"]
};
function runGraph(sub, argv, env = process.env) {
  const bin = resolveBinary(resolvePaths(env));
  const pre = VERB[sub] ?? [sub];
  return runCodegraph(bin, [...pre, ...argv], env);
}
function runRaw(argv, env = process.env) {
  const bin = resolveBinary(resolvePaths(env));
  return runCodegraph(bin, argv, env);
}

// src/cli.ts
var HELP = `gmux \u2014 brainmux/graphmux CLI (local codebase memory; vendors CodeGraph v${CODEGRAPH_VERSION})

  gmux install                    download + SHA256-verify the pinned CodeGraph binary (telemetry off),
                                  then write the "graphmux" MCP config for delegates / Claude Code
  gmux index [path]               build/rebuild the code graph for a repo
  gmux status [path]              show index status (files, nodes, edges, staleness)
  gmux sync [path]                sync changes since last index
  gmux -- <codegraph args...>     raw passthrough to the vendored engine (explore, callers, impact, \u2026)

  then: bmux delegate <brain> --memory "<task>"   (llmproxy grounds the cheap brain on the graph)
`;
var PASSTHRU = /* @__PURE__ */ new Set(["index", "status", "sync"]);
async function main(argv, env = process.env) {
  const cmd = argv[0];
  const rest = argv.slice(1);
  if (!cmd || cmd === "-h" || cmd === "--help") {
    process.stdout.write(HELP);
    return 0;
  }
  try {
    if (cmd === "install") return runInstall(rest, env);
    if (cmd === "--") return runRaw(rest, env);
    if (PASSTHRU.has(cmd)) return runGraph(cmd, rest, env);
    process.stderr.write(`gmux: unknown command '${cmd}'

${HELP}`);
    return 1;
  } catch (e) {
    process.stderr.write(`gmux: ${e instanceof Error ? e.message : String(e)}
`);
    return 1;
  }
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main(process.argv.slice(2)).then((code) => process.exit(code));
}
export {
  main
};

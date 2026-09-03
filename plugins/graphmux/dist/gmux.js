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
var MIRROR_BASE = `https://github.com/brainmuxhq/brainmux-plugins/releases/download/codegraph-v${CODEGRAPH_VERSION}`;
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
function syncIndex(projectPath, env = process.env) {
  try {
    const bin = resolveBinary(resolvePaths(env));
    spawnSync(bin, ["sync", "-q", projectPath], { stdio: "ignore", env: { ...env, ...TELEMETRY_OFF } });
  } catch {
  }
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
var GRAPH_VERBS = /* @__PURE__ */ new Set([
  "index",
  "status",
  "sync",
  "callers",
  "callees",
  "node",
  "impact",
  "explore",
  "files",
  "query",
  "context"
]);
var SMART_LIMITED = /* @__PURE__ */ new Set(["callers", "node"]);
var DEFAULT_LIMIT = "1000";
function runGraph(sub, argv, env = process.env) {
  const bin = resolveBinary(resolvePaths(env));
  const pre = VERB[sub] ?? [sub];
  const hasLimit = argv.some((a) => a === "--limit" || a.startsWith("--limit="));
  const extra = SMART_LIMITED.has(sub) && !hasLimit ? [...argv, "--limit", DEFAULT_LIMIT] : argv;
  return runCodegraph(bin, [...pre, ...extra], env);
}
function runRaw(argv, env = process.env) {
  const bin = resolveBinary(resolvePaths(env));
  return runCodegraph(bin, argv, env);
}

// src/commands/orphans.ts
import path5 from "node:path";

// src/core/graph-db.ts
import fs3 from "node:fs";
import path4 from "node:path";
var IndexNotFoundError = class extends Error {
  constructor(dbPath) {
    super(`index not found at ${dbPath}`);
    this.dbPath = dbPath;
    this.name = "IndexNotFoundError";
  }
};
var SqliteUnavailableError = class extends Error {
  constructor() {
    super("node:sqlite unavailable (needs Node >= 22)");
    this.name = "SqliteUnavailableError";
  }
};
function indexDbPath(projectPath) {
  return path4.join(projectPath, ".codegraph", "codegraph.db");
}
var USAGE_EDGE_KINDS = ["calls", "references"];
var ORPHAN_SYMBOL_KINDS = ["function", "method", "component", "class"];
function coerceNode(row) {
  return {
    file: String(row.file ?? ""),
    line: Number(row.line ?? 0),
    name: String(row.name ?? ""),
    kind: String(row.kind ?? ""),
    exported: Number(row.exported ?? 0) === 1,
    language: String(row.language ?? "")
  };
}
async function queryOrphanNodes(projectPath) {
  const dbPath = indexDbPath(projectPath);
  if (!fs3.existsSync(dbPath)) throw new IndexNotFoundError(dbPath);
  let DatabaseSync;
  try {
    ({ DatabaseSync } = await import("node:sqlite"));
  } catch {
    throw new SqliteUnavailableError();
  }
  const kindPlaceholders = ORPHAN_SYMBOL_KINDS.map(() => "?").join(",");
  const usageList = USAGE_EDGE_KINDS.map((k) => `'${k}'`).join(",");
  const sql = `SELECT n.file_path AS file, n.start_line AS line, n.name AS name, n.kind AS kind,
            COALESCE(n.is_exported, 0) AS exported, n.language AS language
     FROM nodes n
     WHERE n.kind IN (${kindPlaceholders})
       AND NOT EXISTS (
         SELECT 1 FROM edges e WHERE e.target = n.id AND e.kind IN (${usageList})
       )
     ORDER BY n.file_path, n.start_line`;
  const db = new DatabaseSync(dbPath, { readOnly: true });
  try {
    const rows = db.prepare(sql).all(...ORPHAN_SYMBOL_KINDS);
    return rows.map(coerceNode);
  } finally {
    db.close();
  }
}

// src/commands/orphans.ts
function isEntrypointFile(file) {
  const base = path5.basename(file).toLowerCase();
  if (/^(page|layout|route|loading|error|not-found|global-error|template|default|middleware)\.[tj]sx?$/.test(base)) return true;
  if (/^(robots|sitemap|opengraph-image|twitter-image|icon|apple-icon|manifest)\.[tj]sx?$/.test(base)) return true;
  if (/\.config\.([tj]sx?|mjs|cjs)$/.test(base)) return true;
  if (base.endsWith(".d.ts")) return true;
  if (/\.(test|spec|stories)\.[tj]sx?$/.test(base)) return true;
  if (base === "index.ts" || base === "index.tsx" || base === "index.js" || base === "index.jsx") return true;
  if (/(^|\/)scripts\//.test(file)) return true;
  if (base === "conftest.py" || base === "setup.py" || base === "__main__.py") return true;
  if (base.startsWith("test_") && base.endsWith(".py")) return true;
  if (base.endsWith("_test.py")) return true;
  return false;
}
var FRAMEWORK_SYMBOLS = /* @__PURE__ */ new Set([
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "HEAD",
  "OPTIONS",
  "generateMetadata",
  "generateStaticParams",
  "generateViewport",
  "metadata",
  "viewport",
  "default",
  "robots",
  "sitemap",
  "middleware"
]);
function parseArgs(argv, cwd = process.cwd()) {
  const json = argv.includes("--json");
  const all = argv.includes("--all");
  const exportsOnly = argv.includes("--exports");
  const noSync = argv.includes("--no-sync");
  let langCsv;
  const eqForm = argv.find((a) => a.startsWith("--lang="));
  if (eqForm) langCsv = eqForm.slice("--lang=".length);
  else if (argv.includes("--lang")) langCsv = argv[argv.indexOf("--lang") + 1];
  const langs = langCsv ? new Set(langCsv.split(",").map((s) => s.trim()).filter(Boolean)) : null;
  const positional = argv.find((a, i) => !a.startsWith("-") && argv[i - 1] !== "--lang");
  const projectPath = path5.resolve(cwd, positional ?? ".");
  return { projectPath, json, noSync, options: { all, exportsOnly, langs } };
}
function filterOrphans(nodes, options) {
  let out = nodes;
  if (options.langs) out = out.filter((n) => options.langs.has(n.language));
  if (options.exportsOnly) out = out.filter((n) => n.exported);
  const beforeHeuristics = out.length;
  if (!options.all) {
    out = out.filter((n) => !isEntrypointFile(n.file) && !FRAMEWORK_SYMBOLS.has(n.name));
  }
  return { kept: out, excluded: beforeHeuristics - out.length };
}
function renderText(kept, excluded, options) {
  const dropped = options.all ? "" : ` (${excluded} entrypoint/root elendi)`;
  const label = options.exportsOnly ? "kullan\u0131lmayan export" : "orphan aday";
  if (kept.length === 0) return `gmux orphans \u2192 0 ${label}${dropped}
`;
  const lines = kept.map(
    (n) => `  ${n.file}:${n.line}  ${n.name}  ${n.kind}/${n.exported ? "export" : "yerel"} \u2014 0 \xE7a\u011F\u0131ran`
  );
  return `gmux orphans \u2192 ${kept.length} ${label}${dropped}

` + lines.join("\n") + "\n\n  \u26A0 Aday listesi \u2014 S\u0130LMEDEN do\u011Frula. Dinamik dispatch, member-access (obj.method), same-file\n    JSX ve reflektif/framework kullan\u0131m\u0131 graph'ta g\xF6r\xFCnmez.\n    elenen root'lar: --all \xB7 sadece export: --exports \xB7 dil: --lang=ts,py \xB7 makine: --json\n";
}
function renderJson(kept) {
  return JSON.stringify(
    kept.map((n) => ({
      file: n.file,
      line: n.line,
      symbol: n.name,
      kind: n.kind,
      exported: n.exported,
      callers: 0
    })),
    null,
    2
  ) + "\n";
}
async function runOrphans(argv, _env = process.env) {
  const { projectPath, json, noSync, options } = parseArgs(argv);
  if (!noSync) syncIndex(projectPath);
  let nodes;
  try {
    nodes = await queryOrphanNodes(projectPath);
  } catch (e) {
    if (e instanceof IndexNotFoundError) {
      const hint = projectPath === process.cwd() ? "" : ` ${projectPath}`;
      process.stderr.write(`gmux orphans: no index at ${e.dbPath}
  run: gmux index${hint}
`);
      return 1;
    }
    if (e instanceof SqliteUnavailableError) {
      process.stderr.write("gmux orphans: needs Node >= 22 (built-in node:sqlite). Upgrade Node and retry.\n");
      return 1;
    }
    throw e;
  }
  const { kept, excluded } = filterOrphans(nodes, options);
  process.stdout.write(json ? renderJson(kept) : renderText(kept, excluded, options));
  return 0;
}

// src/commands/hook.ts
import fs4 from "node:fs";
import path6 from "node:path";
import { spawnSync as spawnSync2 } from "node:child_process";
var HOOK_NAMES = ["post-commit", "post-merge", "post-checkout"];
var BEGIN = "# >>> graphmux auto-sync >>>";
var END = "# <<< graphmux auto-sync <<<";
function hookBlock() {
  return [
    BEGIN,
    "# managed by `gmux hook` \u2014 do not edit between the markers",
    'bin=$(ls -d "$HOME"/.brainmux/graphmux/*/codegraph-*/bin/codegraph 2>/dev/null | sort -V | tail -1)',
    '[ -x "$bin" ] && DO_NOT_TRACK=1 CODEGRAPH_TELEMETRY=0 "$bin" sync -q >/dev/null 2>&1 || true',
    END
  ].join("\n");
}
function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
var BLOCK_RE = new RegExp(`${escapeRe(BEGIN)}[\\s\\S]*?${escapeRe(END)}`);
function applyBlock(existing, block) {
  if (BLOCK_RE.test(existing)) return existing.replace(BLOCK_RE, block);
  const trimmed = existing.trimEnd();
  if (!trimmed) return `#!/bin/sh
${block}
`;
  return `${trimmed}

${block}
`;
}
function stripBlock(existing) {
  const re = new RegExp(`\\n*${escapeRe(BEGIN)}[\\s\\S]*?${escapeRe(END)}\\n*`, "g");
  const out = existing.replace(re, "\n").trimEnd();
  return out ? out + "\n" : "";
}
function hasBlock(existing) {
  return BLOCK_RE.test(existing);
}
function resolveHooksDir(projectPath) {
  const r = spawnSync2("git", ["-C", projectPath, "rev-parse", "--git-path", "hooks"], { encoding: "utf8" });
  if (r.status !== 0) return null;
  const rel = r.stdout.trim();
  if (!rel) return null;
  return path6.isAbsolute(rel) ? rel : path6.join(projectPath, rel);
}
function install2(hooksDir, log) {
  fs4.mkdirSync(hooksDir, { recursive: true });
  const block = hookBlock();
  for (const name of HOOK_NAMES) {
    const file = path6.join(hooksDir, name);
    const existing = fs4.existsSync(file) ? fs4.readFileSync(file, "utf8") : "";
    fs4.writeFileSync(file, applyBlock(existing, block));
    fs4.chmodSync(file, 493);
    log(`  \u2713 ${name}`);
  }
  return 0;
}
function uninstall(hooksDir, log) {
  for (const name of HOOK_NAMES) {
    const file = path6.join(hooksDir, name);
    if (!fs4.existsSync(file)) continue;
    const existing = fs4.readFileSync(file, "utf8");
    if (!hasBlock(existing)) continue;
    const next = stripBlock(existing);
    if (next.trim() === "" || next.trim() === "#!/bin/sh") fs4.rmSync(file, { force: true });
    else fs4.writeFileSync(file, next);
    log(`  \u2713 ${name} temizlendi`);
  }
  return 0;
}
function status(hooksDir, log) {
  for (const name of HOOK_NAMES) {
    const file = path6.join(hooksDir, name);
    const on = fs4.existsSync(file) && hasBlock(fs4.readFileSync(file, "utf8"));
    log(`  ${on ? "\u2713 kurulu" : "\xB7 yok    "}  ${name}`);
  }
  return 0;
}
function runHook(argv, _env = process.env) {
  const sub = argv[0];
  if (!sub || !["install", "uninstall", "status"].includes(sub)) {
    process.stderr.write("gmux hook <install|uninstall|status> [path]\n");
    return 1;
  }
  const projectPath = path6.resolve(argv.slice(1).find((a) => !a.startsWith("-")) ?? ".");
  const hooksDir = resolveHooksDir(projectPath);
  if (!hooksDir) {
    process.stderr.write(`gmux hook: '${projectPath}' is not a git repo (or git not found)
`);
    return 1;
  }
  const log = (s) => process.stdout.write(s + "\n");
  if (sub === "status") {
    log(`graphmux auto-sync hooks \xB7 ${hooksDir}`);
    return status(hooksDir, log);
  }
  if (sub === "uninstall") {
    log(`graphmux auto-sync \u2014 kald\u0131r\u0131l\u0131yor (${hooksDir})`);
    return uninstall(hooksDir, log);
  }
  log(`graphmux auto-sync \u2014 git hook kuruluyor (${hooksDir})`);
  const code = install2(hooksDir, log);
  log("  \u2192 her commit/merge/checkout'ta index otomatik senkron (codegraph sync -q).");
  log("  not: repo bir kez indexlenmeli \u2014 `gmux index` (yoksa hook sessizce atlar).");
  return code;
}

// src/cli.ts
var HELP = `gmux \u2014 brainmux/graphmux CLI (local codebase memory; vendors CodeGraph v${CODEGRAPH_VERSION})

  gmux install                    download + SHA256-verify the pinned CodeGraph binary (telemetry off),
                                  then write the "graphmux" MCP config for delegates / Claude Code
  gmux index [path]               build/rebuild the code graph for a repo
  gmux status | sync [path]       index status / sync changes since last index
  gmux callers <sym>              who calls <sym>  (auto --limit 1000 \u2014 avoids the silent cap)
  gmux impact <sym>               blast radius of changing <sym>  (transitive, no cap \u2014 prefer for "what breaks")
  gmux node <sym>                 one symbol's source + caller/callee trail  (auto --limit 1000)
  gmux explore "<query>"          relevant symbols + call paths + verbatim source, one shot
  gmux callees | files [args]     more graph queries
  gmux orphans [path] [opts]      bulk dead/orphan candidates (0 incoming calls/refs), framework
                                  roots excluded  \xB7  --exports --all --lang=ts,py --json  (Node >=22)
  gmux hook install|uninstall|status [path]
                                  git hook that auto-syncs the index on commit/merge/checkout
                                  (the CLI does NOT watch files; this is the auto-reindex)
  gmux -- <codegraph args...>     raw passthrough (no smart defaults) to the vendored engine

  then: bmux delegate <brain> --memory "<task>"   (llmproxy grounds the cheap brain on the graph)
`;
async function main(argv, env = process.env) {
  const cmd = argv[0];
  const rest = argv.slice(1);
  if (!cmd || cmd === "-h" || cmd === "--help") {
    process.stdout.write(HELP);
    return 0;
  }
  try {
    if (cmd === "install") return runInstall(rest, env);
    if (cmd === "hook") return runHook(rest, env);
    if (cmd === "orphans") return runOrphans(rest, env);
    if (cmd === "--") return runRaw(rest, env);
    if (GRAPH_VERBS.has(cmd)) return runGraph(cmd, rest, env);
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

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

// `gmux hook` — install/remove a git hook that auto-syncs the CodeGraph index after commits,
// merges and checkouts (via `codegraph sync -q`, which upstream built for exactly this). Without
// it the index is only as fresh as the last manual `gmux index`/`gmux sync` — the CLI does NOT
// watch the filesystem. Opt-in (like llmproxy's statusline), reversible, non-destructive.

export const HOOK_NAMES = ["post-commit", "post-merge", "post-checkout"] as const;
const BEGIN = "# >>> graphmux auto-sync >>>";
const END = "# <<< graphmux auto-sync <<<";

// The managed block. Resolves the latest installed codegraph binary at run time (version-agnostic
// → survives plugin upgrades), syncs quietly with telemetry off, and never blocks git (`|| true`).
export function hookBlock(): string {
  return [
    BEGIN,
    "# managed by `gmux hook` — do not edit between the markers",
    'bin=$(ls -d "$HOME"/.brainmux/graphmux/*/codegraph-*/bin/codegraph 2>/dev/null | sort -V | tail -1)',
    '[ -x "$bin" ] && DO_NOT_TRACK=1 CODEGRAPH_TELEMETRY=0 "$bin" sync -q >/dev/null 2>&1 || true',
    END,
  ].join("\n");
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
const BLOCK_RE = new RegExp(`${escapeRe(BEGIN)}[\\s\\S]*?${escapeRe(END)}`);

// Pure: insert-or-replace the managed block in a hook file's contents (idempotent).
export function applyBlock(existing: string, block: string): string {
  if (BLOCK_RE.test(existing)) return existing.replace(BLOCK_RE, block);
  const trimmed = existing.trimEnd();
  if (!trimmed) return `#!/bin/sh\n${block}\n`;
  return `${trimmed}\n\n${block}\n`;
}

// Pure: remove the managed block, leaving any user content intact.
export function stripBlock(existing: string): string {
  const re = new RegExp(`\\n*${escapeRe(BEGIN)}[\\s\\S]*?${escapeRe(END)}\\n*`, "g");
  const out = existing.replace(re, "\n").trimEnd();
  return out ? out + "\n" : "";
}

export function hasBlock(existing: string): boolean {
  return BLOCK_RE.test(existing);
}

// Resolve the repo's hooks directory (respects core.hooksPath). Null if not a git repo.
function resolveHooksDir(projectPath: string): string | null {
  const r = spawnSync("git", ["-C", projectPath, "rev-parse", "--git-path", "hooks"], { encoding: "utf8" });
  if (r.status !== 0) return null;
  const rel = r.stdout.trim();
  if (!rel) return null;
  return path.isAbsolute(rel) ? rel : path.join(projectPath, rel);
}

function install(hooksDir: string, log: (s: string) => void): number {
  fs.mkdirSync(hooksDir, { recursive: true });
  const block = hookBlock();
  for (const name of HOOK_NAMES) {
    const file = path.join(hooksDir, name);
    const existing = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
    fs.writeFileSync(file, applyBlock(existing, block));
    fs.chmodSync(file, 0o755);
    log(`  ✓ ${name}`);
  }
  return 0;
}

function uninstall(hooksDir: string, log: (s: string) => void): number {
  for (const name of HOOK_NAMES) {
    const file = path.join(hooksDir, name);
    if (!fs.existsSync(file)) continue;
    const existing = fs.readFileSync(file, "utf8");
    if (!hasBlock(existing)) continue;
    const next = stripBlock(existing);
    // If nothing but our block remained, remove the file; else write back the user content.
    if (next.trim() === "" || next.trim() === "#!/bin/sh") fs.rmSync(file, { force: true });
    else fs.writeFileSync(file, next);
    log(`  ✓ ${name} temizlendi`);
  }
  return 0;
}

function status(hooksDir: string, log: (s: string) => void): number {
  for (const name of HOOK_NAMES) {
    const file = path.join(hooksDir, name);
    const on = fs.existsSync(file) && hasBlock(fs.readFileSync(file, "utf8"));
    log(`  ${on ? "✓ kurulu" : "· yok    "}  ${name}`);
  }
  return 0;
}

export function runHook(argv: string[], _env: NodeJS.ProcessEnv = process.env): number {
  const sub = argv[0];
  if (!sub || !["install", "uninstall", "status"].includes(sub)) {
    process.stderr.write("gmux hook <install|uninstall|status> [path]\n");
    return 1;
  }
  const projectPath = path.resolve(argv.slice(1).find((a) => !a.startsWith("-")) ?? ".");
  const hooksDir = resolveHooksDir(projectPath);
  if (!hooksDir) {
    process.stderr.write(`gmux hook: '${projectPath}' is not a git repo (or git not found)\n`);
    return 1;
  }

  const log = (s: string) => process.stdout.write(s + "\n");
  if (sub === "status") {
    log(`graphmux auto-sync hooks · ${hooksDir}`);
    return status(hooksDir, log);
  }
  if (sub === "uninstall") {
    log(`graphmux auto-sync — kaldırılıyor (${hooksDir})`);
    return uninstall(hooksDir, log);
  }
  // install
  log(`graphmux auto-sync — git hook kuruluyor (${hooksDir})`);
  const code = install(hooksDir, log);
  log("  → her commit/merge/checkout'ta index otomatik senkron (codegraph sync -q).");
  log("  not: repo bir kez indexlenmeli — `gmux index` (yoksa hook sessizce atlar).");
  return code;
}

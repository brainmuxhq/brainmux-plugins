import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import type { Paths } from "./paths.js";

// ── Vendored core (brainmux house-style) ────────────────────────────────────────
// We do NOT reimplement code intelligence. We pin the exact upstream CodeGraph release
// artifact + its SHA256, verify before use, and thin-wrap it. Updates are deliberate:
// bump CODEGRAPH_VERSION + the matching SHAs together (never one without the other).
// Mirror the assets to our own releases before shipping (upstream-death insurance).
export const CODEGRAPH_VERSION = "1.6.0";

// SHA256 of each platform's release asset (from the upstream v1.6.0 SHA256SUMS, verified).
export const CODEGRAPH_SHA256: Record<string, string> = {
  "linux-x64": "de3391f79ed42622d937e6cd5b7642a7ea8bb7d1473607e80b879ba73ef216b0",
  "linux-arm64": "6dc935a7b8f1a61e688a578b98ea34680eb2e36d7b91db079d64f4011f1a668f",
  "darwin-x64": "cb86a2b62ee676b62a56bf8423600e7d867e752e57f323cdc98c0f6236efd908",
  "darwin-arm64": "1c73033512d55f67be04717e81532e8beaf7be6fb8531f51a179fa23064ad480",
  "win32-x64": "cd76c3c3391f2d40abef12b142151950b6d77abc2d8429e648f89eaa90f5b68a",
  "win32-arm64": "3ca980010bd718a6b5e75be1145806ae6491afb1a59a2cec6cee4bf5c39f1b3a",
};

// Primary = our GHCR-adjacent GitHub-release mirror (byte-identical assets, digest-pinned) →
// upstream-death insurance + controlled updates; fallback = upstream. Empty mirror ⇒ upstream only.
// Note the two URL shapes: mirror release tag is `codegraph-v<ver>` (assets directly under it),
// upstream release tag is `v<ver>` — assetUrl() builds each correctly.
const MIRROR_BASE = `https://github.com/brainmuxhq/brainmux/releases/download/codegraph-v${CODEGRAPH_VERSION}`;
const UPSTREAM_BASE = "https://github.com/colbymchenry/codegraph/releases/download";

// Telemetry OFF by default — brainmux is local-first; nothing phones home unless the user opts in.
// (CodeGraph honors all three: no connection, no update check, no opt-out ping.)
export const TELEMETRY_OFF: Record<string, string> = {
  DO_NOT_TRACK: "1",
  CODEGRAPH_TELEMETRY: "0",
  CODEGRAPH_NO_UPDATE_CHECK: "1",
};

// ── pure helpers (unit-testable, no IO) ──────────────────────────────────────────
export function platformKey(platform: NodeJS.Platform = process.platform, arch: string = process.arch): string {
  const key = `${platform}-${arch}`;
  if (!(key in CODEGRAPH_SHA256)) {
    throw new Error(`graphmux: unsupported platform '${key}' (supported: ${Object.keys(CODEGRAPH_SHA256).join(", ")})`);
  }
  return key;
}

export function assetName(key: string): string {
  return key.startsWith("win32-") ? `codegraph-${key}.zip` : `codegraph-${key}.tar.gz`;
}

export function assetUrl(key: string, source: "mirror" | "upstream"): string {
  const name = assetName(key);
  // Mirror: assets sit directly under the `codegraph-v<ver>` release tag (base already includes it).
  // Upstream: assets sit under the `v<ver>` release tag.
  return source === "mirror" ? `${MIRROR_BASE}/${name}` : `${UPSTREAM_BASE}/v${CODEGRAPH_VERSION}/${name}`;
}

export function sha256Hex(buf: Buffer): string {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

// Constant-time compare of the computed hash against the pinned one (both lowercase hex).
export function verifySha(buf: Buffer, expected: string): boolean {
  const got = sha256Hex(buf);
  if (got.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(got), Buffer.from(expected));
}

// ── IO ───────────────────────────────────────────────────────────────────────────
export function binPath(cacheDir: string, key: string = platformKey()): string {
  const exe = key.startsWith("win32-") ? "codegraph.exe" : "codegraph";
  return path.join(cacheDir, `codegraph-${key}`, "bin", exe);
}

function have(cmd: string): boolean {
  return spawnSync(cmd, ["--version"], { stdio: "ignore" }).status === 0;
}

// Download (curl), VERIFY the SHA256 against the pinned value, then extract (tar).
// Shelling to system tools is install-time only and consistent with how llmproxy shells to
// docker/claude — the bundle itself stays dependency-free. Returns the resolved binary path.
export function install(paths: Paths, log: (s: string) => void = () => {}): string {
  const key = platformKey();
  const cacheDir = paths.binCache(CODEGRAPH_VERSION);
  const dest = binPath(cacheDir, key);
  if (fs.existsSync(dest)) return dest;

  // Check BOTH tools before the ~60MB download, so a missing extractor fails fast (not after the fetch).
  if (!have("curl")) throw new Error("graphmux: `curl` not found — needed to download the CodeGraph binary");
  if (!have("tar")) throw new Error("graphmux: `tar` not found — needed to extract the CodeGraph binary");
  fs.mkdirSync(cacheDir, { recursive: true });
  const archive = path.join(cacheDir, assetName(key));

  const urls = [MIRROR_BASE ? assetUrl(key, "mirror") : "", assetUrl(key, "upstream")].filter(Boolean);
  let ok = false;
  let lastErr = "";
  for (const url of urls) {
    log(`↓ ${url}`);
    const r = spawnSync("curl", ["-fsSL", "-o", archive, url], { stdio: ["ignore", "ignore", "pipe"] });
    if (r.status === 0 && fs.existsSync(archive)) { ok = true; break; }
    lastErr = (r.stderr?.toString().trim()) || `curl exit ${r.status}`;
  }
  if (!ok) throw new Error(`graphmux: download failed — ${lastErr}`);

  // Verify BEFORE extracting or running anything.
  if (!verifySha(fs.readFileSync(archive), CODEGRAPH_SHA256[key])) {
    fs.rmSync(archive, { force: true });
    throw new Error(`graphmux: SHA256 mismatch for ${assetName(key)} — refusing to use it`);
  }
  log(`✓ sha256 ${CODEGRAPH_SHA256[key].slice(0, 12)}… verified`);

  // Extract with tar on every platform: GNU tar handles .tar.gz (Linux); bsdtar (macOS + Windows 10+)
  // auto-detects .zip — so no separate `unzip` dependency. Each platform only ever gets its own asset
  // type and its tar handles it.
  const tarArgs = key.startsWith("win32-") ? ["-xf", archive, "-C", cacheDir] : ["xzf", archive, "-C", cacheDir];
  if (spawnSync("tar", tarArgs, { stdio: "inherit" }).status !== 0) {
    throw new Error(`graphmux: extract failed (tar) for ${assetName(key)}`);
  }
  fs.rmSync(archive, { force: true });
  if (!fs.existsSync(dest)) throw new Error(`graphmux: extracted but binary not found at ${dest}`);
  fs.chmodSync(dest, 0o755);
  return dest;
}

// Resolve the installed binary, installing (download+verify) on first use.
export function resolveBinary(paths: Paths, log?: (s: string) => void): string {
  return install(paths, log);
}

// Passthrough to the vendored engine with telemetry forced off.
export function runCodegraph(bin: string, args: string[], env: NodeJS.ProcessEnv = process.env): number {
  const r = spawnSync(bin, args, { stdio: "inherit", env: { ...env, ...TELEMETRY_OFF } });
  return r.status ?? 1;
}

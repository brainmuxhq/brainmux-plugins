import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

// Exercises the SHIPPED artifact (dist/bmux.js, the esbuild bundle) end to end, not the
// tsc output the other tests import. This is the guard against bundle-vs-tsc divergence:
// `bmux init` touches the filesystem + the embedded default manifest, so it catches
// path/packaging regressions that a `--help` smoke would miss. `npm test` runs
// `npm run bundle` first, so dist/bmux.js is fresh here.
const here = path.dirname(fileURLToPath(import.meta.url)); // dist/test
const bundle = path.resolve(here, "../bmux.js"); // dist/bmux.js

test("the shipped bundle scaffolds via `bmux init` (no build, no node_modules assumptions)", () => {
  assert.ok(fs.existsSync(bundle), `bundle not found at ${bundle} — run npm run bundle`);
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "bmux-bundle-"));
  const r = spawnSync(process.execPath, [bundle, "init"], {
    env: { ...process.env, BRAINMUX_HOME: home },
    encoding: "utf8",
  });
  assert.equal(r.status, 0, `init exited ${r.status}; stderr: ${r.stderr}`);
  assert.ok(fs.existsSync(path.join(home, "brains.yaml")), "brains.yaml scaffolded");
  assert.ok(fs.existsSync(path.join(home, "generated", "compose.yaml")), "compose generated");
  assert.ok(fs.existsSync(path.join(home, "generated", "chat.yaml")), "per-brain config generated");
});

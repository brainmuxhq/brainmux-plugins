import { test } from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { resolvePaths } from "../src/core/paths.js";

test("defaults to ~/.brainmux when BRAINMUX_HOME unset", () => {
  const p = resolvePaths({});
  assert.equal(p.home, path.join(os.homedir(), ".brainmux"));
  assert.equal(p.brainsYaml, path.join(p.home, "brains.yaml"));
  assert.equal(p.composeYaml, path.join(p.home, "generated", "compose.yaml"));
  assert.equal(p.dataDir, path.join(p.home, "data", "postgres"));
  assert.equal(p.brainConfig("chat"), path.join(p.home, "generated", "chat.yaml"));
});

test("honors BRAINMUX_HOME override", () => {
  const p = resolvePaths({ BRAINMUX_HOME: "/custom/home" });
  assert.equal(p.home, "/custom/home");
  assert.equal(p.envFile, path.join("/custom/home", ".env"));
  assert.equal(p.initDir, path.join("/custom/home", "generated", "init"));
});

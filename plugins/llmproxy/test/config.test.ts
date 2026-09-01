import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { runInit } from "../src/commands/init.js";
import { runConfig } from "../src/commands/config.js";
import { loadBrains } from "../src/core/manifest.js";
import { getKey } from "../src/core/env.js";

function freshHome(): string {
  const h = fs.mkdtempSync(path.join(os.tmpdir(), "bmux-config-"));
  runInit({ BRAINMUX_HOME: h });
  return h;
}

test("add-brain appends to brains.yaml, regenerates, mints a master key", () => {
  const h = freshHome();
  const env = { BRAINMUX_HOME: h };
  assert.equal(runConfig("add-brain", ["fast", "4570", "openrouter/x/y"], env), 0);
  const cfg = loadBrains(path.join(h, "brains.yaml"));
  assert.equal(cfg.brains.fast.port, 4570);
  assert.ok(fs.readFileSync(path.join(h, "generated", "compose.yaml"), "utf8").includes("brainmux-fast"));
  assert.ok((getKey(path.join(h, ".env"), "FAST_MASTER_KEY") ?? "").length > 0);
});

test("add-brain rejects a duplicate port", () => {
  const h = freshHome();
  assert.notEqual(runConfig("add-brain", ["dup", "4567", "openrouter/x/y"], { BRAINMUX_HOME: h }), 0);
});

test("set-model rewrites the brain model + its generated config", () => {
  const h = freshHome();
  runConfig("set-model", ["chat", "openrouter/new/model"], { BRAINMUX_HOME: h });
  assert.ok(fs.readFileSync(path.join(h, "generated", "chat.yaml"), "utf8").includes("openrouter/new/model"));
});

test("remove-brain drops it from manifest + generated compose", () => {
  const h = freshHome();
  runConfig("remove-brain", ["coder"], { BRAINMUX_HOME: h });
  const cfg = loadBrains(path.join(h, "brains.yaml"));
  assert.ok(!("coder" in cfg.brains));
  assert.ok(!fs.readFileSync(path.join(h, "generated", "compose.yaml"), "utf8").includes("brainmux-coder"));
});

test("add-key writes a provider key to .env", () => {
  const h = freshHome();
  runConfig("add-key", ["OPENROUTER_API_KEY", "sk-or-123"], { BRAINMUX_HOME: h });
  assert.equal(getKey(path.join(h, ".env"), "OPENROUTER_API_KEY"), "sk-or-123");
});

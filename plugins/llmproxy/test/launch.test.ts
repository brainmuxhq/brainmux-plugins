import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { runInit } from "../src/commands/init.js";
import { setKey } from "../src/core/env.js";
import { planLaunch } from "../src/commands/launch.js";

test("planLaunch resolves base url + master key for a brain", () => {
  const h = fs.mkdtempSync(path.join(os.tmpdir(), "bmux-launch-"));
  runInit({ BRAINMUX_HOME: h });
  const plan = planLaunch("deep", { BRAINMUX_HOME: h });
  assert.equal(plan.base, "http://127.0.0.1:4568");
  assert.match(plan.apiKey, /^sk-deep-/);
});

test("planLaunch throws for an unknown brain", () => {
  const h = fs.mkdtempSync(path.join(os.tmpdir(), "bmux-launch2-"));
  runInit({ BRAINMUX_HOME: h });
  assert.throws(() => planLaunch("nope", { BRAINMUX_HOME: h }), /unknown brain/i);
});

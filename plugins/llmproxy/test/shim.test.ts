import { test } from "node:test";
import assert from "node:assert/strict";
import { SHIM_LAUNCHER } from "../src/commands/shim.js";

test("shim launcher is POSIX sh, version-agnostic, and honors CLAUDE_CONFIG_DIR", () => {
  assert.ok(SHIM_LAUNCHER.startsWith("#!/bin/sh"));
  assert.ok(SHIM_LAUNCHER.includes("brainmux launcher"), "carries the marker used to detect our own shim");
  assert.ok(SHIM_LAUNCHER.includes("sort -V | tail -1"), "resolves the highest installed version at run time");
  assert.ok(SHIM_LAUNCHER.includes("${CLAUDE_CONFIG_DIR:-$HOME/.claude}"), "honors CLAUDE_CONFIG_DIR");
  assert.ok(SHIM_LAUNCHER.includes('exec "$bin" "$@"'), "execs the resolved bmux with all args");
  assert.ok(!/0\.1\.\d+/.test(SHIM_LAUNCHER), "no hardcoded version in the launcher");
});

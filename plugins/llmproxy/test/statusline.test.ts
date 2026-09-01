import { test } from "node:test";
import assert from "node:assert/strict";
import { planStatuslineSettings, STATUSLINE_SCRIPT } from "../src/commands/statusline.js";

const CMD = "/home/u/.claude/brainmux-statusline.sh";

test("no existing statusLine → set it, keep other keys", () => {
  const { settings, action } = planStatuslineSettings({ model: "opus", permissions: { x: 1 } }, CMD, false);
  assert.equal(action, "set");
  assert.deepEqual(settings.statusLine, { type: "command", command: CMD, padding: 0 });
  assert.equal(settings.model, "opus");
  assert.deepEqual(settings.permissions, { x: 1 });
});

test("empty / non-object settings → set", () => {
  assert.equal(planStatuslineSettings({}, CMD, false).action, "set");
  assert.equal(planStatuslineSettings(null, CMD, false).action, "set");
});

test("existing foreign statusLine, no force → keep it untouched", () => {
  const existing = { statusLine: { type: "command", command: "/other/line.sh" } };
  const { settings, action } = planStatuslineSettings(existing, CMD, false);
  assert.equal(action, "kept-existing");
  assert.equal(settings.statusLine.command, "/other/line.sh"); // not clobbered
});

test("existing foreign statusLine + force → replace", () => {
  const { settings, action } = planStatuslineSettings({ statusLine: { type: "command", command: "/other/line.sh" } }, CMD, true);
  assert.equal(action, "replaced");
  assert.equal(settings.statusLine.command, CMD);
});

test("already ours → no-op regardless of force", () => {
  const existing = { statusLine: { type: "command", command: CMD, padding: 0 } };
  assert.equal(planStatuslineSettings(existing, CMD, false).action, "already-ours");
  assert.equal(planStatuslineSettings(existing, CMD, true).action, "already-ours");
});

test("embedded script is bash, env-driven, and carries no hardcoded ports/paths (drift-free)", () => {
  assert.ok(STATUSLINE_SCRIPT.startsWith("#!/usr/bin/env bash"));
  assert.ok(STATUSLINE_SCRIPT.includes("${BRAINMUX_BRAIN:-}"), "brain name must come from the launcher env, not a port map");
  assert.ok(STATUSLINE_SCRIPT.includes("${BRAINMUX_HOME:-$HOME/.brainmux}"), "state dir must honor BRAINMUX_HOME");
  assert.ok(!/127\.0\.0\.1:4\d{3}/.test(STATUSLINE_SCRIPT), "no hardcoded brain ports");
  assert.ok(!STATUSLINE_SCRIPT.includes("claude-proxy"), "no dead claude-proxy path");
  assert.ok(STATUSLINE_SCRIPT.includes("-H @-"), "OpenRouter key passed via stdin, not argv (/proc-safe)");
  assert.ok(!/-H "Authorization: Bearer \$key"/.test(STATUSLINE_SCRIPT), "key must not sit in curl's argv");
});

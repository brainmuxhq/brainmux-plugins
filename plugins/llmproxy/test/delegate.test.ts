import { test } from "node:test";
import assert from "node:assert/strict";
import { parseDelegateArgs, buildClaudeArgs } from "../src/commands/delegate.js";

test("default mode = analyze, read-only tools", () => {
  const { brain, opts } = parseDelegateArgs(["coder", "find the bug"]);
  assert.equal(brain, "coder");
  assert.equal(opts.mode, "analyze");
  const args = buildClaudeArgs(opts);
  assert.ok(args.includes("-p"));
  assert.ok(args.includes("find the bug"));
  assert.ok(args.includes("--allowedTools"));
  assert.deepEqual(args.slice(args.indexOf("--allowedTools") + 1, args.indexOf("--allowedTools") + 4), ["Read", "Grep", "Glob"]);
});

test("--write flips to acceptEdits and drops the read-only allowlist", () => {
  const { opts } = parseDelegateArgs(["coder", "--write", "do it"]);
  assert.equal(opts.mode, "write");
  const args = buildClaudeArgs(opts);
  assert.ok(args.includes("acceptEdits"));
  assert.ok(!args.includes("--allowedTools"));
});

test("--yolo uses dangerously-skip-permissions", () => {
  const { opts } = parseDelegateArgs(["coder", "--yolo", "go"]);
  assert.equal(opts.mode, "yolo");
  assert.ok(buildClaudeArgs(opts).includes("--dangerously-skip-permissions"));
});

test("--json sets output format; -C sets workdir", () => {
  const { opts } = parseDelegateArgs(["chat", "--json", "-C", "/tmp/x", "sum"]);
  assert.equal(opts.outfmt, "json");
  assert.equal(opts.workdir, "/tmp/x");
  assert.ok(buildClaudeArgs(opts).includes("json"));
});

test("stdin task via '-'", () => {
  const { opts } = parseDelegateArgs(["deep", "-"], "big task from stdin");
  assert.equal(opts.task, "big task from stdin");
});

test("rejects a missing brain (flag-first or empty)", () => {
  assert.throws(() => parseDelegateArgs(["--write", "x"]), /missing brain/i);
  assert.throws(() => parseDelegateArgs([]), /missing brain/i);
});

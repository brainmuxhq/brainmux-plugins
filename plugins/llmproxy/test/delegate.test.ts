import { test } from "node:test";
import assert from "node:assert/strict";
import { parseDelegateArgs, buildClaudeArgs, initProgress, foldEvent, parseStreamLine, statusLine, doneLine } from "../src/commands/delegate.js";

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

test("stream is off by default; --stream / -v / --verbose turn it on", () => {
  assert.equal(parseDelegateArgs(["coder", "task"]).opts.stream, false);
  for (const flag of ["--stream", "-v", "--verbose"]) {
    assert.equal(parseDelegateArgs(["coder", flag, "task"]).opts.stream, true, flag);
  }
});

test("mcp is off by default; --mcp / --with-mcp turn it on", () => {
  assert.equal(parseDelegateArgs(["coder", "task"]).opts.mcp, false);
  for (const flag of ["--mcp", "--with-mcp"]) {
    assert.equal(parseDelegateArgs(["coder", flag, "task"]).opts.mcp, true, flag);
  }
});

test("default drops host MCP (--strict-mcp-config); --mcp keeps it", () => {
  const off = buildClaudeArgs(parseDelegateArgs(["coder", "do it"]).opts);
  assert.ok(off.includes("--strict-mcp-config"), "default must isolate the worker from host MCP");
  const on = buildClaudeArgs(parseDelegateArgs(["coder", "--mcp", "do it"]).opts);
  assert.ok(!on.includes("--strict-mcp-config"), "--mcp must let the worker inherit host MCP");
});

test("--stream builds stream-json + --verbose (not the plain output-format)", () => {
  const { opts } = parseDelegateArgs(["coder", "--stream", "do it"]);
  const args = buildClaudeArgs(opts);
  assert.deepEqual(args.slice(args.indexOf("--output-format"), args.indexOf("--output-format") + 2), ["--output-format", "stream-json"]);
  assert.ok(args.includes("--verbose"));
  // non-stream keeps the plain final-answer format
  const plain = buildClaudeArgs(parseDelegateArgs(["coder", "do it"]).opts);
  assert.ok(!plain.includes("stream-json"));
  assert.deepEqual(plain.slice(plain.indexOf("--output-format"), plain.indexOf("--output-format") + 2), ["--output-format", "text"]);
});

test("foldEvent: tool calls advance the step counter and set the current action", () => {
  const p = initProgress();
  foldEvent(p, { type: "assistant", message: { content: [{ type: "tool_use", name: "Grep", input: { pattern: "TODO" } }] } });
  assert.equal(p.steps, 1);
  assert.equal(p.current, "Grep: TODO");
  foldEvent(p, { type: "assistant", message: { content: [{ type: "tool_use", name: "Read", input: { file_path: "/a/b/delegate.ts" } }] } });
  assert.equal(p.steps, 2);
  assert.equal(p.current, "Read: delegate.ts"); // file args show the basename, not the full path
});

test("foldEvent: TodoWrite drives real X/Y progress + the in-progress label", () => {
  const p = initProgress();
  foldEvent(p, { type: "assistant", message: { content: [{ type: "tool_use", name: "TodoWrite", input: { todos: [
    { status: "completed", content: "a" },
    { status: "completed", content: "b" },
    { status: "in_progress", content: "wire the parser", activeForm: "Wiring the parser" },
    { status: "pending", content: "d" },
    { status: "pending", content: "e" },
  ] } }] } });
  assert.equal(p.todoDone, 2);
  assert.equal(p.todoTotal, 5);
  assert.equal(p.current, "Wiring the parser");
  assert.equal(statusLine("coder", p), "⏳ coder · 2/5 · Wiring the parser");
});

test("foldEvent: result captures the final answer + duration and flags errors", () => {
  const p = initProgress();
  foldEvent(p, { type: "result", is_error: false, duration_ms: 8485, usage: { input_tokens: 90000, output_tokens: 117 }, result: "delegate.ts" });
  assert.equal(p.done, true);
  assert.equal(p.finalText, "delegate.ts");
  assert.equal(p.ms, 8485);
  assert.equal(doneLine("chat", p), "✅ done chat · 0 steps · 8.5s");
});

test("statusLine / doneLine: fall back to a step count when there are no todos", () => {
  const p = initProgress();
  p.steps = 7;
  p.current = "Grep: foo";
  assert.equal(statusLine("chat", p), "⏳ chat · step 7 · Grep: foo");
  p.done = true; p.error = true; p.ms = 1200;
  assert.equal(doneLine("chat", p), "⚠ failed chat · 7 steps · 1.2s");
});

test("foldEvent: host noise (hooks, init, rate-limit) never touches progress", () => {
  const p = initProgress();
  const before = JSON.stringify(p);
  foldEvent(p, { type: "system", subtype: "hook_response", output: "…huge skill dump…" });
  foldEvent(p, { type: "system", subtype: "init" });
  foldEvent(p, { type: "rate_limit_event" });
  assert.equal(JSON.stringify(p), before);
});

test("parseStreamLine: blank / non-JSON lines drop to null; valid JSON parses", () => {
  assert.equal(parseStreamLine(""), null);
  assert.equal(parseStreamLine("   "), null);
  assert.equal(parseStreamLine("not json {"), null);
  assert.deepEqual(parseStreamLine('{"type":"result","result":"ok"}'), { type: "result", result: "ok" });
});

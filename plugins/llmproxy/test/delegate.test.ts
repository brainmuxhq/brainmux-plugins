import { test } from "node:test";
import assert from "node:assert/strict";
import { parseDelegateArgs, buildClaudeArgs, formatStreamEvent, formatStreamLine } from "../src/commands/delegate.js";

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

test("formatStreamEvent: tool_use → 🔧 with a compact hint", () => {
  const ev = { type: "assistant", message: { content: [{ type: "tool_use", name: "Bash", input: { command: "ls -la" } }] } };
  assert.equal(formatStreamEvent(ev), "🔧 Bash ls -la");
  const grep = { type: "assistant", message: { content: [{ type: "tool_use", name: "Grep", input: { pattern: "TODO" } }] } };
  assert.equal(formatStreamEvent(grep), "🔧 Grep TODO");
});

test("formatStreamEvent: assistant text → 💬, empty text dropped", () => {
  assert.equal(formatStreamEvent({ type: "assistant", message: { content: [{ type: "text", text: "found 3 hits" }] } }), "💬 found 3 hits");
  assert.equal(formatStreamEvent({ type: "assistant", message: { content: [{ type: "text", text: "  " }] } }), null);
  assert.equal(formatStreamEvent({ type: "assistant", message: { content: [{ type: "thinking", thinking: "" }] } }), null);
});

test("formatStreamEvent: tool errors surface, normal results stay quiet", () => {
  assert.equal(formatStreamEvent({ type: "user", message: { content: [{ type: "tool_result", is_error: true }] } }), "  ↳ ⚠ tool error");
  assert.equal(formatStreamEvent({ type: "user", message: { content: [{ type: "tool_result", content: "ok", is_error: false }] } }), null);
});

test("formatStreamEvent: result → done line with real tokens/turns/duration (no misleading $)", () => {
  const ev = { type: "result", subtype: "success", is_error: false, total_cost_usd: 0.6371, num_turns: 2, duration_ms: 6477, usage: { input_tokens: 8876, output_tokens: 118 }, result: "final" };
  const out = formatStreamEvent(ev);
  assert.equal(out, "✅ done — 8876→118 tok, 2 turns, 6477ms  (spend: bmux spend)");
  assert.ok(!out!.includes("$"), "must not print Claude Code's bogus per-brain dollar figure");
  // usage absent → drop the token clause, keep turns/duration
  assert.equal(formatStreamEvent({ type: "result", is_error: true, num_turns: 1, duration_ms: 10 }), "⚠ error — 1 turns, 10ms  (spend: bmux spend)");
});

test("formatStreamEvent: host noise is dropped", () => {
  assert.equal(formatStreamEvent({ type: "system", subtype: "hook_response", output: "…huge skill dump…" }), null);
  assert.equal(formatStreamEvent({ type: "system", subtype: "init" }), null);
  assert.equal(formatStreamEvent({ type: "rate_limit_event" }), null);
});

test("formatStreamLine: blank / non-JSON lines drop to null", () => {
  assert.equal(formatStreamLine(""), null);
  assert.equal(formatStreamLine("   "), null);
  assert.equal(formatStreamLine("not json {"), null);
  assert.equal(formatStreamLine('{"type":"assistant","message":{"content":[{"type":"text","text":"hi"}]}}'), "💬 hi");
});

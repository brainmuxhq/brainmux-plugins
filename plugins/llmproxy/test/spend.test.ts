import { test } from "node:test";
import assert from "node:assert/strict";
import { aggregateSpend, formatSpend, type BrainSpend } from "../src/core/spend.js";

test("aggregateSpend sums spend + tokens and counts rows", () => {
  const rows = [
    { spend: 3.96e-6, total_tokens: 14 },
    { spend: 1.0e-6, total_tokens: 6 },
  ];
  const r = aggregateSpend("coder", rows);
  assert.equal(r.ok, true);
  assert.equal(r.brain, "coder");
  assert.equal(r.requests, 2);
  assert.equal(r.tokens, 20);
  assert.ok(Math.abs(r.spend - 4.96e-6) < 1e-12);
});

test("aggregateSpend tolerates string numbers and missing fields", () => {
  const r = aggregateSpend("chat", [{ spend: "0.5" }, { total_tokens: "10" }, {}]);
  assert.equal(r.requests, 3);
  assert.equal(r.tokens, 10);
  assert.ok(Math.abs(r.spend - 0.5) < 1e-12);
});

test("aggregateSpend on empty logs = zeroed but ok", () => {
  const r = aggregateSpend("deep", []);
  assert.equal(r.ok, true);
  assert.equal(r.requests, 0);
  assert.equal(r.spend, 0);
});

test("aggregateSpend on non-array = not ok", () => {
  const r = aggregateSpend("deep", { error: "nope" });
  assert.equal(r.ok, false);
  assert.ok(r.note);
});

test("formatSpend renders a TOTAL row summing only reachable brains", () => {
  const rows: BrainSpend[] = [
    { brain: "chat", ok: true, requests: 2, tokens: 20, spend: 0.000002 },
    { brain: "deep", ok: false, requests: 0, tokens: 0, spend: 0, note: "timed out" },
    { brain: "coder", ok: true, requests: 1, tokens: 14, spend: 0.000004 },
  ];
  const out = formatSpend(rows, { chat: 4567, deep: 4568, coder: 4569 });
  assert.ok(out.includes("TOTAL"));
  assert.ok(out.includes("timed out"));       // unreachable brain surfaced, not swallowed
  assert.ok(out.includes("$0.000006"));       // 2 + 4 microdollars, deep excluded
  assert.ok(out.includes("/ui"));             // points at the LiteLLM UI
  // total requests = 3 (2 + 1), deep's 0 excluded either way
  assert.ok(out.includes("3"));
});

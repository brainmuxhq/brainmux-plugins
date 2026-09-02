import { test } from "node:test";
import assert from "node:assert/strict";
import { aggregateSpend, formatSpend, sinceMs, type BrainSpend } from "../src/core/spend.js";

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

test("aggregateSpend: 'Infinity'/'NaN' strings are treated as 0 (not a real value)", () => {
  const r = aggregateSpend("chat", [{ spend: "Infinity", total_tokens: "1e999" }, { spend: "NaN" }]);
  assert.equal(r.spend, 0);
  assert.equal(r.tokens, 0);
});

test("aggregateSpend --since: numeric epoch startTime is honored (not only ISO strings)", () => {
  const cutoff = Date.parse("2026-09-02T05:00:00.000Z");
  const newer = cutoff + 3_600_000; // epoch ms, after cutoff
  const older = cutoff - 3_600_000;
  const r = aggregateSpend("coder", [
    { spend: 2, total_tokens: 20, startTime: newer }, // numeric, in window
    { spend: 9, total_tokens: 90, startTime: older }, // numeric, before window
  ], cutoff);
  assert.equal(r.requests, 1);
  assert.equal(r.spend, 2);
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

test("sinceMs parses s/m/h/d; throws on garbage", () => {
  assert.equal(sinceMs("90s"), 90_000);
  assert.equal(sinceMs("30m"), 1_800_000);
  assert.equal(sinceMs("1h"), 3_600_000);
  assert.equal(sinceMs("7d"), 604_800_000);
  assert.throws(() => sinceMs("1w"), /--since/);
  assert.throws(() => sinceMs("abc"), /--since/);
});

test("aggregateSpend --since cutoff counts only rows at/after the cutoff", () => {
  const rows = [
    { spend: 1, total_tokens: 10, startTime: "2026-09-02T04:00:00.000Z" }, // old
    { spend: 2, total_tokens: 20, startTime: "2026-09-02T06:00:00.000Z" }, // new
    { spend: 4, total_tokens: 40, startTime: "not-a-date" },                // unparseable → excluded when filtering
  ];
  const cutoff = Date.parse("2026-09-02T05:00:00.000Z");
  const r = aggregateSpend("coder", rows, cutoff);
  assert.equal(r.requests, 1);
  assert.equal(r.tokens, 20);
  assert.equal(r.spend, 2);
  // without a cutoff, everything counts (bad startTime doesn't matter)
  assert.equal(aggregateSpend("coder", rows).requests, 3);
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

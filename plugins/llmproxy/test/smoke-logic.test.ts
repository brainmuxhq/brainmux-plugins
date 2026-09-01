import { test } from "node:test";
import assert from "node:assert/strict";
import { isAlive } from "../src/commands/test.js";

test("accepts an assistant text response", () => {
  assert.equal(isAlive('{"role":"assistant","content":[{"type":"text","text":"OK"}]}'), true);
});
test("accepts a thinking-only assistant response", () => {
  assert.equal(isAlive('{"role":"assistant","content":[{"type":"thinking","thinking":"..."}]}'), true);
});
test("rejects an error body", () => {
  assert.equal(isAlive('{"error":{"message":"bad key"}}'), false);
});

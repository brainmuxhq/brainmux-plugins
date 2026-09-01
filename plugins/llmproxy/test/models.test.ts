import { test } from "node:test";
import assert from "node:assert/strict";
import { runModels } from "../src/commands/models.js";

test("bmux models --use-cases prints the catalog offline", async () => {
  const out: string[] = [];
  const orig = console.log;
  console.log = (...a: unknown[]) => { out.push(a.join(" ")); };
  try {
    const code = await runModels(["--use-cases"]);
    assert.equal(code, 0);
  } finally {
    console.log = orig;
  }
  const text = out.join("\n");
  assert.ok(text.includes("coding"));
  assert.ok(text.includes("chat"));
});

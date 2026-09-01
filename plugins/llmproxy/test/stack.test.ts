import { test } from "node:test";
import assert from "node:assert/strict";
import { upSummary } from "../src/commands/stack.js";
import { parseBrains } from "../src/core/manifest.js";

const CFG = parseBrains(`version: 1
brains:
  chat:  { port: 4567, model: openrouter/qwen/qwen3.7-flash,    providerKey: OPENROUTER_API_KEY }
  coder: { port: 4569, model: openrouter/qwen/qwen3-coder-next, providerKey: OPENROUTER_API_KEY }
`);

test("upSummary lists each brain's UI URL and master-key env var (never the secret)", () => {
  const out = upSummary(CFG);
  assert.ok(out.includes("http://127.0.0.1:4567/ui"));
  assert.ok(out.includes("http://127.0.0.1:4569/ui"));
  assert.ok(out.includes("$CHAT_MASTER_KEY"));   // references the var name...
  assert.ok(out.includes("$CODER_MASTER_KEY"));
  assert.ok(out.includes("admin"));              // login username hint
  assert.ok(!out.includes("sk-"));               // ...not any actual secret value
});

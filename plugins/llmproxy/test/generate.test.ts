import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseBrains } from "../src/core/manifest.js";
import { generate, dbName, masterKeyVar } from "../src/core/generate.js";

const here = path.dirname(fileURLToPath(import.meta.url));
// fixtures live in the source tree, not dist — walk back to plugins/llmproxy/test
const fixDir = path.resolve(here, "../../test/fixtures/three-brains");

const cfg = parseBrains(`
version: 1
brains:
  chat:  { port: 4567, model: openrouter/qwen/qwen3.7-flash,    providerKey: OPENROUTER_API_KEY }
  deep:  { port: 4568, model: openrouter/z-ai/glm-5.2,          providerKey: OPENROUTER_API_KEY }
  coder: { port: 4569, model: openrouter/qwen/qwen3-coder-next, providerKey: OPENROUTER_API_KEY }
`);

function fixture(rel: string): string {
  return fs.readFileSync(path.join(fixDir, rel), "utf8");
}

test("helpers derive db + master-key names", () => {
  assert.equal(dbName("chat"), "litellm_chat");
  assert.equal(masterKeyVar("chat"), "CHAT_MASTER_KEY");
});

test("compose matches golden", () => {
  assert.equal(generate(cfg).compose, fixture("compose.yaml"));
});

test("per-brain configs match golden", () => {
  const g = generate(cfg);
  assert.equal(g.configs.chat, fixture("chat.yaml"));
  assert.equal(g.configs.deep, fixture("deep.yaml"));
  assert.equal(g.configs.coder, fixture("coder.yaml"));
});

test("init sql matches golden", () => {
  assert.equal(generate(cfg).initSql, fixture("init/01-databases.sql"));
});

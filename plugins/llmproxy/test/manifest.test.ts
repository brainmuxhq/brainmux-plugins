import { test } from "node:test";
import assert from "node:assert/strict";
import { parseBrains } from "../src/core/manifest.js";

const good = `
version: 1
brains:
  chat:  { port: 4567, model: openrouter/qwen/qwen3.7-flash,    providerKey: OPENROUTER_API_KEY }
  deep:  { port: 4568, model: openrouter/z-ai/glm-5.2,          providerKey: OPENROUTER_API_KEY }
  coder: { port: 4569, model: openrouter/qwen/qwen3-coder-next, providerKey: OPENROUTER_API_KEY }
`;

test("parses a valid three-brain manifest", () => {
  const cfg = parseBrains(good);
  assert.equal(cfg.version, 1);
  assert.equal(Object.keys(cfg.brains).length, 3);
  assert.equal(cfg.brains.chat.port, 4567);
  assert.equal(cfg.brains.deep.model, "openrouter/z-ai/glm-5.2");
  assert.equal(cfg.brains.coder.providerKey, "OPENROUTER_API_KEY");
});

test("rejects wrong version", () => {
  assert.throws(() => parseBrains("version: 2\nbrains: {}"), /version/i);
});

test("rejects duplicate ports", () => {
  const dup = `
version: 1
brains:
  a: { port: 4000, model: openrouter/x, providerKey: OPENROUTER_API_KEY }
  b: { port: 4000, model: openrouter/y, providerKey: OPENROUTER_API_KEY }
`;
  assert.throws(() => parseBrains(dup), /port/i);
});

test("rejects a bad brain name", () => {
  const bad = `
version: 1
brains:
  "Chat!": { port: 4001, model: openrouter/x, providerKey: OPENROUTER_API_KEY }
`;
  assert.throws(() => parseBrains(bad), /name/i);
});

test("rejects a non-env-style providerKey", () => {
  const bad = `
version: 1
brains:
  chat: { port: 4001, model: openrouter/x, providerKey: my-key }
`;
  assert.throws(() => parseBrains(bad), /providerKey/i);
});

test("rejects a model with YAML-injection chars (space/newline), accepts a bare slug", () => {
  // A model value carrying a space would let a quoted string smuggle newlines into the
  // generated per-brain config.yaml — the regex blocks anything but a bare model id.
  const inject = `
version: 1
brains:
  chat: { port: 4001, model: "x\\n    master_key: evil", providerKey: OPENROUTER_API_KEY }
`;
  assert.throws(() => parseBrains(inject), /model/i);
  // legitimate slugs (with / . _ - : variant suffix) still parse
  assert.ok(parseBrains("version: 1\nbrains:\n  c: { port: 4001, model: openrouter/qwen/qwen3.7-flash:free, providerKey: OPENROUTER_API_KEY }"));
});

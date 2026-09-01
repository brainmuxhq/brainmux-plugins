import { test } from "node:test";
import assert from "node:assert/strict";
import { getUseCases, parseModelsPayload, formatModels } from "../src/core/openrouter.js";

const payload = {
  data: [
    { id: "z/expensive", name: "Exp", context_length: 8000, pricing: { prompt: 0.00001, completion: 0.00003 }, architecture: { modality: "text->text" } },
    { id: "a/cheap-coder", name: "Cheap Coder", context_length: 131072, pricing: { prompt: 0.0000001, completion: 0.0000002 }, architecture: { modality: "text->text" } },
    { id: "b/no-price", name: "NoPrice", context_length: null, pricing: {}, architecture: {} },
  ],
};

test("getUseCases returns the guidance catalog", () => {
  const ids = getUseCases().map((u) => u.id);
  assert.deepEqual(ids, ["chat", "coding", "deep", "cheap", "long"]);
  assert.ok(getUseCases().every((u) => u.label && u.guidance));
});

test("parseModelsPayload maps fields and tolerates missing pricing/modality", () => {
  const rows = parseModelsPayload(payload);
  assert.equal(rows.length, 3);
  const coder = rows.find((r) => r.id === "a/cheap-coder")!;
  assert.equal(coder.contextLength, 131072);
  assert.equal(coder.promptPrice, 0.0000001);
  assert.equal(coder.modality, "text->text");
  const np = rows.find((r) => r.id === "b/no-price")!;
  assert.equal(np.promptPrice, null);
  assert.equal(np.contextLength, null);
  assert.equal(np.modality, "text->text"); // default
});

test("parseModelsPayload throws on a bad shape", () => {
  assert.throws(() => parseModelsPayload({ nope: 1 }), /data/i);
});

test("formatModels filters by query and sorts by prompt price asc", () => {
  const out = formatModels(parseModelsPayload(payload));
  assert.ok(out.indexOf("a/cheap-coder") < out.indexOf("z/expensive"));
  const filtered = formatModels(parseModelsPayload(payload), { query: "coder" });
  assert.ok(filtered.includes("a/cheap-coder"));
  assert.ok(!filtered.includes("z/expensive"));
});

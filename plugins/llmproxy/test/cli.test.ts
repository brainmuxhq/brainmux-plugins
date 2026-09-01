import { test } from "node:test";
import assert from "node:assert/strict";
import { main } from "../src/cli.js";

test("help returns 0", async () => {
  assert.equal(await main(["--help"], {}), 0);
});
test("no command prints help and returns 0", async () => {
  assert.equal(await main([], {}), 0);
});
test("unknown command returns 1", async () => {
  assert.equal(await main(["frobnicate"], {}), 1);
});

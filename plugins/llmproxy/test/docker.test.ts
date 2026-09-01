import { test } from "node:test";
import assert from "node:assert/strict";
import { composeArgs } from "../src/core/docker.js";
import { resolvePaths } from "../src/core/paths.js";

test("composeArgs points -f at the generated compose file", () => {
  const p = resolvePaths({ BRAINMUX_HOME: "/x" });
  assert.deepEqual(composeArgs(p), ["compose", "-f", "/x/generated/compose.yaml"]);
});

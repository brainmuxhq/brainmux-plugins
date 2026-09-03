import { test } from "node:test";
import assert from "node:assert/strict";
import { hookBlock, applyBlock, stripBlock, hasBlock, HOOK_NAMES } from "../src/commands/hook.js";

test("hookBlock is a marked, self-resolving, non-blocking sync snippet", () => {
  const b = hookBlock();
  assert.match(b, /# >>> graphmux auto-sync >>>/);
  assert.match(b, /# <<< graphmux auto-sync <<</);
  assert.match(b, /codegraph/);
  assert.match(b, /sync -q/);
  assert.match(b, /\|\| true/); // never blocks git
  assert.match(b, /DO_NOT_TRACK=1/); // telemetry off
});

test("HOOK_NAMES targets the three git events that change the tree", () => {
  assert.deepEqual([...HOOK_NAMES], ["post-commit", "post-merge", "post-checkout"]);
});

test("applyBlock adds a shebang + block to an empty hook", () => {
  const out = applyBlock("", hookBlock());
  assert.match(out, /^#!\/bin\/sh\n/);
  assert.ok(hasBlock(out));
});

test("applyBlock appends to an existing user hook without clobbering it", () => {
  const user = "#!/bin/sh\necho existing-hook\n";
  const out = applyBlock(user, hookBlock());
  assert.match(out, /echo existing-hook/);
  assert.ok(hasBlock(out));
});

test("applyBlock is idempotent — re-applying does not duplicate the block", () => {
  const once = applyBlock("#!/bin/sh\necho x\n", hookBlock());
  const twice = applyBlock(once, hookBlock());
  assert.equal(once, twice);
  assert.equal(twice.match(/graphmux auto-sync >>>/g)?.length, 1);
});

test("stripBlock removes our block but keeps user content", () => {
  const user = "#!/bin/sh\necho keep-me\n";
  const withBlock = applyBlock(user, hookBlock());
  const stripped = stripBlock(withBlock);
  assert.match(stripped, /echo keep-me/);
  assert.equal(hasBlock(stripped), false);
});

test("stripBlock on a block-only hook yields empty (file becomes removable)", () => {
  const only = applyBlock("", hookBlock());
  const stripped = stripBlock(only);
  // only a shebang (or nothing) may remain — no managed block
  assert.equal(hasBlock(stripped), false);
  assert.ok(stripped.replace(/#!\/bin\/sh\s*/, "").trim() === "");
});

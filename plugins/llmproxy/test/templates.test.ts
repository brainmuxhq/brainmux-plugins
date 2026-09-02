import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { resolvePaths } from "../src/core/paths.js";
import { BUILTIN_TEMPLATES, resolveTemplate, saveUserTemplate, loadUserTemplates, allTemplates } from "../src/core/templates.js";

function tmpPaths() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "bmux-tpl-"));
  return resolvePaths({ BRAINMUX_HOME: home });
}

test("built-ins exist and resolve; unknown throws with the available list", () => {
  const p = tmpPaths();
  for (const n of ["audit", "drift-scan", "review", "todo-scan"]) assert.ok(BUILTIN_TEMPLATES[n]);
  assert.equal(resolveTemplate("audit", p), BUILTIN_TEMPLATES.audit);
  assert.throws(() => resolveTemplate("nope", p), /no template 'nope'.*audit/s);
});

test("user templates persist and override built-ins", () => {
  const p = tmpPaths();
  assert.deepEqual(loadUserTemplates(p), {}); // none yet
  saveUserTemplate(p, "isg-audit", "Audit for İSG risks. file:line only.");
  saveUserTemplate(p, "audit", "MY audit prompt"); // override a built-in name
  const reloaded = loadUserTemplates(p);
  assert.equal(reloaded["isg-audit"], "Audit for İSG risks. file:line only.");
  const all = allTemplates(p);
  assert.equal(all["isg-audit"], "Audit for İSG risks. file:line only."); // user-added
  assert.equal(all.audit, "MY audit prompt"); // user overrides built-in
  assert.equal(resolveTemplate("drift-scan", p), BUILTIN_TEMPLATES["drift-scan"]); // untouched built-in still there
});

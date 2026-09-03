import { test } from "node:test";
import assert from "node:assert/strict";
import { parseArgs, filterBySymbol } from "../src/commands/drift.js";

test("filterBySymbol keeps only lines mentioning the symbol (case-insensitive) — model-scoped", () => {
  const lines = [
    "src/a.ts:10:  prisma.profil.findUnique(...)",
    "src/b.ts:22:  prisma.user.create(...)",
    "src/c.ts:5:   prisma.Profil.update(...)",
  ];
  assert.deepEqual(filterBySymbol(lines, "Profil"), [
    "src/a.ts:10:  prisma.profil.findUnique(...)",
    "src/c.ts:5:   prisma.Profil.update(...)",
  ]);
  assert.deepEqual(filterBySymbol(lines, "user"), ["src/b.ts:22:  prisma.user.create(...)"]);
});

test("parseArgs: symbol + path + flags; --zone value is not taken as symbol/path", () => {
  const cwd = "/repo";
  assert.deepEqual(parseArgs(["normalizeEmail"], cwd), {
    symbol: "normalizeEmail",
    projectPath: "/repo",
    json: false,
    noSync: false,
    listZones: false,
  });

  // --zone <value> must be skipped so the symbol/path parse correctly
  const a = parseArgs(["--zone", "orm=db\\.x\\(", "Profil", "packages/x", "--json"], cwd);
  assert.equal(a.symbol, "Profil");
  assert.equal(a.projectPath, "/repo/packages/x");
  assert.equal(a.json, true);

  assert.equal(parseArgs(["--list-zones"], cwd).listZones, true);
  assert.equal(parseArgs(["x", "--no-sync"], cwd).noSync, true);
});

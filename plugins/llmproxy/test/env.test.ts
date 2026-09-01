import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { parseEnv, readEnv, writeEnv, getKey, setKey, genSecret } from "../src/core/env.js";

function tmp(): string {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), "bmux-env-")), ".env");
}

test("parseEnv ignores comments and blanks, keeps = in values", () => {
  const m = parseEnv("# c\n\nA=1\nB=x=y\n");
  assert.equal(m.get("A"), "1");
  assert.equal(m.get("B"), "x=y");
  assert.equal(m.size, 2);
});

test("writeEnv round-trips and sets mode 600", () => {
  const f = tmp();
  writeEnv(f, new Map([["A", "1"], ["B", "2"]]));
  assert.equal((fs.statSync(f).mode & 0o777), 0o600);
  const m = readEnv(f);
  assert.equal(m.get("A"), "1");
  assert.equal(m.get("B"), "2");
});

test("setKey upserts without dropping siblings", () => {
  const f = tmp();
  writeEnv(f, new Map([["A", "1"]]));
  setKey(f, "B", "2");
  setKey(f, "A", "9");
  assert.equal(getKey(f, "A"), "9");
  assert.equal(getKey(f, "B"), "2");
});

test("readEnv returns empty map for a missing file", () => {
  assert.equal(readEnv("/no/such/.env").size, 0);
});

test("genSecret returns 32 hex chars for 16 bytes and varies", () => {
  const a = genSecret();
  assert.match(a, /^[0-9a-f]{32}$/);
  assert.notEqual(a, genSecret());
});

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { runInit } from "../src/commands/init.js";
import { readEnv } from "../src/core/env.js";

function home(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "bmux-home-"));
}

test("init scaffolds state, keys, and generated artifacts", () => {
  const h = home();
  const code = runInit({ BRAINMUX_HOME: h });
  assert.equal(code, 0);
  assert.ok(fs.existsSync(path.join(h, "brains.yaml")));
  assert.ok(fs.existsSync(path.join(h, "generated", "compose.yaml")));
  assert.ok(fs.existsSync(path.join(h, "generated", "chat.yaml")));
  assert.ok(fs.existsSync(path.join(h, "generated", "init", "01-databases.sql")));
  assert.ok(fs.existsSync(path.join(h, "data", "postgres")));
  const env = readEnv(path.join(h, ".env"));
  for (const k of ["POSTGRES_PASSWORD", "LITELLM_SALT_KEY", "CHAT_MASTER_KEY", "DEEP_MASTER_KEY", "CODER_MASTER_KEY"]) {
    assert.ok((env.get(k) ?? "").length > 0, `${k} generated`);
  }
});

test("init is idempotent — second run keeps existing keys", () => {
  const h = home();
  runInit({ BRAINMUX_HOME: h });
  const first = readEnv(path.join(h, ".env")).get("LITELLM_SALT_KEY");
  runInit({ BRAINMUX_HOME: h });
  const second = readEnv(path.join(h, ".env")).get("LITELLM_SALT_KEY");
  assert.equal(first, second);
});

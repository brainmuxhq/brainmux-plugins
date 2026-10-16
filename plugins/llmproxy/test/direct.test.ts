import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { parseBrains, loadBrains, isDirect, DEFAULT_MAX_OUTPUT_TOKENS, type DirectBrain } from "../src/core/manifest.js";
import { generate } from "../src/core/generate.js";
import { readAuthToken, expandHome } from "../src/core/authtoken.js";
import { readEnv } from "../src/core/env.js";
import { runInit } from "../src/commands/init.js";
import { planLaunch, brainEnv } from "../src/commands/launch.js";
import { runStack } from "../src/commands/stack.js";
import { runSpend } from "../src/commands/spend.js";
import { runConfig } from "../src/commands/config.js";
import { messagesProbe, runTest } from "../src/commands/test.js";
import { runDelegate } from "../src/commands/delegate.js";

const TOKEN = "ev-secret-token-123";

function tmp(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

/** A BRAINMUX_HOME holding only a direct brain + its 600 token file. */
function directHome(url = "http://192.0.2.10:8000", extra = ""): { home: string; tokenFile: string } {
  const home = tmp("bmux-direct-");
  const tokenFile = path.join(home, "ev-llm-key");
  fs.writeFileSync(tokenFile, TOKEN + "\n", { mode: 0o600 });
  fs.writeFileSync(
    path.join(home, "brains.yaml"),
    `version: 1\nbrains:\n  ev: { url: "${url}", model: qwen3.8-27b, authTokenFile: ${tokenFile}${extra} }\n`,
  );
  return { home, tokenFile };
}

// --- manifest ---------------------------------------------------------------

test("manifest: a url brain parses as direct, next to a LiteLLM brain", () => {
  const cfg = parseBrains(`version: 1
brains:
  chat: { port: 4567, model: openrouter/x/y, providerKey: OPENROUTER_API_KEY }
  ev:   { url: "http://192.0.2.10:8000", model: qwen3.8-27b, authTokenFile: ~/.config/brainmux/ev-llm-key, maxOutputTokens: 32000 }
`);
  assert.equal(isDirect(cfg.brains.chat), false);
  assert.ok(isDirect(cfg.brains.ev));
  const ev = cfg.brains.ev as DirectBrain;
  assert.equal(ev.url, "http://192.0.2.10:8000");
  assert.equal(ev.authTokenFile, "~/.config/brainmux/ev-llm-key");
  assert.equal(ev.maxOutputTokens, 32000);
});

test("manifest: direct url must be http(s); stray LiteLLM keys on a url brain are rejected", () => {
  assert.throws(() => parseBrains(`version: 1\nbrains:\n  ev: { url: "ftp://h:1", model: m, authTokenFile: /k }`), /http:\/\/ or https:\/\//);
  assert.throws(() => parseBrains(`version: 1\nbrains:\n  ev: { url: "not a url", model: m, authTokenFile: /k }`), /absolute URL/);
  assert.throws(() => parseBrains(`version: 1\nbrains:\n  ev: { url: "http://h:1", port: 4000, model: m, authTokenFile: /k }`), /brains\.ev.*port|Unrecognized/i);
  assert.throws(() => parseBrains(`version: 1\nbrains:\n  ev: { url: "http://h:1", model: m }`), /brains\.ev\.authTokenFile/);
  assert.throws(() => parseBrains(`version: 1\nbrains:\n  ev: { url: "http://h:1", model: "a b", authTokenFile: /k }`), /model/);
});

test("manifest: direct brains are outside the duplicate-port check", () => {
  const cfg = parseBrains(`version: 1
brains:
  a: { url: "http://h:8000", model: m, authTokenFile: /k }
  b: { url: "http://h:8000", model: m, authTokenFile: /k }
  c: { port: 8000, model: m, providerKey: OPENROUTER_API_KEY }
`);
  assert.equal(Object.keys(cfg.brains).length, 3);
});

// --- generate / init / stack / spend ----------------------------------------

test("generate: direct brains get no container, config or database", () => {
  const g = generate(parseBrains(`version: 1
brains:
  chat: { port: 4567, model: openrouter/x/y, providerKey: OPENROUTER_API_KEY }
  ev:   { url: "http://h:8000", model: qwen3.8-27b, authTokenFile: /k }
`));
  assert.ok(g.compose.includes("brainmux-chat"));
  assert.ok(!g.compose.includes("brainmux-ev"));
  assert.deepEqual(Object.keys(g.configs), ["chat"]);
  assert.ok(!g.initSql.includes("litellm_ev"));
});

test("init with only a direct brain: works, writes no stack secrets, no token into .env", () => {
  const { home } = directHome();
  assert.equal(runInit({ BRAINMUX_HOME: home }), 0);
  const env = readEnv(path.join(home, ".env"));
  assert.equal(env.size, 0, `.env should stay empty, got: ${[...env.keys()].join(",")}`);
  assert.ok(!fs.readFileSync(path.join(home, ".env"), "utf8").includes(TOKEN));
  assert.ok(!fs.existsSync(path.join(home, "data", "postgres")), "no Postgres volume without a stack");
});

test("up/ps/health/spend with no LiteLLM brains: exit 0 without touching docker", async () => {
  const { home } = directHome();
  runInit({ BRAINMUX_HOME: home });
  // PATH is empty, so any docker call would fail — a 0 proves it was never attempted.
  const env = { BRAINMUX_HOME: home, PATH: "" };
  for (const sub of ["up", "ps", "health", "restart", "down"]) assert.equal(await runStack(sub, [], env), 0, sub);
  assert.equal(await runSpend([], env), 0);
});

// --- token file -------------------------------------------------------------

test("readAuthToken: reads + trims a 600 file, expands ~", () => {
  const home = tmp("bmux-tok-");
  fs.mkdirSync(path.join(home, ".config"));
  const f = path.join(home, ".config", "key");
  fs.writeFileSync(f, `  ${TOKEN}\n`, { mode: 0o600 });
  assert.equal(readAuthToken("~/.config/key", home), TOKEN);
  assert.equal(expandHome("~/x", "/h"), "/h/x");
  assert.equal(expandHome("/abs/x", "/h"), "/abs/x");
});

test("readAuthToken: refuses group/world-readable, missing, empty — never echoing the token", () => {
  const dir = tmp("bmux-tok2-");
  const loose = path.join(dir, "loose");
  fs.writeFileSync(loose, TOKEN);
  fs.chmodSync(loose, 0o644);
  assert.throws(() => readAuthToken(loose), (e: Error) => /chmod 600/.test(e.message) && !e.message.includes(TOKEN));
  fs.chmodSync(loose, 0o640);
  assert.throws(() => readAuthToken(loose), /group\/others/);
  assert.throws(() => readAuthToken(path.join(dir, "nope")), /not found/);
  const empty = path.join(dir, "empty");
  fs.writeFileSync(empty, "\n", { mode: 0o600 });
  assert.throws(() => readAuthToken(empty), /empty/);
  assert.throws(() => readAuthToken(dir), /not a regular file/);
});

// --- launch plan ------------------------------------------------------------

test("planLaunch direct: base url, Bearer token from file, every model slot, max output, API key unset", () => {
  const { home } = directHome("http://192.0.2.10:8000/");
  const plan = planLaunch("ev", { BRAINMUX_HOME: home });
  assert.equal(plan.direct, true);
  assert.equal(plan.base, "http://192.0.2.10:8000"); // trailing slash dropped (Claude Code appends /v1/messages)
  assert.equal(plan.set.ANTHROPIC_BASE_URL, "http://192.0.2.10:8000");
  assert.equal(plan.set.ANTHROPIC_AUTH_TOKEN, TOKEN);
  for (const k of ["ANTHROPIC_MODEL", "ANTHROPIC_DEFAULT_OPUS_MODEL", "ANTHROPIC_DEFAULT_SONNET_MODEL", "ANTHROPIC_DEFAULT_HAIKU_MODEL", "ANTHROPIC_SMALL_FAST_MODEL", "CLAUDE_CODE_SUBAGENT_MODEL"]) {
    assert.equal(plan.set[k], "qwen3.8-27b", k);
  }
  assert.equal(plan.set.CLAUDE_CODE_MAX_OUTPUT_TOKENS, String(DEFAULT_MAX_OUTPUT_TOKENS));
  assert.equal(plan.set.BRAINMUX_BRAIN, "ev");
  assert.ok(!("ANTHROPIC_API_KEY" in plan.set));

  const child = brainEnv(plan, { ANTHROPIC_API_KEY: "sk-parent", PATH: "/bin" }, { DELEGATE_DEPTH: "1" });
  assert.ok(!("ANTHROPIC_API_KEY" in child), "a parent ANTHROPIC_API_KEY must not reach the child (it would be sent as x-api-key)");
  assert.equal(child.ANTHROPIC_AUTH_TOKEN, TOKEN);
  assert.equal(child.DELEGATE_DEPTH, "1");
  assert.equal(child.PATH, "/bin");
});

test("planLaunch direct: custom maxOutputTokens; loose token file is refused", () => {
  const { home, tokenFile } = directHome("http://h:8000", ", maxOutputTokens: 32000");
  assert.equal(planLaunch("ev", { BRAINMUX_HOME: home }).set.CLAUDE_CODE_MAX_OUTPUT_TOKENS, "32000");
  fs.chmodSync(tokenFile, 0o604);
  assert.throws(() => planLaunch("ev", { BRAINMUX_HOME: home }), /chmod 600/);
});

// --- config -----------------------------------------------------------------

test("config add-direct writes a direct brain (path only, never the token) and keeps the stack untouched", async () => {
  const home = tmp("bmux-cfgd-");
  runInit({ BRAINMUX_HOME: home }); // default three LiteLLM brains
  const env = { BRAINMUX_HOME: home };
  assert.equal(await runConfig("add-direct", ["ev", "http://192.0.2.10:8000", "qwen3.8-27b", "~/.config/brainmux/ev-llm-key", "24000"], env), 0);
  const ev = loadBrains(path.join(home, "brains.yaml")).brains.ev as DirectBrain;
  assert.deepEqual(ev, { url: "http://192.0.2.10:8000", model: "qwen3.8-27b", authTokenFile: "~/.config/brainmux/ev-llm-key", maxOutputTokens: 24000 });
  assert.ok(!fs.readFileSync(path.join(home, "generated", "compose.yaml"), "utf8").includes("brainmux-ev"));
  assert.ok(!readEnv(path.join(home, ".env")).has("EV_MASTER_KEY"));
  assert.notEqual(await runConfig("add-direct", ["bad", "ftp://x", "m", "/k"], env), 0);
  assert.notEqual(await runConfig("add-direct", ["ev2", "http://x", "m", "/k", "0"], env), 0);
});

// --- smoke probe (local fake server; no network) ----------------------------

function fakeMessagesServer(): Promise<{ url: string; seen: Array<{ auth?: string; xkey?: string; model?: string; path?: string }>; close: () => void }> {
  const seen: Array<{ auth?: string; xkey?: string; model?: string; path?: string }> = [];
  const srv = http.createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      seen.push({ auth: req.headers.authorization, xkey: req.headers["x-api-key"] as string | undefined, model: JSON.parse(body).model, path: req.url });
      if (req.headers.authorization !== `Bearer ${TOKEN}`) { res.writeHead(401); res.end('{"error":"unauthorized"}'); return; }
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ role: "assistant", content: [{ type: "text", text: "OK" }] }));
    });
  });
  return new Promise((resolve) => srv.listen(0, "127.0.0.1", () => {
    const { port } = srv.address() as AddressInfo;
    resolve({ url: `http://127.0.0.1:${port}`, seen, close: () => srv.close() });
  }));
}

test("bmux test probes a direct brain with Bearer auth + its real model id (no x-api-key)", async () => {
  const s = await fakeMessagesServer();
  try {
    const { home } = directHome(s.url);
    assert.equal(await runTest({ BRAINMUX_HOME: home }), 0);
    assert.equal(s.seen.length, 1);
    assert.deepEqual(s.seen[0], { auth: `Bearer ${TOKEN}`, xkey: undefined, model: "qwen3.8-27b", path: "/v1/messages" });
    // and a wrong token is reported as FAIL
    assert.notEqual(await messagesProbe({ base: s.url, model: "m", headers: { authorization: "Bearer nope" } }).then((o) => o.includes("unauthorized") ? 1 : 0), 0);
  } finally {
    s.close();
  }
});

// --- delegate end-to-end with a fake `claude` (records its env; no model call) -----------

test("delegate on a direct brain hands the child claude Bearer env, no API key", async () => {
  const { home } = directHome("http://192.0.2.10:8000");
  const bin = tmp("bmux-fakeclaude-");
  const dump = path.join(bin, "env.txt");
  fs.writeFileSync(path.join(bin, "claude"), `#!/bin/sh\nenv > "${dump}"\necho '{"result":"done","is_error":false}'\n`, { mode: 0o755 });
  const code = await runDelegate(["ev", "--json", "say hi"], {
    BRAINMUX_HOME: home, PATH: `${bin}:${process.env.PATH}`, ANTHROPIC_API_KEY: "sk-parent-should-vanish",
  });
  assert.equal(code, 0);
  const env = new Map(fs.readFileSync(dump, "utf8").split("\n").filter(Boolean).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]));
  assert.equal(env.get("ANTHROPIC_BASE_URL"), "http://192.0.2.10:8000");
  assert.equal(env.get("ANTHROPIC_AUTH_TOKEN"), TOKEN);
  assert.equal(env.get("ANTHROPIC_MODEL"), "qwen3.8-27b");
  assert.equal(env.get("CLAUDE_CODE_MAX_OUTPUT_TOKENS"), "20000");
  assert.equal(env.get("DELEGATE_DEPTH"), "1");
  assert.ok(!env.has("ANTHROPIC_API_KEY"));
});

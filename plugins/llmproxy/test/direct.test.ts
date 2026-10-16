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
import { runDelegate, parseDelegateArgs } from "../src/commands/delegate.js";
import { thinkingEnv, ANSWER_ROOM } from "../src/core/thinking.js";
import { contextEnv, compactAt, CONTEXT_SAFETY } from "../src/core/context.js";
import { spawn } from "node:child_process";

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
  // default thinking = medium (16K budget) → max_tokens raised to budget + ANSWER_ROOM above the 20000 default
  assert.equal(plan.thinking, "medium");
  assert.equal(plan.set.CLAUDE_CODE_MAX_OUTPUT_TOKENS, String(Math.max(DEFAULT_MAX_OUTPUT_TOKENS, 16384 + ANSWER_ROOM)));
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
  assert.equal(await runConfig("add-direct", ["ev3", "http://192.0.2.10:8000", "m", "/k", "20000", "131072"], env), 0);
  assert.equal((loadBrains(path.join(home, "brains.yaml")).brains.ev3 as DirectBrain).contextWindow, 131072);
  assert.notEqual(await runConfig("add-direct", ["ev4", "http://x", "m", "/k", "20000", "100"], env), 0);
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
  assert.equal(env.get("CLAUDE_CODE_MAX_OUTPUT_TOKENS"), "20480");
  assert.equal(env.get("MAX_THINKING_TOKENS"), "16384"); // default thinking = medium
  assert.equal(env.get("CLAUDE_CODE_EFFORT_LEVEL"), "medium");
  assert.equal(env.get("DELEGATE_DEPTH"), "1");
  assert.ok(!env.has("ANTHROPIC_API_KEY"));
});

// --- thinking level ----------------------------------------------------------

test("thinkingEnv: each level → budget, effort (never high/max), capabilities, max_tokens above the budget", () => {
  const off = thinkingEnv("off", "qwen3.8-27b", 20000);
  assert.deepEqual(off.set, {
    CLAUDE_CODE_MODEL_CAPABILITIES: "qwen3.8-27b=thinking,-adaptive_thinking,-rejects_disabled_thinking,-max_effort,-effort,-xhigh_effort",
    MAX_THINKING_TOKENS: "0",
    CLAUDE_CODE_MAX_OUTPUT_TOKENS: "20000",
  });
  assert.deepEqual(off.unset, ["CLAUDE_CODE_DISABLE_THINKING", "CLAUDE_CODE_EFFORT_LEVEL"]);
  const caps = "qwen3.8-27b=thinking,-adaptive_thinking,-rejects_disabled_thinking,-max_effort,effort,xhigh_effort";
  for (const [lvl, budget, effort, max] of [["low", 4096, "low", 20000], ["medium", 16384, "medium", 20480], ["deep", 32768, "xhigh", 36864]] as const) {
    const t = thinkingEnv(lvl, "qwen3.8-27b", 20000);
    assert.deepEqual(t.set, { CLAUDE_CODE_MODEL_CAPABILITIES: caps, MAX_THINKING_TOKENS: String(budget), CLAUDE_CODE_MAX_OUTPUT_TOKENS: String(max), CLAUDE_CODE_EFFORT_LEVEL: effort }, lvl);
    assert.deepEqual(t.unset, ["CLAUDE_CODE_DISABLE_THINKING"]);
  }
  // a larger configured maxOutputTokens is kept
  assert.equal(thinkingEnv("deep", "m", 64000).set.CLAUDE_CODE_MAX_OUTPUT_TOKENS, "64000");
});

test("manifest: direct brain thinking level parses; an unknown level is rejected", () => {
  const ev = parseBrains(`version: 1\nbrains:\n  ev: { url: "http://h:1", model: m, authTokenFile: /k, thinking: deep }`).brains.ev as DirectBrain;
  assert.equal(ev.thinking, "deep");
  assert.throws(() => parseBrains(`version: 1\nbrains:\n  ev: { url: "http://h:1", model: m, authTokenFile: /k, thinking: high }`), /thinking must be one of off\|low\|medium\|deep/);
  assert.throws(() => parseBrains(`version: 1\nbrains:\n  c: { port: 4000, model: m, providerKey: K, thinking: low }`), /thinking is for direct \(url\) brains only/);
});

test("planLaunch: brains.yaml thinking is the default, the override wins, LiteLLM brains refuse it", () => {
  const { home } = directHome("http://h:8000", ", thinking: low");
  const env = { BRAINMUX_HOME: home };
  assert.equal(planLaunch("ev", env).set.MAX_THINKING_TOKENS, "4096");
  const off = planLaunch("ev", env, "off");
  assert.equal(off.thinking, "off");
  assert.equal(off.set.MAX_THINKING_TOKENS, "0");
  assert.ok(!("CLAUDE_CODE_EFFORT_LEVEL" in off.set));
  const child = brainEnv(off, { CLAUDE_CODE_EFFORT_LEVEL: "max", CLAUDE_CODE_DISABLE_THINKING: "1" });
  assert.ok(!("CLAUDE_CODE_EFFORT_LEVEL" in child) && !("CLAUDE_CODE_DISABLE_THINKING" in child), "inherited thinking/effort vars must not leak");
  // a parent effort is overridden, not inherited
  assert.equal(brainEnv(planLaunch("ev", env, "deep"), { CLAUDE_CODE_EFFORT_LEVEL: "max" }).CLAUDE_CODE_EFFORT_LEVEL, "xhigh");

  const lh = tmp("bmux-th-litellm-");
  runInit({ BRAINMUX_HOME: lh });
  assert.equal(planLaunch("chat", { BRAINMUX_HOME: lh }).thinking, null);
  assert.throws(() => planLaunch("chat", { BRAINMUX_HOME: lh }, "low"), /direct brains only/);
});

test("delegate --thinking: parsed and validated", () => {
  assert.equal(parseDelegateArgs(["ev", "task"]).opts.thinking, null);
  assert.equal(parseDelegateArgs(["ev", "--thinking", "deep", "task"]).opts.thinking, "deep");
  assert.throws(() => parseDelegateArgs(["ev", "--thinking", "high", "task"]), /--thinking must be one of off\|low\|medium\|deep/);
  assert.throws(() => parseDelegateArgs(["ev", "--thinking"]), /--thinking must be one of/);
});

test("delegate --thinking off on a direct brain reaches the child env", async () => {
  const { home } = directHome("http://192.0.2.10:8000", ", thinking: deep");
  const bin = tmp("bmux-fakeclaude-th-");
  const dump = path.join(bin, "env.txt");
  fs.writeFileSync(path.join(bin, "claude"), `#!/bin/sh\nenv > "${dump}"\necho '{"result":"done","is_error":false}'\n`, { mode: 0o755 });
  assert.equal(await runDelegate(["ev", "--json", "--thinking", "off", "say hi"], { BRAINMUX_HOME: home, PATH: `${bin}:${process.env.PATH}` }), 0);
  const env = fs.readFileSync(dump, "utf8");
  assert.match(env, /^MAX_THINKING_TOKENS=0$/m);
  assert.doesNotMatch(env, /^CLAUDE_CODE_EFFORT_LEVEL=/m);
});

// --- the real Claude Code against a local fake /v1/messages (opt-in: BMUX_CLAUDE_E2E=1) -------
// Proves what the installed `claude` actually SENDS per level. No model is called: the base URL
// is a 127.0.0.1 server that records the request body and answers "OK".

function recordingServer(): Promise<{ url: string; bodies: any[]; close: () => void }> {
  const bodies: any[] = [];
  const srv = http.createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      const j = body ? JSON.parse(body) : {};
      if (req.url?.startsWith("/v1/messages") && !req.url.includes("count_tokens")) bodies.push(j);
      if (!j.stream) { res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify({ id: "m", type: "message", role: "assistant", model: j.model, content: [{ type: "text", text: "OK" }], stop_reason: "end_turn", stop_sequence: null, usage: { input_tokens: 1, output_tokens: 1 }, input_tokens: 1 })); return; }
      res.writeHead(200, { "content-type": "text/event-stream" });
      const ev = (t: string, d: object) => res.write(`event: ${t}\ndata: ${JSON.stringify({ type: t, ...d })}\n\n`);
      ev("message_start", { message: { id: "m", type: "message", role: "assistant", model: j.model, content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 1, output_tokens: 1 } } });
      ev("content_block_start", { index: 0, content_block: { type: "text", text: "" } });
      ev("content_block_delta", { index: 0, delta: { type: "text_delta", text: "OK" } });
      ev("content_block_stop", { index: 0 });
      ev("message_delta", { delta: { stop_reason: "end_turn", stop_sequence: null }, usage: { output_tokens: 1 } });
      ev("message_stop", {});
      res.end();
    });
  });
  return new Promise((resolve) => srv.listen(0, "127.0.0.1", () => {
    const { port } = srv.address() as AddressInfo;
    resolve({ url: `http://127.0.0.1:${port}`, bodies, close: () => srv.close() });
  }));
}

const E2E = process.env.BMUX_CLAUDE_E2E === "1";
test("real claude: request body per thinking level (budget enforced, never effort high/max)", { skip: !E2E && "set BMUX_CLAUDE_E2E=1 (runs the installed claude against a local fake server)" }, async () => {
  const s = await recordingServer();
  try {
    const { home } = directHome(s.url);
    const want = {
      off: { thinking: { type: "disabled" }, effort: undefined, max: 20000 },
      low: { thinking: { type: "enabled", budget_tokens: 4096 }, effort: "low", max: 20000 },
      medium: { thinking: { type: "enabled", budget_tokens: 16384 }, effort: "medium", max: 20480 },
      deep: { thinking: { type: "enabled", budget_tokens: 32768 }, effort: "xhigh", max: 36864 },
    } as const;
    for (const [lvl, w] of Object.entries(want)) {
      s.bodies.length = 0;
      const plan = planLaunch("ev", { BRAINMUX_HOME: home }, lvl as keyof typeof want);
      // the user's own effort settings must not leak through
      const env = brainEnv(plan, { ...process.env, CLAUDE_CODE_EFFORT_LEVEL: "max" });
      // --effort max as an extra hostile input: CLAUDE_CODE_EFFORT_LEVEL must still win
      // async spawn: a sync one would block this process's event loop, i.e. the fake server
      const r = await new Promise<{ status: number | null; stderr: string }>((resolve) => {
        const c = spawn("claude", ["-p", "say hi", "--output-format", "text", "--strict-mcp-config", "--effort", "max"], { env, stdio: ["ignore", "ignore", "pipe"], timeout: 90_000 });
        let stderr = "";
        c.stderr.on("data", (d) => (stderr += d));
        c.on("close", (status) => resolve({ status, stderr }));
      });
      assert.equal(r.status, 0, `${lvl}: ${r.stderr}`);
      assert.ok(s.bodies.length >= 1, `${lvl}: no /v1/messages request`);
      for (const b of s.bodies) {
        assert.equal(b.model, "qwen3.8-27b");
        assert.equal(b.max_tokens, w.max, lvl);
        assert.equal(b.thinking?.type, w.thinking.type, lvl);
        assert.equal(b.thinking?.budget_tokens, (w.thinking as { budget_tokens?: number }).budget_tokens, lvl);
        assert.equal(b.output_config?.effort, w.effort, lvl);
      }
    }
  } finally {
    s.close();
  }
});

// --- context window ------------------------------------------------------------

test("contextEnv: the child compacts at contextWindow − max_tokens − SAFETY", () => {
  // Claude Code compacts at W − min(max_tokens, 20000) − 3000 (measured); invert that.
  const cc = (w: number, max: number) => w - Math.min(max, 20000) - 3000;
  for (const max of [8000, 20000, 20480, 36864]) {
    const w = Number(contextEnv(131072, max).CLAUDE_CODE_MAX_CONTEXT_TOKENS);
    assert.equal(cc(w, max), compactAt(131072, max), `max ${max}`);
    assert.ok(cc(w, max) + max + CONTEXT_SAFETY <= 131072, `max ${max}: input + max_tokens must fit the window`);
    assert.ok(w <= 131072);
  }
  assert.equal(contextEnv(131072, 20480).CLAUDE_CODE_MAX_CONTEXT_TOKENS, "125400");
  assert.equal(contextEnv(131072, 36864).CLAUDE_CODE_MAX_CONTEXT_TOKENS, "109016");
  assert.throws(() => contextEnv(32768, 20480), /too small/);
});

test("planLaunch: contextWindow → CLAUDE_CODE_MAX_CONTEXT_TOKENS (per thinking level); absent → inherited value removed", () => {
  const { home } = directHome("http://h:8000", ", contextWindow: 131072");
  const env = { BRAINMUX_HOME: home };
  assert.equal(planLaunch("ev", env).set.CLAUDE_CODE_MAX_CONTEXT_TOKENS, "125400"); // medium: max_tokens 20480
  assert.equal(planLaunch("ev", env, "deep").set.CLAUDE_CODE_MAX_CONTEXT_TOKENS, "109016"); // deep: max_tokens 36864
  const { home: h2 } = directHome("http://h:8000");
  const p2 = planLaunch("ev", { BRAINMUX_HOME: h2 });
  assert.ok(!("CLAUDE_CODE_MAX_CONTEXT_TOKENS" in brainEnv(p2, { CLAUDE_CODE_MAX_CONTEXT_TOKENS: "999999" })));
  assert.throws(() => parseBrains(`version: 1\nbrains:\n  ev: { url: "http://h:1", model: m, authTokenFile: /k, contextWindow: 10 }`), /contextWindow/);
});

test("delegate --json on a direct brain: failed child → ok:false, cost 0, non-zero exit", async () => {
  const { home } = directHome("http://192.0.2.10:8000");
  const bin = tmp("bmux-fakeclaude-err-");
  const envelope = JSON.stringify({ type: "result", subtype: "success", is_error: true, result: "API Error: 400 context", total_cost_usd: 5.96 });
  fs.writeFileSync(path.join(bin, "claude"), `#!/bin/sh\necho '${envelope}'\nexit 1\n`, { mode: 0o755 });
  const chunks: string[] = [];
  const orig = process.stdout.write.bind(process.stdout);
  (process.stdout as any).write = (c: string) => { chunks.push(String(c)); return true; };
  let code: number;
  try {
    code = await runDelegate(["ev", "--json", "x"], { BRAINMUX_HOME: home, PATH: `${bin}:${process.env.PATH}` });
  } finally {
    (process.stdout as any).write = orig;
  }
  assert.notEqual(code, 0);
  const o = JSON.parse(chunks.join("").trim().split("\n").pop()!);
  assert.equal(o.ok, false);
  assert.equal(o.cost_usd_estimate, 0);
});

test("real claude: compacts before input + max_tokens overflows contextWindow", { skip: !E2E && "set BMUX_CLAUDE_E2E=1 (runs the installed claude against a local fake server)" }, async () => {
  // The fake server answers the 1st call with a Read tool_use and reports `reported` input tokens.
  // Claude Code must compact (a "continued from a previous conversation" request follows) iff
  // that is at/above the compaction point bmux configured.
  const file = path.join(tmp("bmux-ctx-"), "small.txt");
  fs.writeFileSync(file, "hello\n");
  async function run(reported: number): Promise<boolean> {
    const bodies: string[] = [];
    let n = 0;
    const srv = http.createServer((req, res) => {
      let body = "";
      req.on("data", (c) => (body += c));
      req.on("end", () => {
        if (!req.url?.startsWith("/v1/messages") || req.url.includes("count_tokens")) { res.writeHead(200, { "content-type": "application/json" }); res.end('{"input_tokens":10}'); return; }
        const j = JSON.parse(body);
        n++; bodies.push(body);
        const first = n === 1;
        res.writeHead(200, { "content-type": "text/event-stream" });
        const ev = (t: string, d: object) => res.write(`event: ${t}\ndata: ${JSON.stringify({ type: t, ...d })}\n\n`);
        ev("message_start", { message: { id: `m${n}`, type: "message", role: "assistant", model: j.model, content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: first ? reported : 1000, output_tokens: 5 } } });
        if (first) {
          ev("content_block_start", { index: 0, content_block: { type: "tool_use", id: "toolu_1", name: "Read", input: {} } });
          ev("content_block_delta", { index: 0, delta: { type: "input_json_delta", partial_json: JSON.stringify({ file_path: file }) } });
        } else {
          ev("content_block_start", { index: 0, content_block: { type: "text", text: "" } });
          ev("content_block_delta", { index: 0, delta: { type: "text_delta", text: "OK" } });
        }
        ev("content_block_stop", { index: 0 });
        ev("message_delta", { delta: { stop_reason: first ? "tool_use" : "end_turn", stop_sequence: null }, usage: { output_tokens: 5 } });
        ev("message_stop", {});
        res.end();
      });
    });
    await new Promise<void>((r) => srv.listen(0, "127.0.0.1", () => r()));
    try {
      const { home } = directHome(`http://127.0.0.1:${(srv.address() as AddressInfo).port}`, ", contextWindow: 131072");
      const env = brainEnv(planLaunch("ev", { BRAINMUX_HOME: home }), process.env);
      const status = await new Promise<number | null>((resolve) => {
        const c = spawn("claude", ["-p", "read the file and answer", "--output-format", "text", "--strict-mcp-config", "--allowedTools", "Read"], { env, cwd: path.dirname(file), stdio: "ignore", timeout: 90_000 });
        c.on("close", resolve);
      });
      assert.equal(status, 0);
      return bodies.some((b) => b.includes("continued from a previous conversation"));
    } finally {
      srv.close();
    }
  }
  const at = compactAt(131072, 20480); // medium → 102400
  assert.equal(await run(at - 2000), false, "below the compaction point: no compaction");
  assert.equal(await run(at + 1000), true, "at/above it: compacts (and input + max_tokens still fits 131072)");
});

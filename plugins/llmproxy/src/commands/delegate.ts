import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { planLaunch } from "./launch.js";
import { resolvePaths } from "../core/paths.js";

const GUARD =
  "You are a DELEGATED worker brain invoked by an orchestrator. Do EXACTLY the task, " +
  "nothing more. Never delegate further. Be concise; return ONLY the result the " +
  "orchestrator asked for (no preamble, no sign-off).";

export interface DelegateOpts {
  mode: "analyze" | "write" | "yolo";
  workdir: string;
  outfmt: "text" | "json";
  stream: boolean;
  task: string;
}

export function parseDelegateArgs(argv: string[], stdin?: string): { brain: string; opts: DelegateOpts } {
  const brain = argv[0];
  if (!brain || brain.startsWith("-")) throw new Error("delegate: missing brain (chat|deep|coder|...)");
  const opts: DelegateOpts = { mode: "analyze", workdir: ".", outfmt: "text", stream: false, task: "" };
  const rest = argv.slice(1);
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a === "--write") opts.mode = "write";
    else if (a === "--yolo") opts.mode = "yolo";
    else if (a === "--json") opts.outfmt = "json";
    else if (a === "--stream" || a === "-v" || a === "--verbose") opts.stream = true;
    else if (a === "-C") { opts.workdir = rest[++i] ?? "."; }
    else if (a === "-") { opts.task = stdin ?? ""; }
    else if (a === "--") { opts.task = rest.slice(i + 1).join(" "); break; }
    else if (a.startsWith("-")) throw new Error(`delegate: unknown option '${a}'`);
    else opts.task = a;
  }
  // Brain validity is the manifest's call (SSOT = brains.yaml); runDelegate/planLaunch
  // validate it against the live config. Here we only require a task.
  if (!opts.task) throw new Error("delegate: no task given");
  return { brain, opts };
}

export function buildClaudeArgs(opts: DelegateOpts): string[] {
  // --stream shows the worker's steps (tool calls, notes, cost) live via the NDJSON
  // event stream; otherwise we only print the final result the orchestrator consumes.
  const fmt = opts.stream ? ["--output-format", "stream-json", "--verbose"] : ["--output-format", opts.outfmt];
  const args = ["-p", opts.task, ...fmt, "--append-system-prompt", GUARD];
  if (opts.mode === "analyze") args.push("--permission-mode", "default", "--allowedTools", "Read", "Grep", "Glob");
  else if (opts.mode === "write") args.push("--permission-mode", "acceptEdits");
  else args.push("--dangerously-skip-permissions");
  return args;
}

// --- stream trace formatting (pure, unit-tested) ---------------------------

function toolHint(block: { input?: Record<string, unknown> }): string {
  const i = block.input ?? {};
  const raw = i.file_path ?? i.path ?? i.pattern ?? i.command ?? i.query ?? i.url;
  if (raw == null) return "";
  const s = String(raw).replace(/\s+/g, " ").trim();
  return " " + (s.length > 80 ? s.slice(0, 79) + "…" : s);
}

/**
 * Turn one parsed NDJSON stream event into a human-readable trace line, or null
 * to drop it. We surface the worker's actions (tool calls), its notes (text),
 * tool errors, and a final tokens/turns/duration summary — and drop the noise
 * (hook dumps, system init, rate-limit pings) the worker inherits from the host.
 *
 * NB: we deliberately do NOT print the stream's `total_cost_usd`. The worker's
 * Claude Code prices tokens off its own model catalog, but a brain answers to an
 * opaque model id, so that figure is wrong for delegated calls. Token counts are
 * real (relayed from the provider); authoritative spend is `bmux spend`.
 */
export function formatStreamEvent(ev: unknown): string | null {
  const e = ev as { type?: string; message?: { content?: any[] }; [k: string]: any };
  if (!e || typeof e !== "object") return null;
  switch (e.type) {
    case "assistant": {
      const out: string[] = [];
      for (const b of e.message?.content ?? []) {
        if (b?.type === "tool_use") out.push(`🔧 ${b.name}${toolHint(b)}`);
        else if (b?.type === "text" && String(b.text ?? "").trim()) out.push(`💬 ${String(b.text).trim()}`);
      }
      return out.length ? out.join("\n") : null;
    }
    case "user": {
      const tr = (e.message?.content ?? []).find((b: any) => b?.type === "tool_result");
      return tr?.is_error ? "  ↳ ⚠ tool error" : null; // normal results stay quiet — keep the trace terse
    }
    case "result": {
      const inTok = e.usage?.input_tokens;
      const outTok = e.usage?.output_tokens;
      const tok = inTok != null && outTok != null ? `${inTok}→${outTok} tok, ` : "";
      const turns = e.num_turns ?? "?";
      const ms = e.duration_ms ?? "?";
      return `${e.is_error ? "⚠ error" : "✅ done"} — ${tok}${turns} turns, ${ms}ms  (spend: bmux spend)`;
    }
    default:
      return null; // system / rate_limit_event / anything else
  }
}

export function formatStreamLine(line: string): string | null {
  const s = line.trim();
  if (!s) return null;
  try {
    return formatStreamEvent(JSON.parse(s));
  } catch {
    return null; // partial/garbled line — the raw .jsonl log keeps the truth
  }
}

// --- run -------------------------------------------------------------------

function stamp(): string {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function runStreamed(brain: string, opts: DelegateOpts, childEnv: NodeJS.ProcessEnv, env: NodeJS.ProcessEnv): Promise<number> {
  const logsDir = resolvePaths(env).logsDir;
  fs.mkdirSync(logsDir, { recursive: true });
  const logFile = path.join(logsDir, `delegate-${brain}-${stamp()}.jsonl`);
  const log = fs.createWriteStream(logFile, { flags: "a" });
  process.stderr.write(`delegate: streaming '${brain}' — raw log ${logFile}\n`);

  const child = spawn("claude", buildClaudeArgs(opts), { cwd: opts.workdir, stdio: ["ignore", "pipe", "inherit"], env: childEnv });
  let buf = "";
  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (chunk: string) => {
    log.write(chunk); // raw NDJSON, written incrementally so `tail -f` shows it live
    buf += chunk;
    for (let nl = buf.indexOf("\n"); nl >= 0; nl = buf.indexOf("\n")) {
      const line = buf.slice(0, nl);
      buf = buf.slice(nl + 1);
      const pretty = formatStreamLine(line);
      if (pretty) process.stdout.write(pretty + "\n");
    }
  });

  return new Promise((resolve) => {
    child.on("error", (e) => { process.stderr.write(`delegate: ${e.message}\n`); log.end(); resolve(1); });
    child.on("close", (code) => {
      if (buf.trim()) { const pretty = formatStreamLine(buf); if (pretty) process.stdout.write(pretty + "\n"); }
      log.end();
      resolve(code ?? 1);
    });
  });
}

export async function runDelegate(argv: string[], env: NodeJS.ProcessEnv = process.env): Promise<number> {
  if (env.DELEGATE_DEPTH) {
    process.stderr.write("delegate: refusing to nest (a delegated worker cannot delegate).\n");
    return 2;
  }
  const wantsStdin = argv.includes("-");
  const stdin = wantsStdin ? fs.readFileSync(0, "utf8") : undefined;
  const { brain, opts } = parseDelegateArgs(argv, stdin);
  if (!fs.existsSync(opts.workdir)) { process.stderr.write(`delegate: -C dir '${opts.workdir}' not found\n`); return 1; }
  const plan = planLaunch(brain, env); // validates brain against manifest + resolves key/port
  if (opts.mode === "yolo") process.stderr.write(`delegate: ⚠ --yolo — '${brain}' runs with NO permission checks in '${opts.workdir}'.\n`);
  const childEnv = { ...env, DELEGATE_DEPTH: "1", ANTHROPIC_BASE_URL: plan.base, ANTHROPIC_API_KEY: plan.apiKey };

  if (opts.stream) return runStreamed(brain, opts, childEnv, env);

  const r = spawnSync("claude", buildClaudeArgs(opts), {
    cwd: opts.workdir,
    stdio: wantsStdin ? ["inherit", "inherit", "inherit"] : ["ignore", "inherit", "inherit"],
    env: childEnv,
  });
  return r.status ?? 1;
}

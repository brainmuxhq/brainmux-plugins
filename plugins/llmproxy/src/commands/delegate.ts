import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { planLaunch } from "./launch.js";

const GUARD =
  "You are a DELEGATED worker brain invoked by an orchestrator. Do EXACTLY the task, " +
  "nothing more. Never delegate further. Be concise; return ONLY the result the " +
  "orchestrator asked for (no preamble, no sign-off).";

export interface DelegateOpts {
  mode: "analyze" | "write" | "yolo";
  workdir: string;
  outfmt: "text" | "json";
  stream: boolean;
  mcp: boolean; // pass the host's MCP servers through to the worker (default off — see buildClaudeArgs)
  task: string;
}

export function parseDelegateArgs(argv: string[], stdin?: string): { brain: string; opts: DelegateOpts } {
  const brain = argv[0];
  if (!brain || brain.startsWith("-")) throw new Error("delegate: missing brain (chat|deep|coder|...)");
  const opts: DelegateOpts = { mode: "analyze", workdir: ".", outfmt: "text", stream: false, mcp: false, task: "" };
  const rest = argv.slice(1);
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a === "--write") opts.mode = "write";
    else if (a === "--yolo") opts.mode = "yolo";
    else if (a === "--json") opts.outfmt = "json";
    else if (a === "--stream" || a === "-v" || a === "--verbose") opts.stream = true;
    else if (a === "--mcp" || a === "--with-mcp") opts.mcp = true;
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
  // --stream asks the worker for the NDJSON event stream so we can render a live
  // progress line; otherwise we take the plain final result the orchestrator consumes.
  const fmt = opts.stream ? ["--output-format", "stream-json", "--verbose"] : ["--output-format", opts.outfmt];
  const args = ["-p", opts.task, ...fmt, "--append-system-prompt", GUARD];
  if (opts.mode === "analyze") args.push("--permission-mode", "default", "--allowedTools", "Read", "Grep", "Glob");
  else if (opts.mode === "write") args.push("--permission-mode", "acceptEdits");
  else args.push("--dangerously-skip-permissions");
  // A grunt worker doesn't need the host's MCP servers (Vercel/GSC/Chrome/…). Loading
  // them cost ~75k input tokens/call and zero benefit here, so drop them by default;
  // --mcp passes the host config through for the rare task that genuinely needs one.
  if (!opts.mcp) args.push("--strict-mcp-config");
  return args;
}

// --- stream progress tracking (pure, unit-tested) --------------------------
//
// We don't dump the worker's full transcript — just a light "is it alive / how
// far / what now" indicator. When the worker uses TodoWrite we can show real
// completed/total (e.g. 5/34); otherwise we count tool calls (step N).

export interface Progress {
  steps: number; // tool calls seen so far
  todoDone: number | null; // completed todos, if the worker keeps a todo list
  todoTotal: number | null;
  current: string; // short label of the latest action / in-progress todo
  touched: string[]; // unique basenames of files the worker read/edited (what it actually did)
  edits: number; // count of Edit/Write/MultiEdit calls
  done: boolean;
  error: boolean;
  finalText: string; // the worker's final answer (from the result event)
  ms: number | null; // wall-clock duration reported by the result event
}

export function initProgress(): Progress {
  return { steps: 0, todoDone: null, todoTotal: null, current: "", touched: [], edits: 0, done: false, error: false, finalText: "", ms: null };
}

function clip(s: string, n: number): string {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > n ? t.slice(0, n - 1) + "…" : t;
}

function actionLabel(b: { name?: string; input?: Record<string, unknown> }): string {
  const i = b.input ?? {};
  const file = i.file_path ?? i.path;
  if (file != null) return `${b.name}: ${path.basename(String(file))}`;
  const other = i.pattern ?? i.query ?? i.command ?? i.url;
  return other != null ? `${b.name}: ${clip(String(other), 40)}` : String(b.name ?? "");
}

/** Fold one parsed NDJSON stream event into the running progress state. */
export function foldEvent(p: Progress, ev: unknown): Progress {
  const e = ev as { type?: string; message?: { content?: any[] }; [k: string]: any };
  if (!e || typeof e !== "object") return p;
  if (e.type === "assistant") {
    for (const b of e.message?.content ?? []) {
      if (b?.type !== "tool_use") continue;
      p.steps++;
      if (b.name === "TodoWrite" && Array.isArray(b.input?.todos)) {
        const todos = b.input.todos as Array<{ status?: string; content?: string; activeForm?: string }>;
        p.todoTotal = todos.length;
        p.todoDone = todos.filter((t) => t?.status === "completed").length;
        const ip = todos.find((t) => t?.status === "in_progress");
        if (ip) p.current = clip(String(ip.activeForm ?? ip.content ?? ""), 50);
      } else {
        p.current = actionLabel(b);
        // Record what the worker actually touched, so we can summarize it at the end.
        const f = b.input?.file_path ?? b.input?.path;
        if (f != null) { const base = path.basename(String(f)); if (!p.touched.includes(base)) p.touched.push(base); }
        if (b.name === "Edit" || b.name === "Write" || b.name === "MultiEdit") p.edits++;
      }
    }
  } else if (e.type === "result") {
    p.done = true;
    p.error = !!e.is_error;
    p.finalText = String(e.result ?? "");
    p.ms = typeof e.duration_ms === "number" ? e.duration_ms : null;
  }
  return p;
}

export function parseStreamLine(line: string): unknown | null {
  const s = line.trim();
  if (!s) return null;
  try {
    return JSON.parse(s);
  } catch {
    return null; // partial line at a chunk boundary — the next chunk completes it
  }
}

function progressWord(p: Progress): string {
  return p.todoTotal != null ? `${p.todoDone}/${p.todoTotal}` : `step ${p.steps}`;
}

/** One-line live indicator while the worker runs. */
export function statusLine(brain: string, p: Progress): string {
  return `⏳ ${brain} · ${progressWord(p)}${p.current ? ` · ${p.current}` : ""}`;
}

/** One-line summary once the worker finishes. */
export function doneLine(brain: string, p: Progress): string {
  const prog = p.todoTotal != null ? `${p.todoDone}/${p.todoTotal}` : `${p.steps} steps`;
  const secs = p.ms != null ? ` · ${(p.ms / 1000).toFixed(1)}s` : "";
  return `${p.error ? "⚠ failed" : "✅ done"} ${brain} · ${prog}${secs}`;
}

/** "What it actually did" line — the files touched (+ edit count), or null if none. */
export function summaryLine(p: Progress): string | null {
  if (!p.touched.length && !p.edits) return null;
  const shown = p.touched.slice(0, 8).join(", ");
  const more = p.touched.length > 8 ? `, +${p.touched.length - 8}` : "";
  const ed = p.edits ? ` · ${p.edits} edit${p.edits === 1 ? "" : "s"}` : "";
  return `   ↳ ${p.touched.length} file${p.touched.length === 1 ? "" : "s"}: ${shown}${more}${ed}`;
}

// --- run -------------------------------------------------------------------

function runStreamed(brain: string, opts: DelegateOpts, childEnv: NodeJS.ProcessEnv): Promise<number> {
  const tty = !!process.stderr.isTTY;
  const child = spawn("claude", buildClaudeArgs(opts), { cwd: opts.workdir, stdio: ["ignore", "pipe", "inherit"], env: childEnv });
  const p = initProgress();
  let buf = "";
  // One rewriting status line on stderr (TTY only — a buffered consumer gets no per-step spam).
  const render = () => { if (tty) process.stderr.write("\r\x1b[K" + statusLine(brain, p)); };
  const snap = () => `${p.steps}|${p.todoDone}/${p.todoTotal}|${p.current}`;

  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (chunk: string) => {
    buf += chunk;
    const before = snap();
    for (let nl = buf.indexOf("\n"); nl >= 0; nl = buf.indexOf("\n")) {
      const line = buf.slice(0, nl);
      buf = buf.slice(nl + 1);
      const ev = parseStreamLine(line);
      if (ev) foldEvent(p, ev);
    }
    if (!p.done && snap() !== before) render();
  });

  return new Promise((resolve) => {
    child.on("error", (e) => { process.stderr.write(`delegate: ${e.message}\n`); resolve(1); });
    child.on("close", (code) => {
      if (buf.trim()) { const ev = parseStreamLine(buf); if (ev) foldEvent(p, ev); }
      if (tty) process.stderr.write("\r\x1b[K"); // wipe the live line
      process.stderr.write(`${doneLine(brain, p)}\n`);
      const sum = summaryLine(p);
      if (sum) process.stderr.write(`${sum}\n`); // what it touched — the compact "what it did" line
      if (p.finalText) process.stdout.write(p.finalText + "\n"); // clean final answer → stdout (orchestrator-safe)
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
  // Echo the outgoing config so you always know what went out (brain · mode · mcp state).
  process.stderr.write(`delegate: ${brain} · ${opts.mode} · mcp ${opts.mcp ? "on" : "off"}\n`);
  if (opts.mode === "yolo") process.stderr.write(`delegate: ⚠ --yolo — '${brain}' runs with NO permission checks in '${opts.workdir}'.\n`);
  const childEnv = { ...env, DELEGATE_DEPTH: "1", ANTHROPIC_BASE_URL: plan.base, ANTHROPIC_API_KEY: plan.apiKey };

  if (opts.stream) return runStreamed(brain, opts, childEnv);

  const r = spawnSync("claude", buildClaudeArgs(opts), {
    cwd: opts.workdir,
    stdio: wantsStdin ? ["inherit", "inherit", "inherit"] : ["ignore", "inherit", "inherit"],
    env: childEnv,
  });
  return r.status ?? 1;
}

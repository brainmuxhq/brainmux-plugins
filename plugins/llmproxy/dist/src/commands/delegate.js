import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { planLaunch } from "./launch.js";
const GUARD = "You are a DELEGATED worker brain invoked by an orchestrator. Do EXACTLY the task, " +
    "nothing more. Never delegate further. Be concise; return ONLY the result the " +
    "orchestrator asked for (no preamble, no sign-off).";
export function parseDelegateArgs(argv, stdin) {
    const brain = argv[0];
    if (!brain || brain.startsWith("-"))
        throw new Error("delegate: missing brain (chat|deep|coder|...)");
    const opts = { mode: "analyze", workdir: ".", outfmt: "text", task: "" };
    const rest = argv.slice(1);
    for (let i = 0; i < rest.length; i++) {
        const a = rest[i];
        if (a === "--write")
            opts.mode = "write";
        else if (a === "--yolo")
            opts.mode = "yolo";
        else if (a === "--json")
            opts.outfmt = "json";
        else if (a === "-C") {
            opts.workdir = rest[++i] ?? ".";
        }
        else if (a === "-") {
            opts.task = stdin ?? "";
        }
        else if (a === "--") {
            opts.task = rest.slice(i + 1).join(" ");
            break;
        }
        else if (a.startsWith("-"))
            throw new Error(`delegate: unknown option '${a}'`);
        else
            opts.task = a;
    }
    // Brain validity is the manifest's call (SSOT = brains.yaml); runDelegate/planLaunch
    // validate it against the live config. Here we only require a task.
    if (!opts.task)
        throw new Error("delegate: no task given");
    return { brain, opts };
}
export function buildClaudeArgs(opts) {
    const args = ["-p", opts.task, "--output-format", opts.outfmt, "--append-system-prompt", GUARD];
    if (opts.mode === "analyze")
        args.push("--permission-mode", "default", "--allowedTools", "Read", "Grep", "Glob");
    else if (opts.mode === "write")
        args.push("--permission-mode", "acceptEdits");
    else
        args.push("--dangerously-skip-permissions");
    return args;
}
export function runDelegate(argv, env = process.env) {
    if (env.DELEGATE_DEPTH) {
        process.stderr.write("delegate: refusing to nest (a delegated worker cannot delegate).\n");
        return 2;
    }
    const wantsStdin = argv.includes("-");
    const stdin = wantsStdin ? fs.readFileSync(0, "utf8") : undefined;
    const { brain, opts } = parseDelegateArgs(argv, stdin);
    if (!fs.existsSync(opts.workdir)) {
        process.stderr.write(`delegate: -C dir '${opts.workdir}' not found\n`);
        return 1;
    }
    const plan = planLaunch(brain, env); // validates brain against manifest + resolves key/port
    if (opts.mode === "yolo")
        process.stderr.write(`delegate: ⚠ --yolo — '${brain}' runs with NO permission checks in '${opts.workdir}'.\n`);
    const r = spawnSync("claude", buildClaudeArgs(opts), {
        cwd: opts.workdir,
        stdio: wantsStdin ? ["inherit", "inherit", "inherit"] : ["ignore", "inherit", "inherit"],
        env: { ...env, DELEGATE_DEPTH: "1", ANTHROPIC_BASE_URL: plan.base, ANTHROPIC_API_KEY: plan.apiKey },
    });
    return r.status ?? 1;
}

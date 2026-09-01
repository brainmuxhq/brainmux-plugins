import { resolvePaths } from "../core/paths.js";
import { loadBrains, type BrainsConfig } from "../core/manifest.js";
import { ensureDocker, runCompose, liveliness } from "../core/docker.js";
import { masterKeyVar } from "../core/generate.js";
import { writeGenerated } from "./init.js";

// Printed after a successful `up`/`restart`. Points at each brain's LiteLLM UI
// (observation panel per CLAUDE.md — link, don't rewrite) and how to log in.
// References the master-key env var NAME, never the secret value.
export function upSummary(cfg: BrainsConfig): string {
  const lines = ["", "brains up. observe spend/logs in each LiteLLM UI (login: admin):"];
  for (const [name, b] of Object.entries(cfg.brains)) {
    lines.push(`  ${name.padEnd(8)} http://127.0.0.1:${b.port}/ui   password: $${masterKeyVar(name)}`);
  }
  lines.push("  (password values live in ~/.brainmux/.env · `bmux spend` for a quick total)");
  return lines.join("\n");
}

export async function runStack(sub: string, rest: string[], env: NodeJS.ProcessEnv = process.env): Promise<number> {
  const paths = resolvePaths(env);
  if (sub === "up" || sub === "restart") {
    ensureDocker();
    const cfg = loadBrains(paths.brainsYaml);
    writeGenerated(paths, cfg); // regenerate from SSOT before (re)starting
    const args = sub === "restart" ? ["up", "-d", "--force-recreate"] : ["up", "-d"];
    const code = runCompose(paths, args);
    if (code === 0) process.stdout.write(upSummary(cfg) + "\n");
    return code;
  }
  if (sub === "down") { ensureDocker(); return runCompose(paths, ["down"]); }
  if (sub === "ps") { ensureDocker(); return runCompose(paths, ["ps"]); }
  if (sub === "logs") { ensureDocker(); return runCompose(paths, ["logs", "-f", ...rest]); }
  if (sub === "health") {
    const cfg = loadBrains(paths.brainsYaml);
    let fail = 0;
    for (const [name, b] of Object.entries(cfg.brains)) {
      const ok = await liveliness(b.port);
      process.stdout.write(`${name.padEnd(8)} ${ok ? "UP  " : "DOWN"} (:${b.port})\n`);
      if (!ok) fail = 1;
    }
    return fail;
  }
  process.stderr.write(`bmux: unknown stack command '${sub}'\n`);
  return 1;
}

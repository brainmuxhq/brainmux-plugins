import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// A tiny POSIX-sh launcher on the user's PATH that resolves the *active* llmproxy version at
// run time. Fixes two things: the plugin's bin lives at a version-specific cache path that
// changes on every update, and Claude Code only puts it on PATH for interactive sessions
// (so `bmux` was "command not found" from scripts / non-interactive shells).
export const SHIM_LAUNCHER = `#!/bin/sh
# brainmux launcher — installed by \`bmux install-shim\`. Resolves the active llmproxy
# version at run time, so \`bmux\` survives plugin updates and works from any shell.
d="\${CLAUDE_CONFIG_DIR:-$HOME/.claude}/plugins/cache/brainmux/llmproxy"
bin="$(ls -d "$d"/*/bin/bmux 2>/dev/null | sort -V | tail -1)"
[ -n "$bin" ] || { echo "bmux: no installed llmproxy plugin under $d" >&2; exit 1; }
exec "$bin" "$@"
`;

export function runShim(argv: string[], env: NodeJS.ProcessEnv = process.env): number {
  const home = env.HOME || os.homedir();
  const dir = path.join(home, ".local", "bin");
  const dest = path.join(dir, "bmux");
  const force = argv.includes("--force");

  if (fs.existsSync(dest) && !force) {
    const cur = fs.readFileSync(dest, "utf8");
    if (!cur.includes("brainmux launcher")) {
      process.stderr.write(`install-shim: ${dest} exists and is not a brainmux launcher — re-run with --force to overwrite.\n`);
      return 1;
    }
  }

  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(dest, SHIM_LAUNCHER);
  fs.chmodSync(dest, 0o755);

  process.stdout.write(`✓ bmux shim installed → ${dest}\n  It resolves the active llmproxy version at run time (survives updates).\n`);
  const onPath = (env.PATH ?? "").split(path.delimiter).includes(dir);
  if (!onPath) {
    process.stdout.write(`  ⚠ ${dir} is not on your PATH. Add it (then restart your shell):\n    export PATH="$HOME/.local/bin:$PATH"\n`);
  }
  return 0;
}

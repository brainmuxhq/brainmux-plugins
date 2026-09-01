import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// Embedded as a constant (not a shipped file) so it works from the esbuild bundle with no
// bundle-relative path lookup — same pattern as core/openrouter.ts and core/generate.ts.
//
// Drift-free by design: the brain name comes from $BRAINMUX_BRAIN (set by `bmux <brain>`),
// so there is no hardcoded port→name map to fall out of sync when brains.yaml changes.
// Context% comes from the JSON Claude Code pipes on stdin; the OpenRouter balance reads the
// key from $BRAINMUX_HOME/.env. Requires `jq` (and `python3` only for the balance).
export const STATUSLINE_SCRIPT = `#!/usr/bin/env bash
# brainmux status line — installed by \`bmux statusline install\`. Safe to edit.
#   📁 dir · 🌿 git · 🧠 brain|🤖 model · ⚡ effort · 🧠 context% · 💰 cost · 💳 balance · ±lines · ⏱️ time
input=$(cat)
j() { printf '%s' "$input" | jq -r "$1" 2>/dev/null; }

model=$(j '.model.display_name // "Claude"')
cdir=$(j '.workspace.current_dir // .cwd // empty'); [ -z "$cdir" ] && cdir="$PWD"
dir=$(basename "$cdir")
cost=$(j '.cost.total_cost_usd // empty')
ctx=$(j '.context_window.used_percentage // empty')
eff=$(j '(.effort.level // .effort) | strings')
add=$(j '.cost.total_lines_added // 0'); del=$(j '.cost.total_lines_removed // 0')
dur=$(j '.cost.total_duration_ms // empty')

brain="\${BRAINMUX_BRAIN:-}"
home="\${BRAINMUX_HOME:-$HOME/.brainmux}"

R=$'\\033[0m'; B=$'\\033[1m'
CY=$'\\033[38;5;44m'; GR=$'\\033[38;5;42m'; MA=$'\\033[38;5;177m'
GY=$'\\033[38;5;245m'; RE=$'\\033[38;5;203m'; OR=$'\\033[38;5;215m'; BL=$'\\033[38;5;75m'
S=" \${GY}·\${R} "

out="\${CY}\${B}📁 \${dir}\${R}"

if git -C "$cdir" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  br=$(git -C "$cdir" branch --show-current 2>/dev/null); [ -z "$br" ] && br=$(git -C "$cdir" rev-parse --short HEAD 2>/dev/null)
  d=""; [ -n "$(git -C "$cdir" status --porcelain 2>/dev/null)" ] && d=" ●"
  [ -n "$br" ] && out="\${out}\${S}\${GR}🌿 \${br}\${d}\${R}"
fi

if [ -n "$brain" ]; then
  out="\${out}\${S}\${OR}🧠 \${brain} \${GY}(proxy)\${R}"
else
  out="\${out}\${S}\${MA}🤖 \${model}\${R}"
fi

if [ -n "$eff" ] && [ "$eff" != "null" ]; then out="\${out}\${S}\${BL}⚡ \${eff}\${R}"; fi

if [ -n "$ctx" ] && [ "$ctx" != "null" ]; then
  p=\${ctx%.*}; c=$GR
  if [ "\${p:-0}" -ge 80 ] 2>/dev/null; then c=$RE; elif [ "\${p:-0}" -ge 50 ] 2>/dev/null; then c=$OR; fi
  out="\${out}\${S}\${c}🧠 \${p}%\${R}"
fi

if [ -n "$cost" ] && [ "$cost" != "null" ]; then
  cf=$(LC_NUMERIC=C printf '%.2f' "$cost" 2>/dev/null)
  # On a proxy brain Claude Code prices tokens with its own model catalog → estimate only.
  if [ -n "$brain" ]; then out="\${out}\${S}\${GY}💰 ≈\\$\${cf}\${R}"; else out="\${out}\${S}💰 \\$\${cf}\${R}"; fi
fi

# OpenRouter balance — only on a proxy brain; 5-min cache, refreshed in the background so it never blocks a render.
if [ -n "$brain" ] && [ -f "$home/.env" ]; then
  cache="$HOME/.cache/brainmux/or-balance"; mkdir -p "$(dirname "$cache")" 2>/dev/null
  age=99999; [ -f "$cache" ] && age=$(( $(date +%s) - $(stat -c %Y "$cache" 2>/dev/null || echo 0) ))
  if [ "$age" -gt 300 ]; then
    ( key=$(grep -E '^OPENROUTER_API_KEY=' "$home/.env" | cut -d= -f2-)
      # Pass the key via stdin (-H @-), not argv, so it never lands in /proc/PID/cmdline. printf is a
      # bash builtin (no separate process), so the key isn't exposed there either.
      [ -n "$key" ] && bal=$(printf 'Authorization: Bearer %s' "$key" | curl -s -m 8 https://openrouter.ai/api/v1/credits -H @- \\
        | python3 -c "import sys,json;d=json.load(sys.stdin).get('data',{});print(f'{d.get(\\"total_credits\\",0)-d.get(\\"total_usage\\",0):.2f}')" 2>/dev/null)
      [ -n "$bal" ] && printf '%s' "$bal" > "$cache" ) >/dev/null 2>&1 &
  fi
  [ -f "$cache" ] && bal=$(cat "$cache" 2>/dev/null)
  if [ -n "$bal" ]; then bc=$GR; awk "BEGIN{exit !($bal < 2)}" 2>/dev/null && bc=$RE; out="\${out}\${S}\${bc}💳 \\$\${bal}\${R}"; fi
fi

if [ "\${add:-0}" -gt 0 ] 2>/dev/null || [ "\${del:-0}" -gt 0 ] 2>/dev/null; then
  out="\${out}\${S}\${GR}+\${add}\${R}\${GY}/\${R}\${RE}-\${del}\${R}"
fi

if [ -n "$dur" ] && [ "$dur" != "null" ]; then
  s=$(( dur/1000 )); if [ "$s" -ge 60 ]; then t="$(( s/60 ))m"; else t="\${s}s"; fi
  out="\${out}\${S}\${GY}⏱️ \${t}\${R}"
fi

printf '%s' "$out"
`;

export type StatuslineAction = "set" | "replaced" | "kept-existing" | "already-ours";

/**
 * Decide how to touch settings.json without clobbering a user's own status line:
 * install if none, no-op if it is already ours, otherwise keep theirs unless --force.
 * Pure so it is unit-tested; the caller does the file I/O.
 */
export function planStatuslineSettings(existing: unknown, command: string, force: boolean): { settings: any; action: StatuslineAction } {
  const s = existing && typeof existing === "object" ? { ...(existing as any) } : {};
  const cur = s.statusLine;
  if (cur && typeof cur === "object" && cur.command === command) return { settings: s, action: "already-ours" };
  if (cur && !force) return { settings: s, action: "kept-existing" };
  s.statusLine = { type: "command", command, padding: 0 };
  return { settings: s, action: cur ? "replaced" : "set" };
}

export function runStatusline(argv: string[], env: NodeJS.ProcessEnv = process.env): number {
  const home = env.HOME || os.homedir();
  const claudeDir = path.join(home, ".claude");
  const dest = path.join(claudeDir, "brainmux-statusline.sh");

  if (argv[0] !== "install") {
    process.stdout.write(
      "bmux statusline install [--force]   enable the brainmux status line\n" +
        "  Shows: dir · git · brain (proxy) / model · context% · cost · OpenRouter balance.\n" +
        `  Writes ${dest} and points Claude Code's statusLine at it (needs jq).\n`,
    );
    return 0;
  }

  const force = argv.includes("--force");
  fs.mkdirSync(claudeDir, { recursive: true });
  fs.writeFileSync(dest, STATUSLINE_SCRIPT);
  fs.chmodSync(dest, 0o755);

  const settingsFile = path.join(claudeDir, "settings.json");
  let existing: unknown = {};
  if (fs.existsSync(settingsFile)) {
    try {
      existing = JSON.parse(fs.readFileSync(settingsFile, "utf8"));
    } catch {
      process.stderr.write(`statusline: ${settingsFile} is not valid JSON — fix it, then re-run.\n`);
      return 1;
    }
  }

  const { settings, action } = planStatuslineSettings(existing, dest, force);
  if (action === "kept-existing") {
    process.stderr.write(
      `statusline: you already have a statusLine configured — left it untouched.\n` +
        `  The brainmux script is ready at ${dest}.\n` +
        `  Re-run \`bmux statusline install --force\` to replace it, or point ${settingsFile} at the script yourself.\n`,
    );
    return 0;
  }

  fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2) + "\n");
  const what = action === "replaced" ? "replaced your previous statusLine" : "enabled the status line";
  process.stdout.write(
    `✓ brainmux status line installed — ${what}.\n` +
      `  script:   ${dest}\n` +
      `  settings: ${settingsFile}\n` +
      `  Start a new Claude Code session to see it (launch a brain with \`bmux <brain>\` for the proxy view).\n`,
  );
  return 0;
}

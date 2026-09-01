---
description: Run the brainmux (bmux) CLI — manage brains and the proxy stack.
argument-hint: <subcommand> [args]   e.g. up | health | test | config list
---

Run the brainmux CLI for the user's request, using the plugin's bundled binary.

The user asked: `bmux $ARGUMENTS`

Do this:
1. Run `${CLAUDE_PLUGIN_ROOT}/bin/bmux $ARGUMENTS` with the Bash tool and report the result concisely.
2. **Exception — interactive brain launch:** if the subcommand is a bare brain name
   (`chat`, `deep`, `coder`, or any brain from `bmux config list`) with no further
   management verb, do NOT run it here — it execs an interactive Claude Code session.
   Instead tell the user to run `bmux <brain>` directly in their terminal.
3. If it fails with "brains.yaml not found", suggest `bmux init`. If a provider key is
   missing, run `bmux config add-key OPENROUTER_API_KEY` **without a value** — it prompts
   for the key hidden (never put the secret in argv/shell history/transcript).

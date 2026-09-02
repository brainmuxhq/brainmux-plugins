# bmux — usage feedback & roadmap (Riskmatik İSG session, 2026-09-01/02)

Source: heavy real-world use of `bmux delegate` as a grunt/delegation tool. Triaged against
the code; each item marked DONE (with version), DEFER (with reason), or BACKLOG.

## Done — v0.1.11
- **`--allow-tools <csv>`** — pre-allow exact tools headless so a delegate can use an MCP tool
  (e.g. `mcp__brave-search__brave_web_search`) or a built-in (`Bash`) without falling back to
  `--yolo`. An `mcp__…` entry implies `--mcp`. Fixes the critical "`--mcp` alone hits the
  headless permission wall → 0 bytes" bug.
- **stderr noise filter** — the child's "claude.ai connectors are disabled because
  ANTHROPIC_API_KEY…" line is dropped from delegate stderr (both stream and non-stream);
  everything else passes through.
- **Docs** — delegate skill now covers: grounding (cheap brains fabricate facts; ground with
  `--mcp --allow-tools brave` + cite, or verify), `--stream` for observability, and
  sequential/low-concurrency for quality.

## Done — v0.1.13
- **`bmux spend --since <window>`** (`1h`/`30m`/`7d`) — scope the roll-up to a recent window
  (rows filtered by `startTime`), e.g. this session's cost.
- **`bmux install-shim`** — write a version-agnostic POSIX-sh launcher to `~/.local/bin/bmux`
  that resolves the highest installed llmproxy version at run time (honors `CLAUDE_CONFIG_DIR`),
  so `bmux` survives updates and works from non-interactive shells. Fixes the "command not
  found / path changed 0.1.5→0.1.10" friction.

## Deferred (with reason)
- **spawn timeout / heartbeat** — a safe default risks killing legitimate long delegates;
  `--stream` already surfaces progress. Revisit as an opt-in `--timeout`.
- **auto concurrency-cap** — separate `bmux` processes; a cross-process cap needs a
  lockfile/semaphore in `~/.brainmux` (over-engineering for a single-user CLI). Documented
  the sequential guidance instead.

## Backlog (features)
- **`--verify` / grounding-mode** — auto web-cross-check each factual claim.
- **retry / degrade-detection** — detect garbled (rate-limited) output and re-run.
- **prompt-template library** — ready-made `audit` / `review` / `drift-scan` delegate tasks.
- **`--json` strict schema** — guarantee `{brain, tokens, cost, result}` (today it passes the
  worker's own JSON envelope through).
- **brain `reliability: memory|grounded` label** — surface which brains have web grounding.

## Keep (working well)
- `bmux delegate <brain> -C <dir> "task"` with dir-scoped egress control.
- background + completion-notification flow.
- brain-per-model split (chat/deep/coder/dsflash) + `health`/`ps`/`config list`.
- economics: multi-audit runs at ~$0.01–2 on OpenRouter, off the Anthropic budget.

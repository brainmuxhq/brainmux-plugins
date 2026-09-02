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

## Done — v0.1.14
- **`--json` strict schema** — `bmux delegate --json` now emits a stable brainmux envelope
  `{brain, ok, result, input_tokens, output_tokens, num_turns, duration_ms, cost_usd_estimate}`
  (reshaped from the worker's `claude --output-format json`; cost is labeled an estimate since
  an opaque brain model can't be priced reliably — `bmux spend` is authoritative).

## Done — v0.1.15
- **`--verify` / grounding-mode** — opt-in two-pass: draft the task, then a grounded pass that
  forces the grounding tool (default `brave_web_search`) to web-check each claim → `✅/⚠` with
  sources. Works as a manual flag or agent-shaped from NL; the grounding tool is agent-decided
  per task (brave / direct fetch / context7) and may be confirmed with the user. ~2x cost, only
  when used. Verified live (caught a "Node 26 lands Oct 2026" nuance with real source URLs).

## Done — v0.1.16
- **prompt-template library** — `bmux delegate --template <name>` expands a saved prompt; built-ins
  `audit`/`drift-scan`/`review`/`todo-scan`; user templates persist in `~/.brainmux/templates.yaml`
  (`bmux config add-template`/`list-templates`, user overrides built-in). SSOT in `core/templates.ts`.

## Backlog (features)
- **retry / degrade-detection** — detect garbled (rate-limited) output and re-run.
- **brain `reliability: memory|grounded` label** — surface which brains have web grounding.

## Keep (working well)
- `bmux delegate <brain> -C <dir> "task"` with dir-scoped egress control.
- background + completion-notification flow.
- brain-per-model split (chat/deep/coder/dsflash) + `health`/`ps`/`config list`.
- economics: multi-audit runs at ~$0.01–2 on OpenRouter, off the Anthropic budget.

#!/usr/bin/env node
/**
 * @brainmux/llmproxy — bmux CLI entry.
 *
 * STATUS: scaffold only. Implementation is being migrated from the working sh
 * prototype at ~/Development/Projects/claude-proxy (bin/bmux, bin/delegate,
 * config/*.yaml, compose.yaml) into this Node/TS package, driven by a declarative
 * `brains.yaml` -> generator. See ../../../CLAUDE.md and ../../../docs/specs.
 *
 * Planned command surface (from the design spec):
 *   bmux init | up | down | restart | ps | logs | health
 *   bmux chat | deep | coder [claude args...]
 *   bmux delegate <brain> [--write|--yolo] [-C dir] [--json] "<task>"
 *   bmux config add-brain | remove-brain | set-model | add-key | list
 *   bmux test | ui
 */

async function main(argv: string[]): Promise<number> {
  const cmd = argv[0];
  if (!cmd || cmd === "-h" || cmd === "--help") {
    console.log("bmux — brainmux/llmproxy CLI (scaffold). Not yet implemented.");
    console.log("See CLAUDE.md and docs/specs for the planned command surface.");
    return 0;
  }
  console.error(`bmux: '${cmd}' not implemented yet (scaffold).`);
  return 1;
}

main(process.argv.slice(2)).then((code) => process.exit(code));

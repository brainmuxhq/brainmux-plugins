#!/usr/bin/env sh
# Live smoke — Docker-gated. Boots the generated stack in a scratch BRAINMUX_HOME and
# hits /v1/messages on every brain. Requires Docker running and a funded
# OPENROUTER_API_KEY in the environment. Tears the stack down + removes the scratch
# home on exit. Run from anywhere:
#   OPENROUTER_API_KEY=sk-or-... sh plugins/llmproxy/test/smoke.sh
set -eu

HERE="$(cd "$(dirname "$0")/.." && pwd)"   # plugins/llmproxy
CLI="node $HERE/bin/bmux"
HOME_DIR="$(mktemp -d)"
export BRAINMUX_HOME="$HOME_DIR"

cleanup() { $CLI down >/dev/null 2>&1 || true; rm -rf "$HOME_DIR"; }
trap cleanup EXIT

[ -n "${OPENROUTER_API_KEY:-}" ] || { echo "smoke: set OPENROUTER_API_KEY to run the live smoke" >&2; exit 2; }

echo "smoke: BRAINMUX_HOME=$HOME_DIR"
$CLI init
$CLI config add-key OPENROUTER_API_KEY "$OPENROUTER_API_KEY"
$CLI up

echo "smoke: waiting for brains to become healthy..."
ok=0
i=0
while [ "$i" -lt 40 ]; do
  if $CLI health >/dev/null 2>&1; then ok=1; break; fi
  i=$((i + 1))
  sleep 5
done
if [ "$ok" -ne 1 ]; then
  echo "smoke: brains did not become healthy in time" >&2
  $CLI health || true
  exit 1
fi

$CLI health
echo "smoke: running /v1/messages per brain..."
$CLI test
echo "smoke: PASS"

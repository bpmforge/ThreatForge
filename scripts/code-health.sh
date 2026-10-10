#!/usr/bin/env bash
# Code-health ratchet — duplicate code (jscpd), unused files/exports/deps (knip) and,
# when installed locally, the opengrep rules, held at or below the committed
# baseline tools/code-health/baseline.json. See docs/process/CODE_HEALTH_RATCHET.md.
#
#   scripts/code-health.sh                                 check (exit 1 on any new finding)
#   scripts/code-health.sh --update                        lower the baseline after a fix
#   scripts/code-health.sh --update --allow-increase "why" raise it, recording why
#
# knip resolves each package's own plugins (vitest, next, eslint ...), so
# server/ and frontend/ must have their node_modules installed.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SLOP="$ROOT/tools/code-health"

if [[ ! -x "$SLOP/node_modules/.bin/knip" || ! -x "$SLOP/node_modules/.bin/jscpd" ]]; then
  echo "code-health: installing tools/code-health (one-time)"
  npm ci --prefix "$SLOP" --no-audit --no-fund --loglevel=error
fi
for pkg in server frontend; do
  [[ -d "$ROOT/$pkg/node_modules" ]] || { echo "code-health: $pkg/node_modules missing — run npm ci in $pkg first" >&2; exit 2; }
done

exec node "$SLOP/code-health.mjs" "$@"

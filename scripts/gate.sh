#!/usr/bin/env bash
# ThreatForge local gate — the same checks CI runs, on the developer's machine.
# GitHub Actions has been budget-blocked since 2026-09-04, so this is the gate
# that actually runs. Wired as the pre-push hook via `git config core.hooksPath
# .githooks` (see CONTRIBUTING.md).
#
# What it runs (about 3 minutes on an M-series laptop):
#   frontend: eslint, tsc --noEmit, vitest
#   server:   eslint, tsc --noEmit, vitest (SQLite)
# What it SKIPS, and why: the Postgres lane (needs a running Postgres — run
# `scripts/gate.sh --postgres` with TEST_DATABASE_URL set), Playwright e2e,
# Docker image builds, Trivy/CodeQL. Those stay in CI.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PG=0; [[ "${1:-}" == "--postgres" ]] && PG=1

step() { printf '\n\033[36m▶ %s\033[0m\n' "$1"; }

step "security (node 22, npm audit, gitleaks, opengrep)"; "$ROOT/scripts/security-scan.sh"
step "code-health ratchet (jscpd + knip + opengrep)"; "$ROOT/scripts/code-health.sh"
step "format (prettier)"; npm --prefix "$ROOT/tools/code-health" run --silent format:check
step "frontend: lint"; (cd "$ROOT/frontend" && npm run --silent lint)
step "frontend: typecheck"; (cd "$ROOT/frontend" && npx tsc --noEmit)
step "frontend: unit tests"; (cd "$ROOT/frontend" && npx vitest run --silent)

step "server: lint"; (cd "$ROOT/server" && npm run --silent lint)
step "server: typecheck"; (cd "$ROOT/server" && npx tsc --noEmit)
step "server: unit tests (SQLite)"; (cd "$ROOT/server" && npx vitest run --silent)

if [[ $PG -eq 1 ]]; then
  : "${TEST_DATABASE_URL:?set TEST_DATABASE_URL=postgresql://... for the Postgres lane}"
  step "server: unit tests (Postgres)"
  # The checked-in schema is sqlite; the client must be generated for postgres
  # for the pg adapter to load. Flip, generate, test, restore — always restore.
  (
    cd "$ROOT/server"
    trap 'git checkout -q -- prisma/schema/00-config.prisma; npx prisma generate >/dev/null 2>&1' EXIT
    sed -i.bak 's/provider = "sqlite"/provider = "postgresql"/' prisma/schema/00-config.prisma && rm -f prisma/schema/00-config.prisma.bak
    npx prisma generate >/dev/null 2>&1
    DATABASE_URL="$TEST_DATABASE_URL" npx vitest run --silent
  )
fi

printf '\n\033[32m✔ gate green\033[0m\n'

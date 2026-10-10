#!/bin/sh
# One-shot container init: schema push -> seed -> first-admin bootstrap.
# Run by the `init` compose service (server/Dockerfile target `migrate`) before
# the API starts. Every step is idempotent, so re-running on each `up` is safe.
set -eu

echo "[init] pushing schema (npm run db:push)"
npm run db:push

echo "[init] seeding pipelines (npm run seed:pipelines)"
npm run seed:pipelines

echo "[init] seeding model templates (npm run db:seed)"
npm run db:seed

if [ -n "${INITIAL_SYSTEM_ADMIN_EMAIL:-}" ] && [ -n "${INITIAL_SYSTEM_ADMIN_PASSWORD:-}" ]; then
  echo "[init] bootstrapping system admin ${INITIAL_SYSTEM_ADMIN_EMAIL}"
  npm run admin:bootstrap
else
  echo "[init] INITIAL_SYSTEM_ADMIN_EMAIL/PASSWORD not set - skipping admin bootstrap"
fi

echo "[init] done"

#!/usr/bin/env bash
# Post-deploy HTTP smoke test, run on the host after a deploy.
# Checks the running containers answer the way a working install does; it
# needs no credentials and writes nothing. Exits non-zero on the first failure.
#
#   SERVER_CONTAINER / FRONTEND_CONTAINER: compose container names.
set -uo pipefail

SERVER="${SERVER_CONTAINER:?}"
FRONTEND="${FRONTEND_CONTAINER:?}"
fails=0

# status <container> <url> → HTTP status code (wget prints "HTTP/1.1 NNN ...")
status() {
    docker exec "$1" wget -S -qO /dev/null "$2" 2>&1 | awk '/^  HTTP\//{code=$2} END{print code+0}'
}

check() { # check <label> <expected> <actual>
    if [ "$2" = "$3" ]; then
        echo "  ok   $1 ($3)"
    else
        echo "  FAIL $1: expected $2, got ${3:-no answer}"
        fails=$((fails + 1))
    fi
}

echo "Post-deploy smoke:"
check "server readiness"            200 "$(status "$SERVER" http://127.0.0.1:3001/health/ready)"
check "API refuses anonymous calls" 401 "$(status "$SERVER" http://127.0.0.1:3001/api/projects)"
check "auth providers (public)"     200 "$(status "$SERVER" http://127.0.0.1:3001/api/auth/providers)"
check "login page"                  200 "$(status "$FRONTEND" http://127.0.0.1:3000/login)"

[ "$fails" -eq 0 ]

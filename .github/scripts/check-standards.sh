#!/bin/bash
#
# CI Standards Check
#
# Checks modified files against project standards:
# 1. File size limits (server API: 300, frontend components: 200)
# 2. Response helper usage (no raw reply.status() without helpers)
# 3. No local getAuthUser() definitions
#
# Only checks files modified vs origin/main to avoid failing on legacy code.
#

set -e

WARNINGS=0
ERRORS=0

# Get modified files (vs main branch, or vs HEAD~1 if on main)
if git rev-parse --verify origin/main >/dev/null 2>&1; then
  MODIFIED=$(git diff --name-only origin/main 2>/dev/null || echo "")
else
  MODIFIED=$(git diff --name-only HEAD~1 2>/dev/null || echo "")
fi

if [ -z "$MODIFIED" ]; then
  echo "No modified files to check."
  exit 0
fi

echo "Checking $(echo "$MODIFIED" | wc -l | tr -d ' ') modified files..."
echo ""

# Check 1: File size limits on modified files
MAX_API=300
MAX_COMPONENT=200

for f in $(echo "$MODIFIED" | grep "server/src/api/.*\.ts$" | grep -v "__tests__" | grep -v "\.test\."); do
  if [ -f "$f" ]; then
    lines=$(wc -l < "$f")
    if [ "$lines" -gt "$MAX_API" ]; then
      echo "WARNING: $f ($lines lines, limit $MAX_API)"
      WARNINGS=$((WARNINGS + 1))
    fi
  fi
done

for f in $(echo "$MODIFIED" | grep "frontend/src/.*\.tsx$" | grep -v "\.test\."); do
  if [ -f "$f" ]; then
    lines=$(wc -l < "$f")
    if [ "$lines" -gt "$MAX_COMPONENT" ]; then
      echo "WARNING: $f ($lines lines, limit $MAX_COMPONENT)"
      WARNINGS=$((WARNINGS + 1))
    fi
  fi
done

# Check 2: New route files should use response helpers
for f in $(echo "$MODIFIED" | grep "server/src/api/.*\.ts$" | grep -v "__tests__" | grep -v "helpers\|schemas\|types\|index"); do
  if [ -f "$f" ] && grep -q "reply\.status(" "$f" && ! grep -q "sendSuccess\|sendNotFound\|sendBadRequest" "$f"; then
    echo "WARNING: $f uses raw reply.status() — import helpers from utils/api-response.js"
    WARNINGS=$((WARNINGS + 1))
  fi
done

# Check 3: No new local getAuthUser definitions
for f in $(echo "$MODIFIED" | grep "server/src/api/.*\.ts$"); do
  if [ -f "$f" ] && grep -q "function getAuthUser" "$f" && ! grep -q "export { getAuthUser } from" "$f"; then
    echo "ERROR: $f defines local getAuthUser() — import from utils/auth-helpers.js"
    ERRORS=$((ERRORS + 1))
  fi
done

echo ""
echo "Results: $ERRORS errors, $WARNINGS warnings"

if [ "$ERRORS" -gt 0 ]; then
  echo "FAIL: Fix errors before merging."
  exit 1
fi

if [ "$WARNINGS" -gt 0 ]; then
  echo "PASS with warnings — consider addressing before merging."
fi

exit 0

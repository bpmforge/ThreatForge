#!/usr/bin/env bash
# ThreatForge security scan — run by scripts/gate.sh (pre-push) and by the
# "Security Scan" job in .github/workflows/ci.yml (Gitea Actions).
#
#   scripts/security-scan.sh             gate mode: only what this push adds
#   scripts/security-scan.sh --ci        CI mode: PR diff / whole tree
#   scripts/security-scan.sh --self-test opengrep house-rule fixtures only
#
# Steps, in order (each fails the run on a blocking finding):
#   0. node major == 22 (the version prod and CI run; see .nvmrc)
#   1. npm audit --omit=dev, server + frontend: critical blocks, high warns
#   2. gitleaks on the new commits (gate) / PR range or full history (CI)
#   3. opengrep with the vendored house rules in tools/security/rules:
#      gate + PR = NEW findings only (--baseline-commit); push/schedule = whole
#      tree, ERROR rules block, WARNING rules are listed but do not block.
# A missing gitleaks/opengrep binary is SKIPPED with a printed reason, never a
# silent pass. Set SECURITY_SCAN_STRICT=1 to make a missing tool fail instead.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
MODE=gate
case "${1:-}" in
  --ci) MODE=ci ;;
  --self-test) MODE=self-test ;;
  "") ;;
  *) echo "usage: $0 [--ci|--self-test]" >&2; exit 2 ;;
esac
RULES="tools/security/rules"
FIXTURES="$RULES/fixtures"
FAIL=0
step() { printf '\n\033[36m▶ security: %s\033[0m\n' "$1"; }
warn() { printf '\033[33m⚠ %s\033[0m\n' "$1"; }
bad()  { printf '\033[31m✘ %s\033[0m\n' "$1"; FAIL=1; }
skip() {
  if [[ -n "${SECURITY_SCAN_STRICT:-}" ]]; then bad "$1 (SECURITY_SCAN_STRICT set)"; else warn "SKIPPED: $1"; fi
}
find_tool() { command -v "$1" 2>/dev/null || { [[ -x "$2" ]] && echo "$2"; } || true; }

# opengrep crashes on a non-ASCII rule file under the C locale. macOS has
# en_US.UTF-8; Debian/Ubuntu runner images often only have C.UTF-8.
if locale -a 2>/dev/null | grep -qiE '^en_US\.utf-?8$'; then OG_LOCALE=en_US.UTF-8; else OG_LOCALE=C.UTF-8; fi
OPENGREP="$(find_tool opengrep "$HOME/.local/bin/opengrep")"
GITLEAKS="$(find_tool gitleaks /opt/homebrew/bin/gitleaks)"
og() { LC_ALL=$OG_LOCALE "$OPENGREP" scan --config "$RULES" --quiet --exclude "$FIXTURES" "$@"; }

# ---- self-test: bad.ts must match exactly N times, good.ts never -----------
# N comes from the "MUST match (N)" note on bad.ts line 1, so a rule that goes
# partly blind fails here, not just one that goes fully blind.
self_test() {
  step "opengrep rule fixtures"
  if [[ -z "$OPENGREP" ]]; then skip "opengrep not installed — rule fixtures not checked"; return; fi
  local rule id got want
  for rule in "$RULES"/*.yaml; do
    id="$(basename "$rule" .yaml)"
    for kind in bad good; do
      got=$(LC_ALL=$OG_LOCALE "$OPENGREP" scan --config "$rule" --quiet --json \
        "$FIXTURES/$id/$kind.ts" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).results.length))')
      want=0
      [[ $kind == bad ]] && want="$(head -1 "$FIXTURES/$id/bad.ts" | sed -nE 's/.*MUST match \(([0-9]+)\).*/\1/p')"
      if [[ -z "$want" ]]; then bad "$id: bad.ts line 1 must say 'MUST match (N)'"
      elif [[ $got -ne $want ]]; then bad "$id: $kind.ts produced $got findings, expected $want"
      else echo "  $id/$kind.ts: $got finding(s) — ok"; fi
    done
  done
}

if [[ $MODE == self-test ]]; then
  self_test
  [[ $FAIL -eq 0 ]] && printf '\033[32m✔ rule fixtures ok\033[0m\n'
  exit $FAIL
fi

# ---- 0. node major ---------------------------------------------------------
step "node version"
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo none)"
if [[ "$NODE_MAJOR" != 22 ]]; then
  bad "node $(node -v 2>/dev/null || echo missing) — ThreatForge pins Node 22 (.nvmrc). Run: fnm use (or nvm use) and retry."
  exit 1
fi
echo "  node $(node -v)"

# ---- 1. npm audit ----------------------------------------------------------
for dir in server frontend; do
  step "npm audit ($dir, production deps)"
  json="$(cd "$dir" && npm audit --omit=dev --json 2>/dev/null || true)"
  read -r crit high < <(printf '%s' "$json" | node -e '
    let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{
      try { const v=JSON.parse(s).metadata.vulnerabilities; console.log(v.critical, v.high); }
      catch { console.log("err err"); } });')
  if [[ $crit == err ]]; then
    # Offline laptop: skip. CI: this is the check the job exists for — fail.
    if [[ $MODE == ci ]]; then bad "npm audit for $dir returned no report"; else skip "npm audit for $dir returned no report (offline / registry down)"; fi
    continue
  fi
  if [[ $crit -gt 0 ]]; then
    bad "$dir: $crit CRITICAL production advisories"
    (cd "$dir" && npm audit --omit=dev --audit-level=critical) || true
  else
    echo "  0 critical"
  fi
  [[ $high -gt 0 ]] && warn "$dir: $high high production advisories (not blocking; run 'npm audit --omit=dev' in $dir)"
done

# ---- 2. gitleaks -----------------------------------------------------------
# Known false positives: .gitleaks.toml (path allowlist for fixtures that still exist at HEAD).
step "gitleaks"
RANGE=""
if [[ $MODE == gate ]]; then
  # The pre-push hook eats the ref list on stdin, so derive the range here.
  # Not `@{u}..HEAD` alone: that is empty-and-green for a branch with no
  # upstream. Fall back to origin/main.
  if base="$(git rev-parse --verify -q '@{u}')"; then RANGE="$base..HEAD"; else RANGE="origin/main..HEAD"; fi
elif [[ -n "${SCAN_BASE:-}" ]]; then
  RANGE="$SCAN_BASE..HEAD"
fi
if [[ -z "$GITLEAKS" ]]; then
  skip "gitleaks not installed — secrets not scanned"
elif [[ -n "$RANGE" && -z "$(git rev-list "$RANGE" 2>/dev/null | head -1)" ]]; then
  echo "  no new commits in $RANGE — nothing to scan"
else
  if [[ -n "$RANGE" ]]; then
    echo "  commits: $RANGE ($(git rev-list --count "$RANGE"))"
    "$GITLEAKS" git . --no-banner --redact --verbose --log-level warn --log-opts="$RANGE" || bad "gitleaks found secrets in $RANGE"
  else
    echo "  full history"
    "$GITLEAKS" git . --no-banner --redact --verbose --log-level warn || bad "gitleaks found secrets in history"
  fi
fi

# ---- 3. opengrep house rules ----------------------------------------------
step "opengrep house rules ($RULES)"
if [[ -z "$OPENGREP" ]]; then
  skip "opengrep not installed — house rules not run"
else
  BASELINE=""
  if [[ $MODE == gate ]]; then BASELINE="$(git merge-base HEAD origin/main 2>/dev/null || true)"
  elif [[ -n "${SCAN_BASE:-}" ]]; then BASELINE="$(git merge-base HEAD "$SCAN_BASE" 2>/dev/null || true)"; fi
  if [[ -n "$BASELINE" ]]; then
    # Only findings this branch introduces; both severities block.
    echo "  new findings vs $(git rev-parse --short "$BASELINE")"
    og --error --baseline-commit "$BASELINE" server/src frontend/src || bad "opengrep: new house-rule findings (see above)"
  else
    # Whole tree: ERROR rules block, WARNING rules are the known backlog.
    og --error --severity ERROR server/src frontend/src || bad "opengrep: ERROR house-rule findings (see above)"
    n=$(og --json --severity WARNING server/src frontend/src | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const r=JSON.parse(s).results;for(const f of r)console.error(`  ${f.path}:${f.start.line} ${f.check_id.split(".").pop()}`);console.log(r.length)})')
    [[ $n -gt 0 ]] && warn "$n WARNING house-rule findings above are the existing backlog (not blocking)"
  fi
  # Fixtures change only with the rules; CI checks them, the gate skips the
  # ~4 extra opengrep start-ups.
  [[ $MODE == ci ]] && self_test
fi

if [[ $FAIL -ne 0 ]]; then printf '\n\033[31m✘ security scan failed\033[0m\n'; exit 1; fi
printf '\n\033[32m✔ security scan clean\033[0m\n'

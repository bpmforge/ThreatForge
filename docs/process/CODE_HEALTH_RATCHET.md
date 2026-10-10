# Code-health ratchet

`scripts/code-health.sh` holds duplicate and dead code at or below a committed
baseline (`tools/code-health/baseline.json`). It runs in the pre-push gate (`scripts/gate.sh`,
about 10 s with opengrep, 2-3 s without) and in CI's Standards Check job.

## What it checks

| Tool | Per package (`server`, `frontend`) | Config |
|------|------------------------------------|--------|
| jscpd | clone count, duplicated lines (and % for information), clones of 15+ lines | `.jscpd.json` |
| knip | unused files, exports, exported types, dependencies (unused, unlisted, unresolved) | `tools/code-health/knip.<pkg>.jsonc` |
| opengrep | hits of an optional opengrep rule pack, **local only**: runs when `opengrep` is installed and `CODE_HEALTH_RULES_DIR` points at the rules; skipped with a message otherwise (including CI) | built in |

The check fails (exit 1) when any count rises **or** any finding appears that is not in
the baseline. Findings are fingerprinted without line numbers, so moving code does not
trip it: a clone is its file pair, a knip finding is its file plus symbol or dependency,
an opengrep hit is its rule plus file.

Excluded on purpose (known false-positive families): tests, e2e,
`node_modules`, generated code, Prisma schemas and seeds, the `component-types.ts` server/frontend mirror (kept in lock-step by a test),
Next.js app-router files (knip plugin), `scripts/` and `src/scripts/` entry points, the
Playwright setup project, and three dependencies that are loaded by string or through a
meta-package. The reasons are commented in each config.

## The loop

```bash
npm --prefix tools/code-health run check        # or: scripts/code-health.sh
```

1. Run it. On failure it prints only the NEW findings, one per line, with locations.
2. Fix each one: pull the clone into a shared helper, delete the unused file or export
   (or wire it up if it should be used), remove or declare the dependency.
3. Rerun until it prints `clean`.
4. If the run reports `improved: ...`, lock it in: `scripts/code-health.sh --update`, and
   commit `tools/code-health/baseline.json` with the fix.

An opengrep hit that is a false positive: put `// nosemgrep: <rule-id>` (the short id
the check prints, e.g. `bpm-slop-empty-catch`) on its own line directly above the line the
hit starts on, with a reason, rather than raising the baseline. A trailing comment on that
line also works, but Prettier may move it to the next line, where it no longer applies.

## Raising the baseline

`--update` only lowers the baseline. When a new finding is genuinely intended, record why:

```bash
scripts/code-health.sh --update --allow-increase "duplicated parser kept until the v2 cut-over (#123)"
```

The reason, the metrics that rose and the new fingerprints are appended to `increases`
in the baseline, so every raise is reviewable in the diff.

## Paying it down

Pick a file pair or a file from `baseline.json`, fix it, run the loop, `--update`, commit.
Good first targets: the 130 unused files (`knip file ...`), and the server clone pairs,
which hold most of the duplicated lines.

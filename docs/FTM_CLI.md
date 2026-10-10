# `ftm` CLI (`@threatforge/cli`)

Validate a threat-model YAML file in CI.

```bash
cd cli && npm ci && npm run build
node dist/cli.js validate threatforge.yaml            # or `ftm validate ...` once installed
```

| Option | Meaning |
|---|---|
| `--fail-on <severity>` | Exit 1 if any threat at or above this severity is unmitigated. `CRITICAL` (default), `HIGH`, `MEDIUM`, `LOW`, `INFORMATIONAL` |
| `--json` | Machine-readable result (`valid`, `pass`, `blocking[]`, `counts`) |

Exit codes: `0` pass, `1` unmitigated threats at or above the threshold, `2` YAML parse error, schema error, unreadable file or bad usage (schema errors are listed in full).

A threat counts as **mitigated** when its status is `MITIGATED`, `ACCEPTED`/`ACCEPTED_RISK`, `NOT_APPLICABLE` or `FALSE_POSITIVE`, or it has at least one mitigation with status `IMPLEMENTED`.

Both YAML dialects are accepted: the "threat model as code" export (`model.name`, mitigations nested under each threat) and the server export (top-level `name`, flat `mitigations[]` keyed by threat name).

CI: `.github/workflows/threat-check.yml` job `ftm-validate` builds the CLI and validates every tracked `threatforge.yaml` / `*.threat-model.yaml`. The package is not yet published to npm; it replaces the removed `tools/validate-threatmodel.js` and `tools/ftm-cli/validate.ts` heuristics.

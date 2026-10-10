# Contributing to ThreatForge

Thanks for your interest in improving ThreatForge! This guide covers how to
contribute and the licensing terms your contributions are made under.

## Licensing of contributions (important)

ThreatForge is **dual-licensed**: it is available to the public under the
[Functional Source License 1.1](./LICENSE) and is also offered under
[commercial licenses](./COMMERCIAL.md) by the copyright holder.

By submitting a contribution (pull request, patch, or otherwise), you agree
that:

1. Your contribution is your own original work (or you have the right to submit
   it), in line with the [Developer Certificate of Origin](https://developercertificate.org/).
2. You license your contribution to the project under the FSL-1.1-ALv2, **and**
   you grant the copyright holder (Bradford Matthews / bpmforge) the right to
   include your contribution in versions distributed under a commercial
   license.

This dual grant is what lets the project stay sustainable (commercial licenses
fund the work) while remaining free for the community. If you cannot agree to
this, please open an issue to discuss before contributing code.

Sign your commits to certify the DCO:

```bash
git commit -s -m "your message"
```

## Development setup

See the [README](./README.md) and
[docs/development/GETTING_STARTED.md](./docs/development/GETTING_STARTED.md).

```bash
(cd server && npm install && npm run dev)     # backend
(cd frontend && npm install && npm run dev)   # frontend
```

## Before opening a PR

- Branch from `main` using `feat/<name>`, `fix/<name>`, or `docs/<name>`.
- Match the patterns in the surrounding code: feature-sliced folders in the
  frontend, the shared API response helpers in the server, and accessible UI.
- Run the checks:
  ```bash
  (cd server && npm run lint && npx tsc --noEmit && npx vitest run)
  (cd frontend && npm run lint && npx tsc --noEmit && npm run test:run)
  ```
  `scripts/gate.sh` runs the same checks plus the security and code-health scans.
- Add tests alongside new code.
- Keep PRs focused and describe the change clearly.

## Reporting bugs and requesting features

Open a GitHub issue. For **security** issues, do **not** open a public issue —
follow [SECURITY.md](./SECURITY.md) instead.

## Pre-push gate

The checks that protect `main` can also run locally, before every push, from a
tracked hook:

```bash
git config core.hooksPath .githooks   # once per clone
scripts/gate.sh                       # what the hook runs (~3 min)
scripts/gate.sh --postgres            # adds the Postgres lane; needs TEST_DATABASE_URL
```

The gate runs eslint, `tsc --noEmit` and vitest for both `frontend/` and
`server/`. It skips Playwright e2e, image builds and the security scanners;
those stay in the workflows under `.github/workflows/`. To push without it,
`GATE_SKIP=1 git push` and say why in the commit message.

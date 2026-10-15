# Changelog

All notable changes to ThreatForge are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and versions follow
[Semantic Versioning](https://semver.org/).

## [Unreleased]

### Fixed
- **Verified accounts could not sign in.** With an email provider configured,
  following the verification link marked the address verified but left the
  account pending, so sign-in kept answering "Verify your email address before
  signing in". Verification now activates the account, and sign-in activates
  accounts already caught in that state.
- **The dashboard crashed after sign-in** ("This page couldn't load") because the
  active AI jobs panel read the paginated job list as a plain array.
- **`./scripts/demo.sh` failed on a fresh clone.** It now fills in `JWT_SECRET`,
  `AUTH_SECRET` and a random first-admin password, and waits until the app
  answers before printing the sign-in details.
- **`docker compose up` with the example `.env` never started:** the `init`
  service refused the example admin password and the API waits on it. The
  example now leaves the password empty with a note.
- **New Project on the Projects page always failed** with "Access denied". The
  route's declared policy required an organization id in the request, but the
  page leaves it out and lets the server pick the caller's organization.
- **The nightly end-to-end run never finished.** Tests had drifted from the
  current UI (setup wizard over new models, the new-model chooser, renamed
  settings) and API (422 for validation, `{ data }` envelopes), and canvas
  tests hung until the 30-minute job limit.
- **The Guided Threat Model Setup wizard did not fit short screens.** On a
  720px-tall window its buttons, including Skip Wizard, sat below the edge with
  no way to scroll to them. The dialog now scrolls.

### Documentation
- README: screenshots, a 60-second Docker quickstart, and an accurate
  Kubernetes note (images are not published yet).

## [1.1.0] — 2026-10-08

First public release. This release is mostly security hardening from a full
audit of 1.0.3, plus the reliability fixes needed before opening the project up.

### Upgrade notes
- **AI on a private network:** an organization's AI base URL on loopback or a
  private network now needs the super-admin AI private-host allowlist (Admin >
  Settings > Security, or `AI_PRIVATE_HOST_ALLOWLIST`). Allowlist any private AI
  host already in use **before** upgrading, or those organizations' AI calls
  are refused (docs/ADMIN_RUNBOOK.md 7b).
- **Outgoing webhooks to private addresses** (a LAN receiver) are now refused
  with "Webhook URL rejected"; point them at a public URL.
- **Scanner findings index:** run `server/prisma/migrations/scanner-findings-unique-per-project.sql`
  before the schema push (it adds an index and deletes nothing).
- **CI webhooks:** GitHub, GitLab and Bitbucket deliveries are refused until the
  organization sets a CI webhook secret, and Bitbucket webhooks need that
  secret configured on the Bitbucket side too.
- **Sign-ins end after a password reset;** users who reset sign in again on
  every device.
- New optional settings: `NVD_API_KEY` and `METRICS_TOKEN` are now passed to the
  server container, and `/health` reports `version` and `commit`.

### Security
- **Every API route declares who may call it, and the declaration is enforced.**
  Organization-role, model-permission and super-admin rules are checked before
  the handler runs. A test fails if a route has no rule, and another shows no
  rule is stricter than its handler.
- **Cross-tenant test suite:** every route that takes an id is called with
  another organization's ids, as an outsider and as a suspended member, on
  every test run.
- Closed critical cross-tenant holes (admin routes open to any org owner, the
  v1 data API with no tenant filter, unauthenticated pipeline routes, SCIM
  account takeover, an AI base URL change that leaked the API key) and many
  smaller ones. Viewers and guests can no longer write. Suspended members lose
  access everywhere, and child ids must belong to their parent.
- Webhooks: incoming signatures are checked over the exact bytes received, and
  the Bitbucket CI webhook is now verified. Outgoing webhooks refuse private
  addresses, never follow redirects, and are always properly signed. Notification
  webhooks used to send part of the stored secret as their "signature".
- Accounts: a password reset ends existing sessions. Email verification tokens
  and CI webhook secrets are stored hashed or encrypted. Setup never creates an
  admin from default credentials. Invitations need the invitee's consent.
- Read-only demo accounts (`DEMO_READONLY_USER_EMAILS`); every write is refused
  with 403 `READ_ONLY_ACCOUNT`.
- Permissions: creating Jira/GitHub issues, syncing and repository analysis need
  editor or above. Guests need export rights to export. Instant AI suggestions
  need edit access.
- AI document extraction uses the organization you are working in, not the
  first one you belong to.
- Small cross-org leaks closed: user avatars, live presence counts, template
  category counts, risk-framework presets.
- Scanner findings are kept per project; an import no longer overwrites another
  organization's finding.
- Canvas saves are encrypted when `ENCRYPT_AT_REST` is on.
- Dependencies: Next.js 16.3.8 (critical RCE advisories) and fastify 5.12.5.

### Fixed
- Password reset, forgot-password and email verification work in
  same-origin deployments (the sign-in handler was answering those requests).
- An empty or out-of-date canvas can no longer be saved over a model when live
  editing fails to load. The session closes with "Could not load this model for
  editing".
- Expert and agentic analysis always run as background jobs that respect the AI
  spend cap, with or without Redis. AI usage and cost are recorded, so the spend
  cap works.
- Job progress stops polling when the job can't be read, and a crashed local
  model is no longer retried as "prompt too large" (up to 9 calls before).
- Failed saves always show an error instead of looking like they worked.
- "Move to project" works; "Refresh index" really refreshes; toast notifications
  are shown (the toaster was not mounted).
- Accessibility: named menu buttons on model cards and readable status colours.
- Canvas: 87 → 7 save calls per node move, and fewer re-renders while dragging.

### Added
- NVD API key setting: super admins enter the install's own key in Admin >
  Settings > General (stored encrypted, never shown again); `NVD_API_KEY`
  remains a fallback. See docs/ADMIN_RUNBOOK.md 7c.
- Deterministic duplicate guard for AI-suggested threats and mitigations.
- `/health` reports the running version and commit. Deploys check the new build
  is serving and run an HTTP smoke test.
- Gate: npm audit, gitleaks and opengrep in the pre-push gate and CI; Node 22
  pinned; duplicate and dead-code ratchet.

### Removed
- The unused extensions feature (routes, UI and tables).

### Known limitations
- AI threat suggestions are labelled "suggested, review required": measured
  precision on the Seed-08 evaluation is about 43% (AI-labelled).
- The Jira integration is marked "Unverified": it has not been tested against a
  live Jira site.
- About 80 routes are only partly covered by the cross-tenant suite (they
  reject an empty body before the permission check).

## [1.0.3] — 2026-10-04

### Added
- API Gateway built-in template (7 components, 8 threats); the quick-start card now creates a populated model.
- `backfill-normalized-names` script for upgrades: recomputes threat dedup keys after the actor-aware normaliser change (R25).

### Fixed
- Built-in templates now open with component names, trust boundaries, auth labels and threats attached to their components (previously type labels only, no boundaries, unattached threats).

### Removed
- Superseded `tools/validate-threatmodel.js` and `tools/ftm-cli/validate.ts`; use `ftm validate`.

### Known limitations
- Rendered PDF/DOCX branding verified only through the branding API and unit tests, not visually.
- Architectural-mitigation proposals need a configured AI provider to generate.

## [1.0.2] — 2026-10-03

### Fixed
- `/models/new` now renders inside the app shell, centred, and shows the chosen template.
- Built-in templates instantiate: `from-template` returned 500 on seeded templates (missing positions, non-enum component/trust names). A normaliser handles both seeded and saved-as-template shapes, and creation is transactional so a failure leaves no orphan model.
- Organization branding swatches show the default colours instead of black when unset.

### Known limitations
- Not visually verified: rich-text node labels, the architectural mitigations panel, a populated systemic-patterns view, branded report output.
- The API Gateway quick-start card has no built-in template and falls back to a blank model.

## [1.0.1] — 2026-10-03

Fixes found by running the 1.0.0 compose stack from a fresh clone and clicking through it.

### Fixed
- Fresh compose deploys no longer redirect the first visitor to the `/setup` wizard: `bootstrap-admin` marks first-time setup complete when it creates the admin from `INITIAL_SYSTEM_ADMIN_*`.
- Frontend proxy routes (organizations, projects, ai-jobs and 23 others) returned 503 in the compose container because they baked `localhost:3001` in at build time; they now use the runtime `INTERNAL_API_URL`.
- Marketplace page crashed (`map is not a function`) when listing categories, templates and subscriptions.

### Known limitations
- Not visually verified: rich-text node labels, the architectural mitigations panel, a populated systemic-patterns view, branded report output.
- `/models/new` renders outside the app shell and ignores the chosen template.

## [1.0.0] — 2026-10-02

### Added
- `ftm validate` CLI; `threat-check.yml` fails on an unmitigated CRITICAL.
- Org logo and colours on PDF and DOCX reports; rich-text node labels with YAML round-trip.
- Architectural mitigation proposals, reviewable in the UI.
- Seeded community marketplace packs and a cross-portfolio systemic-pattern view (`/analytics/patterns`).
- Org quota enforcement at AI job enqueue (HTTP 429).
- Container deployment (compose) with BoxyHQ Jackson as the SAML provider.

### Changed
- Encryption at rest is on by default in the prod/compose profile; the stack refuses to start without `ENCRYPTION_KEY`.
- `agentChainV2` defaults ON. An org that never set the flag gets v2 only when the built-in pipeline is seeded, otherwise legacy with a warning; an explicit `false` opts out.
- Prompt batch (R16/R20/R21/R23/R24/P7/B1) with re-recorded replay canon; recall 110/120 over three seeds.

### Fixed
- AI pipeline: supply-chain sentinel, finish-reason handling, parse-failure metrics, cancel/resume polling, component-scoped severity matching, component-name resolution in the legacy prompt (R29).

### Known limitations
- `docker compose up` from a fresh clone has not been run (no container runtime on the build machine); the Jackson compose config was checked against upstream docs only.
- Precision labels are AI-assigned until the Seed-08 labels are human-reviewed.
- Cloud (Terraform/Helm) deployment is out of scope for 1.0.

## [1.0.0-rc.1] — 2026-09-22

First release candidate. Everything named in `docs/VISION.md` for the 2026-H2
product is on `main`; this tag marks the point where the verification gates
run and are green, not a feature line.

### Added
- `scripts/gate.sh` and a tracked `.githooks/pre-push` hook: the CI checks run
  locally before every push. `--postgres` runs the Postgres lane against a real database.
- `CHANGELOG.md`.

### Fixed
- Prod smoke suite (`smoke-prod` Playwright project) is trustworthy again:
  auth reuse and Yjs edge-field waits were harness artefacts, not product
  failures.
- CI: the Server Tests (Postgres) job now runs inside a container so the
  `postgres` service alias resolves; every DB-backed test file had been
  failing with P1001 on hosted runners.
- CI: the Trivy SARIF upload no longer fails the security workflow on a
  private repo without Advanced Security.

### Verified for this candidate
- frontend: lint 0 errors, tsc clean, 952 unit tests passing (84 files).
- server: lint 0 errors, tsc clean, 1072 unit tests passing (113 files)
  against SQLite, and the 8 database-backed files passing against Postgres 16.

### Changed
- `deleteAllModels` in the use-case e2e fixtures refuses to run against the
  public host unless `E2E_ALLOW_ACCOUNT_WIPE=1`; UC-07/UC-11 had emptied the
  demo account twice. A new `reseed-demo` Playwright project restores the
  five expected demo models idempotently.

### Known gaps carried into the RC
- The demo account on the demo host holds 2 models; the smoke suite expects
  the 5 seeded demo models. Run
  `TOUR_BASE_URL=https://your-threatforge-host npx playwright test --project=reseed-demo`
  before promoting rc.1 to 1.0.0 (smoke was 11 pass / 1 skip / 1 fail on 09-22
  for this reason alone).
- AI-pipeline correctness follow-ups remain on `feat/ai-*` and `fix/ai-*`
  branches.
- No hosted CI has run since 2026-09-04; the local gate is the gate.

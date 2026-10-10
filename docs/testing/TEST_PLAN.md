# ThreatForge Test Plan

_Tracks every use-case E2E test from [USE_CASES.md](./USE_CASES.md). Updated after each test run._

**Test location:** `frontend/e2e/use-cases/`
**Run command:** `TOUR_BASE_URL=https://your-threatforge-host npx playwright test --project=use-cases`
**Fixtures helper:** `frontend/e2e/use-cases/_fixtures.ts`

---

## Rollout criteria

| Gate | Requirement |
|---|---|
| **Demo-ready** | All P0 tests passing, zero BLOCKERS in security audit |
| **Ship-ready** | All P0 + P1 tests passing, security HIGH findings resolved |
| **Production-hardened** | All P0 + P1 + P2 passing, full OWASP audit clean |

---

## P0 Tests (30) — Demo-blocking

| UC | Test | Status | Last run | Notes |
|---|---|---|---|---|
| 02 | `02-login.spec.ts` | not started | — | Valid credentials → dashboard |
| 03 | `03-login-failure.spec.ts` | not started | — | Wrong password, lockout |
| 04 | `04-logout.spec.ts` | not started | — | Session cleared, redirect |
| 07 | `07-dashboard-empty.spec.ts` | not started | — | Empty state, correct label |
| 08 | `08-dashboard-stats.spec.ts` | not started | — | Stats cards populate |
| 10 | `10-sidebar-nav.spec.ts` | not started | — | All sidebar links work |
| 11 | `11-create-model.spec.ts` | not started | — | Dialog → canvas loads |
| 17 | `17-palette-drag.spec.ts` | not started | — | Components appear on canvas |
| 18 | `18-create-edges.spec.ts` | not started | — | Connections persist |
| 19 | `19-trust-boundaries.spec.ts` | not started | — | Boundary groups components |
| 20 | `20-component-properties.spec.ts` | not started | — | Properties panel populates |
| 21 | `21-connection-properties.spec.ts` | not started | — | Edge data editable |
| 22 | `22-save-reload.spec.ts` | not started | — | State survives reload |
| 26 | `26-ai-available.spec.ts` | not started | — | AI tab shows methodology selector |
| 27 | `27-ai-stride.spec.ts` | not started | — | Returns 8+ threats with valid schema |
| 29 | `29-accept-reject-threats.spec.ts` | not started | — | Accepted threat in Threats tab |
| 36 | `36-doc-import.spec.ts` | not started | — | Upload SRS, components extracted |
| 37 | `37-merge-review.spec.ts` | not started | — | MergeReviewDialog renders decisions |
| 40 | `40-code-scan-files.spec.ts` | not started | — | Local files scanned, findings shown |
| 41 | `41-code-scan-github.spec.ts` | not started | — | GitHub URL scanned |
| 42 | `42-scan-findings.spec.ts` | not started | — | Findings mapped to components |
| 44 | `44-browse-templates.spec.ts` | not started | — | Template library renders cards |
| 45 | `45-create-from-template.spec.ts` | not started | — | Template → pre-built diagram |
| 48 | `48-add-threat-manual.spec.ts` | not started | — | Manual threat creation |
| 49 | `49-browse-threat-library.spec.ts` | not started | — | Curated library opens + add works |
| 55 | `55-add-mitigation.spec.ts` | not started | — | Mitigation appears under threat |
| 56 | `56-mitigation-evidence.spec.ts` | not started | — | Evidence links + requirements |
| 58 | `58-link-requirement.spec.ts` | not started | — | Requirement picker, join table |
| 61 | `61-framework-import.spec.ts` | not started | — | 12 frameworks, controls import |
| 63 | `63-gap-analysis.spec.ts` | not started | — | Uncovered threats + requirements |
| 64 | `64-coverage-dashboard.spec.ts` | not started | — | Percentage bar, filter tabs |
| 67 | `67-risk-dashboard.spec.ts` | not started | — | Org-wide risk renders |
| 72 | `72-export-pdf.spec.ts` | not started | — | PDF downloads without error |
| 76 | `76-risk-register.spec.ts` | not started | — | CSV downloads, correct columns |
| 78 | `78-invite-user.spec.ts` | not started | — | Invitation sent/accepted |
| 81 | `81-ai-provider-config.spec.ts` | not started | — | LM Studio provider added |
| 82 | `82-test-ai-provider.spec.ts` | not started | — | Provider responds to test |

## P1 Tests (34) — Should work

_Listed by UC number. Will be detailed + implemented after P0s pass._

05, 06, 09, 12, 13, 14, 23, 28, 30, 31, 38, 39, 43, 46, 50, 51, 52, 53, 54, 57, 59, 62, 65, 66, 68, 69, 70, 71, 73, 75, 77, 79, 80, 87, 88, 91, 94

## P2/P3 Tests (31) — Defer

15, 16, 24, 25, 32, 33, 34, 35, 47, 60, 74, 83, 84, 85, 86, 89, 90, 92, 93, 95

---

## Cross-cutting checks (applied to every test)

Every spec file imports `expectClean(page)` from `_fixtures.ts` and calls it at the end:
- Zero console errors (filtered for known noise like CF Insights)
- Zero 4xx/5xx network responses for endpoints the test touched
- No visible "Error" / "Failed" text in the viewport

---

## Run history

| Date | P0 pass | P0 fail | P1 pass | Duration | Notes |
|---|---|---|---|---|---|
| — | — | — | — | — | No tests written yet |

# ThreatForge Use Case Catalog

_Source of truth for what the product does and who uses it. Every major user-facing capability has an entry here. Each use case is mapped to one or more end-to-end tests in [TEST_PLAN.md](./TEST_PLAN.md) and one or more personas in [PERSONAS.md](./PERSONAS.md)._

**Scope:** All user-facing flows that matter for a demo, a customer, or a regression. Low-level platform plumbing (migrations, build, deploy) is out of scope — this is about product behavior.

**Priority buckets:**
- **P0** — Demo-blocking. A VP walking through the tour or clicking around on their own must not hit a broken P0.
- **P1** — Should work. Regression on P1 is embarrassing but not demo-blocking.
- **P2** — Nice to have. Known bugs acceptable short-term.
- **P3** — Deferred. Document only; no test coverage expected yet.

---

## Index

| # | Use case | Persona | Priority | Test file |
|---|---|---|---|---|
| **Auth & onboarding** | | | | |
| 01 | First-time signup and organization creation | Sam/Adam | P0 | `01-signup-first-org.spec.ts` |
| 02 | Login with valid credentials | everyone | P0 | `02-login.spec.ts` |
| 03 | Login failure (wrong password, account lockout) | everyone | P0 | `03-login-failure.spec.ts` |
| 04 | Logout and session expiry | everyone | P0 | `04-logout.spec.ts` |
| 05 | Password reset flow | everyone | P1 | `05-password-reset.spec.ts` |
| 06 | Switch active organization | Sam/Erin | P1 | `06-switch-org.spec.ts` |
| **Dashboard & navigation** | | | | |
| 07 | Empty-state dashboard for new users | Sam | P0 | `07-dashboard-empty.spec.ts` |
| 08 | Populated dashboard with stats | Sam/Erin | P0 | `08-dashboard-stats.spec.ts` |
| 09 | Portfolio view across projects | Erin/Vera | P1 | `09-portfolio.spec.ts` |
| 10 | Left-sidebar navigation between surfaces | everyone | P0 | `10-sidebar-nav.spec.ts` |
| **Threat model lifecycle** | | | | |
| 11 | Create new threat model from dashboard | Sam | P0 | `11-create-model.spec.ts` |
| 12 | Rename / edit model metadata | Sam | P1 | `12-edit-model-metadata.spec.ts` |
| 13 | Duplicate an existing model | Sam | P1 | `13-duplicate-model.spec.ts` |
| 14 | Archive / delete a model | Sam/Adam | P1 | `14-delete-model.spec.ts` |
| 15 | Model version history and revert | Sam | P2 | `15-version-history.spec.ts` |
| 16 | Draft → In Review → Published status flow | Erin | P2 | `16-status-flow.spec.ts` |
| **Canvas building — greenfield** | | | | |
| 17 | Drag components from palette onto blank canvas | Sam | P0 | `17-palette-drag.spec.ts` |
| 18 | Create connections (edges) between components | Sam | P0 | `18-create-edges.spec.ts` |
| 19 | Add trust boundaries around component groups | Sam | P0 | `19-trust-boundaries.spec.ts` |
| 20 | Edit component properties (trust, tech stack, interfaces) | Sam | P0 | `20-component-properties.spec.ts` |
| 21 | Edit connection properties (protocol, encryption, auth) | Sam | P0 | `21-connection-properties.spec.ts` |
| 22 | Save canvas and reload with state intact | Sam | P0 | `22-save-reload.spec.ts` |
| 23 | Undo / redo on canvas actions | Sam | P1 | `23-undo-redo.spec.ts` |
| 24 | Copy / paste components | Sam | P2 | `24-copy-paste.spec.ts` |
| 25 | Keyboard shortcuts (delete, select all, save) | Sam | P2 | `25-keyboard-shortcuts.spec.ts` |
| **AI-assisted threat analysis** | | | | |
| 26 | Check AI availability before running | Sam | P0 | `26-ai-available.spec.ts` |
| 27 | Run STRIDE threat suggestion on a built model | Sam | P0 | `27-ai-stride.spec.ts` |
| 28 | Switch methodology (PASTA / Kill Chain / MITRE) and re-run | Sam | P1 | `28-ai-methodologies.spec.ts` |
| 29 | Accept / reject suggested threats into the model | Sam | P0 | `29-accept-reject-threats.spec.ts` |
| 30 | Generate attack tree for a threat | Sam | P1 | `30-attack-tree.spec.ts` |
| 31 | AI severity calculation for a manual threat | Sam | P1 | `31-ai-severity.spec.ts` |
| 32 | AI refinement questions against a model | Erin | P2 | `32-ai-refinement.spec.ts` |
| 33 | AI expert analysis (6-pass pipeline) | Sam | P2 | `33-expert-analysis.spec.ts` |
| 34 | AI chat with the model as context | Sam | P2 | `34-ai-chat.spec.ts` |
| 35 | AI quota / budget exceeded handling | Adam | P2 | `35-ai-quota.spec.ts` |
| **Document-driven build** | | | | |
| 36 | Upload SRS / SAD document, AI extracts components | Dev/Sam | P0 | `36-doc-import.spec.ts` |
| 37 | Merge review dialog (add / update / skip per component) | Dev/Sam | P0 | `37-merge-review.spec.ts` |
| 38 | Multi-document import (SRS + SAD + SDS together) | Dev/Sam | P1 | `38-multi-doc-import.spec.ts` |
| 39 | Security requirement extraction from SRS | Carla | P1 | `39-srs-requirements.spec.ts` |
| **Code-driven build** | | | | |
| 40 | Code scan via local file upload | Dev | P0 | `40-code-scan-files.spec.ts` |
| 41 | Code scan via GitHub URL | Dev | P0 | `41-code-scan-github.spec.ts` |
| 42 | Scanner findings mapped to components | Dev | P0 | `42-scan-findings.spec.ts` |
| 43 | Scanner error handling (bad URL, private repo, rate limit) | Dev | P1 | `43-scan-errors.spec.ts` |
| **Template library** | | | | |
| 44 | Browse template library | Sam | P0 | `44-browse-templates.spec.ts` |
| 45 | Create model from template | Sam | P0 | `45-create-from-template.spec.ts` |
| 46 | Save custom model as template | Sam/Adam | P1 | `46-save-as-template.spec.ts` |
| 47 | Template versioning / publishing | Adam | P2 | `47-template-publish.spec.ts` |
| **Threats tab** | | | | |
| 48 | Add threat manually | Sam | P0 | `48-add-threat-manual.spec.ts` |
| 49 | Browse threat library (curated) and add | Sam | P0 | `49-browse-threat-library.spec.ts` |
| 50 | Edit existing threat | Sam | P1 | `50-edit-threat.spec.ts` |
| 51 | Delete threat | Sam | P1 | `51-delete-threat.spec.ts` |
| 52 | Filter threats by component / severity / STRIDE | Sam/Erin | P1 | `52-filter-threats.spec.ts` |
| 53 | Group threats by category | Sam/Erin | P1 | `53-group-threats.spec.ts` |
| 54 | Link threat to specific component or connection | Sam | P1 | `54-link-threat-target.spec.ts` |
| **Mitigations & evidence** | | | | |
| 55 | Add mitigation to a threat | Sam | P0 | `55-add-mitigation.spec.ts` |
| 56 | Edit mitigation with evidence links | Sam/Carla | P0 | `56-mitigation-evidence.spec.ts` |
| 57 | Move mitigation between threats | Sam | P1 | `57-move-mitigation.spec.ts` |
| 58 | Link mitigation to compliance requirement | Carla | P0 | `58-link-requirement.spec.ts` |
| 59 | Mitigation status transitions (planned → in progress → verified) | Erin | P1 | `59-mitigation-status.spec.ts` |
| 60 | Jira push for a threat or mitigation | Dev | P2 | `60-jira-push.spec.ts` |
| **Requirements & compliance** | | | | |
| 61 | Import a compliance framework (NIST 800-53, PCI-DSS, SOC 2) | Carla | P0 | `61-framework-import.spec.ts` |
| 62 | Add custom compliance requirement | Carla | P1 | `62-custom-requirement.spec.ts` |
| 63 | Gap analysis: show uncovered requirements | Carla | P0 | `63-gap-analysis.spec.ts` |
| 64 | Requirements coverage dashboard | Carla | P0 | `64-coverage-dashboard.spec.ts` |
| 65 | Bulk import requirements via CSV | Carla | P1 | `65-csv-import.spec.ts` |
| 66 | Export gap analysis as CSV | Carla | P1 | `66-gap-csv-export.spec.ts` |
| **Analytics surfaces** | | | | |
| 67 | Risk dashboard (org-wide) | Vera | P0 | `67-risk-dashboard.spec.ts` |
| 68 | Attack paths analytics | Vera | P1 | `68-attack-paths.spec.ts` |
| 69 | Attack surface analytics | Vera | P1 | `69-attack-surface.spec.ts` |
| 70 | Compliance analytics (portfolio view) | Carla/Vera | P1 | `70-compliance-analytics.spec.ts` |
| 71 | Portfolio analytics (all projects/models) | Erin/Vera | P1 | `71-portfolio-analytics.spec.ts` |
| **Exports** | | | | |
| 72 | Export PDF report | Sam/Vera | P0 | `72-export-pdf.spec.ts` |
| 73 | Export JSON (full model backup) | Sam | P1 | `73-export-json.spec.ts` |
| 74 | Export YAML | Sam | P2 | `74-export-yaml.spec.ts` |
| 75 | Export PNG / SVG of canvas | Sam | P1 | `75-export-image.spec.ts` |
| 76 | Risk register CSV (GRC format) | Carla | P0 | `76-risk-register.spec.ts` |
| 77 | Executive summary PDF | Vera | P1 | `77-exec-summary.spec.ts` |
| **Admin** | | | | |
| 78 | Invite user to organization | Adam | P0 | `78-invite-user.spec.ts` |
| 79 | Change user role | Adam | P1 | `79-change-role.spec.ts` |
| 80 | Remove user from organization | Adam | P1 | `80-remove-user.spec.ts` |
| 81 | Configure AI provider (add LM Studio / OpenAI / Claude) | Adam | P0 | `81-ai-provider-config.spec.ts` |
| 82 | Test AI provider connection | Adam | P0 | `82-test-ai-provider.spec.ts` |
| 83 | Rotate AI provider API key | Adam | P2 | `83-rotate-key.spec.ts` |
| 84 | Set AI budget and guardrails | Adam | P2 | `84-ai-budget.spec.ts` |
| 85 | Configure SSO (OIDC) | Adam | P2 | `85-sso-config.spec.ts` |
| 86 | SCIM provisioning setup | Adam | P2 | `86-scim.spec.ts` |
| 87 | Audit log review | Adam | P1 | `87-audit-log.spec.ts` |
| 88 | API token management | Adam | P1 | `88-api-tokens.spec.ts` |
| 89 | Webhook configuration | Adam | P2 | `89-webhooks.spec.ts` |
| 90 | Prompt library management | Adam | P2 | `90-prompt-library.spec.ts` |
| **Collaboration** | | | | |
| 91 | Real-time multi-user editing (Yjs CRDT) | Sam | P1 | `91-realtime-collab.spec.ts` |
| 92 | Comment on a threat | Erin | P2 | `92-threat-comments.spec.ts` |
| 93 | Review workflow (request review, approve, reject) | Erin | P2 | `93-review-workflow.spec.ts` |
| **Guest / external** | | | | |
| 94 | Guest access via share link (read-only) | Ron | P1 | `94-guest-access.spec.ts` |
| 95 | Guest comment on threat | Ron | P2 | `95-guest-comment.spec.ts` |

**Totals:** 95 use cases. **30 P0 · 34 P1 · 30 P2/P3 · 1 spec file each.**

---

## P0 Use Cases — Detailed

_These are demo-blocking. Each has a full spec below. P1/P2/P3 are indexed above and will get their own spec files as we work through them._

---

### UC-01 · First-time signup and organization creation

**Persona:** Sam (Security Architect) or Adam (Admin) doing initial platform setup.

**Goal:** Onboard a brand-new user into their own org, ready to create the first threat model.

**Preconditions:**
- Clean database (no existing users, or "self-serve signup" enabled).
- Signup endpoint reachable and not rate-limited.

**Trigger:** User visits `/login`, clicks "Create one" next to "Don't have an account?"

**Main flow:**
1. User clicks "Create one" → routed to `/register`.
2. User enters name, work email, password (with strength indicator).
3. User submits → `POST /api/auth/register` creates user with bcrypt hash.
4. User is auto-logged-in, session cookie set.
5. First-time flow prompts user to create an organization.
6. User enters org name + slug → `POST /api/organizations`.
7. User redirected to empty dashboard with "Create Your First Threat Model" button.

**Alternate flows:**
- **Duplicate email** — form shows "An account with that email already exists" with link to login.
- **Weak password** — form blocks submission with specific rule violations.
- **Email validation failure** — malformed email shows inline error.
- **Rate-limited** — 429 response shows "Too many signup attempts" with retry time.
- **Setup token required (production)** — if `SETUP_TOKEN` is set, first user must provide it; subsequent users don't need it.

**Success criteria:**
- New `users` row with hashed password (not plaintext)
- New `organizations` row with correct slug
- New `memberships` row joining user to org with OWNER role
- Session cookie valid, user lands on populated dashboard
- No errors in console or server logs

**Touches:**
- Routes: `POST /api/auth/register`, `POST /api/organizations`, `GET /api/auth/session`
- Tables: `users`, `accounts`, `sessions`, `organizations`, `memberships`
- Middleware: rate-limit (auth zone), password-validation, audit log

---

### UC-02 · Login with valid credentials

**Persona:** Everyone.

**Goal:** User authenticates and lands on their dashboard.

**Preconditions:**
- User exists with a known email/password pair.
- AUTH_URL configured to the app's real hostname.

**Trigger:** User visits `/login` or gets redirected there from a protected route.

**Main flow:**
1. User enters email + password.
2. Clicks "Sign in" → `POST /api/auth/callback/credentials` with CSRF token.
3. NextAuth validates credentials against bcrypt hash.
4. Session cookie (`authjs.session-token` or similar) set with httpOnly, secure, sameSite=lax.
5. Redirect to `AUTH_URL + /dashboard` (must match the hostname user is accessing).
6. Dashboard renders with user name in sidebar.

**Alternate flows:**
- **Wrong password** — "Something went wrong. Please try again." (generic to prevent enumeration).
- **Non-existent user** — same generic error.
- **Account locked** (10 failed attempts) — 429 with lockout timer message.
- **CSRF token missing** — 403, re-fetch token.
- **AUTH_URL mismatch** (bug we hit 2026-04-11) — login appears to succeed but session cookie is dropped on cross-host redirect. User bounces back to login.

**Success criteria:**
- `POST /api/auth/callback/credentials` returns 302 to `/dashboard` on the *same hostname* user authenticated on.
- Session cookie present after redirect.
- `GET /api/auth/session` returns the user object.
- Dashboard renders without console errors.

**Touches:**
- Routes: `POST /api/auth/callback/credentials`, `GET /api/auth/session`, `GET /api/auth/csrf`
- Middleware: rate-limit (auth zone), account-lockout
- Tables: `users`, `accounts`, `sessions`, `audit_logs`

---

### UC-03 · Login failure and account lockout

**Persona:** Everyone (defensive).

**Goal:** Authentication fails safely; repeated failures trigger lockout without leaking info.

**Preconditions:**
- Existing user with a known password.

**Main flow (happy path of failure):**
1. User enters wrong password → generic error, no enumeration.
2. Counter increments in rate-limiter or DB.
3. After 10 failures → 429 with "Account temporarily locked. Try again in 30 minutes."
4. Subsequent correct password during lockout → still denied.
5. After window expires → user can try again.

**Success criteria:**
- No info leakage: "wrong password" and "no such user" produce identical response + body.
- Lockout persists across requests (not just in-memory).
- Lockout is per-IP + per-user (both), so one attacker can't lock out a victim's account on purpose.
- Audit log records failed attempts.

**Touches:** same as UC-02 + lockout table/cache.

---

### UC-04 · Logout and session expiry

**Persona:** Everyone.

**Goal:** Session can be explicitly ended and expires automatically.

**Main flow:**
1. User clicks their name in sidebar → dropdown → "Sign out".
2. `POST /api/auth/signout` invalidates session.
3. Session cookie cleared.
4. Redirect to `/login`.
5. Subsequent access to protected route redirects back to login.

**Alternate flows:**
- **Natural expiry** — session cookie expires after 24h; next request triggers re-login.
- **Server-side invalidation** (e.g., admin force-logout) — session token rejected even if cookie still present.

**Touches:** `POST /api/auth/signout`, middleware session check.

---

### UC-07 · Empty-state dashboard for new users

**Persona:** Sam, first time after signup.

**Goal:** User understands they have nothing yet and sees a clear call-to-action.

**Preconditions:** User has zero models in their org.

**Main flow:**
1. User lands on `/dashboard`.
2. Stats cards show 0 for Total Models, Total Threats, Open Threats, Mitigated.
3. Empty-state hero renders with shield icon, welcome text, "Create Your First Threat Model" button (not "Create Your First Project" — that was a label bug, fixed 2026-04-11).
4. Template cards visible below: Web App, API, Mobile.
5. "How It Works" flow shows Create Model → Add components → Identify threats → Add mitigations.

**Success criteria:**
- Zero findings from discovery audit (no console errors, no 4xx/5xx).
- Button label matches behavior (opens threat-model creation dialog, not a project flow).
- "Browse templates" cards lead to templates library.

**Touches:** `GET /api/dashboard/stats`, `EmptyDashboard` component, `/templates` route.

---

### UC-11 · Create new threat model from dashboard

**Persona:** Sam.

**Preconditions:** Logged in with at least one organization.

**Main flow (empty dashboard path):**
1. Click "Create Your First Threat Model" → dialog opens.
2. Fill in model name.
3. Optionally select existing project, or leave blank (standalone).
4. Click "Create Model" → `POST /api/threat-models` with `{ name, projectId? }`.
5. Backend creates `threat_models` row (creating a project if none specified).
6. Redirect to `/models/:id`.
7. Canvas loads blank with palette on left, toolbar on top, properties panel on right.

**Main flow (populated dashboard path):**
1. Click "New Model" button in Recent Models card or Quick Actions.
2. Same dialog opens → same flow.

**Alternate flows:**
- **Duplicate name** — backend rejects with 409 "A model with that name already exists in this organization."
- **Empty name** — form validation blocks submission.
- **Project access denied** — if user selects a project they don't belong to, backend returns 403 (shouldn't be possible via UI).

**Success criteria:**
- `threat_models` row exists with correct name, orgId, version=1, status=DRAFT.
- Canvas renders within 3 seconds.
- Audit log entry for `THREAT_MODEL.CREATE`.

**Touches:** `POST /api/threat-models`, `GET /api/threat-models/:id`, canvas-store slices (`persistence`, `node`, `edge`, `boundary`).

---

### UC-17 · Drag components from palette onto blank canvas

**Persona:** Sam.

**Goal:** Add DFD elements and application components to build a diagram.

**Preconditions:** Blank canvas open (from UC-11).

**Main flow:**
1. User hovers palette on left — sees categories (Boundaries, DFD Elements, Applications, Data & Storage, Networking, Security, Infrastructure, AI/ML, Blockchain, Other, AWS/GCP/Azure).
2. User clicks category chip to filter, or scrolls to find item.
3. User drags, e.g., "Actor" onto canvas.
4. Drop event fires `application/json` with `{ type: 'component', componentType: 'ACTOR' }`.
5. Canvas store's `addComponent` creates new node at drop position.
6. Node appears on canvas with default label "Actor" and visual icon.
7. Node is immediately selectable, draggable, has input/output ports.

**Alt flows:**
- **Drop outside canvas** — no-op, node not created.
- **Drag while offline** — drop still works (local-first), canvas.isDirty=true until save.
- **Drag boundary** — creates a group node with different handling (UC-19).

**Success criteria:**
- 10+ distinct component types can be dragged and drop cleanly.
- Each creates a visually distinct node with correct icon + color.
- Ghost image during drag is readable (not broken cursor).
- Drop position is where the user released the mouse, not offset.

**Touches:** palette components, ThreatModelCanvas `handleDrop`, canvas-store `addComponent`, React Flow drag-and-drop.

---

### UC-18 · Create connections (edges) between components

**Persona:** Sam.

**Main flow:**
1. User hovers a component's output port — handle turns colored.
2. User drags from port to another component's input port.
3. React Flow `onConnect` fires with source/sourceHandle/target/targetHandle.
4. Store's `onConnect` builds a new edge with default data (protocol unknown, encryption false, authentication 'None').
5. Edge appears as a line with arrow, editable by clicking.

**Alt flows:**
- **Self-loop** — allowed or rejected depending on config; document which.
- **Duplicate edge** — should be allowed (two services can have multiple distinct connections).
- **Boundary-to-component drag** — not a connection; ignored.

**Success criteria:**
- Edge persists through save + reload.
- Connection's protocol and encryption can be edited in the right panel.
- Removing either endpoint removes the edge.

**Touches:** canvas-store `onConnect`, `edge-slice`, React Flow `onConnect` callback.

---

### UC-19 · Trust boundaries

**Persona:** Sam.

**Main flow:**
1. User drags "Trust Boundary" from palette.
2. Drop creates a group node sized 400×300 with zIndex -1000 (behind components).
3. User drags existing components into the boundary — `onNodeDrag` detects containment and updates parentage.
4. User can resize the boundary by dragging its edges.
5. User labels the boundary ("Internal Services", "DMZ", "Third Party").

**Alt flows:**
- **Boundary on top of another** — nesting works; innermost wins.
- **Component dragged out** — parent relationship cleared.

**Success criteria:**
- Boundary persists to `boundaries` table with position + dimensions.
- Components with a `parentNode` boundary appear visually inside on reload.
- Trust level of boundary flows to threats (external-to-internal edges are suspect).

**Touches:** `addBoundary`, boundary-slice, ThreatModelCanvas `handleNodeDrag`, `boundaries` table.

---

### UC-20 · Edit component properties

**Persona:** Sam.

**Main flow:**
1. User clicks a component — Properties panel opens on the right.
2. Basic Info section shows Name, Type (read-only), Trust Level dropdown, Description.
3. User changes trust level from Internal to Restricted → `updateNodeData` fires.
4. Engineer Notes field for extra context.
5. Interfaces section lets user add typed API contracts.
6. Styling section adjusts visual properties.
7. Security Profile section (if expanded) shows threats attached to this component.

**Alt flows:**
- **Unsaved dirty state** — `isDirty` becomes true, toolbar Save button pulses.
- **Component deleted** — properties panel clears.

**Success criteria:**
- Properties persist through save + reload.
- Trust level change is immediately reflected in any active AI analysis context.

**Touches:** `updateNodeData`, PropertiesPanel components, canvas store persistence.

---

### UC-21 · Edit connection properties

**Persona:** Sam.

**Main flow:**
1. User clicks an edge — Properties panel shows connection details.
2. User sets protocol (HTTPS, gRPC, MQTT, custom).
3. User toggles "encrypted" — backend adjusts for AI context.
4. User sets authentication (None, API Key, Bearer, mTLS, OAuth).
5. User selects data classifications (PII, payment, PHI, internal, public).
6. Optional: reference a source/target interface if components have them.

**Success criteria:**
- Connection data persists to `connections` table via canvas sync.
- AI threat suggestion uses these fields when analyzing the edge.

**Touches:** edge click handler, right panel, `connections` table, canvas-sync service.

---

### UC-22 · Save canvas and reload

**Persona:** Sam.

**Main flow:**
1. User clicks Save in toolbar (or auto-save fires).
2. `POST /api/threat-models/:id/save-canvas` with `{ nodes, edges, viewport }`.
3. Server persists JSON to `threat_models.canvasState`.
4. Server calls `syncCanvasToDatabase` to mirror nodes → components table + edges → connections table.
5. Audit log entry for canvas save.
6. Toast: "Saved".
7. User reloads page → canvas renders identical state from DB.

**Alt flows:**
- **Save fails** (network, permission, invalid state) — toast error, canvas stays dirty.
- **Concurrent save** (collaboration) — Yjs resolves, most recent wins.
- **Save on navigate away** — beforeUnload prompt if dirty.

**Success criteria:**
- Reload restores all nodes, edges, boundaries, viewport position.
- `components` and `connections` tables are consistent with canvas JSON.

**Touches:** `POST /api/threat-models/:id/save-canvas`, `syncCanvasToDatabase`, `threat_models`, `components`, `connections`, audit log.

---

### UC-26 · Check AI availability

**Persona:** Sam.

**Goal:** Before running expensive AI, verify the provider is reachable.

**Main flow:**
1. User opens the AI tab on the model canvas.
2. Frontend calls `GET /api/threat-models/:id/ai/available`.
3. Backend calls `getAIServiceForModel(modelId)` which reads `organization.aiSettings`.
4. If enabled + provider set + reachable → `{ available: true }`.
5. UI shows methodology selector + "Analyze with STRIDE" button.

**Alt flows:**
- **No provider configured** — `{ available: false, reason: "AI not configured" }`, UI shows "Configure AI in Settings".
- **Provider unreachable** (LM Studio down) — `{ available: false, reason: "Provider not reachable" }`.
- **Org aiSettings vs ai_providers table drift** (known tech debt) — must read from `organization.aiSettings`; `ai_providers` table is not authoritative.

**Success criteria:**
- Round-trip under 5 seconds even if provider is slow.
- AI tab never shows stale "not configured" after a provider is added.

**Touches:** `GET /ai/available`, `getAIServiceForModel`, `organization.aiSettings`.

---

### UC-27 · Run STRIDE threat suggestion

**Persona:** Sam.

**Goal:** Generate specific, non-boilerplate STRIDE threats for a built model.

**Preconditions:** Model has ≥1 component + ≥1 connection; AI available; qwen/qwen3-coder-next (or configured model) running.

**Main flow:**
1. User clicks AI tab, selects STRIDE (default), clicks "Analyze with STRIDE".
2. `POST /api/threat-models/:id/ai/suggest-threats` (sync) or `/ai/micro-analysis?async=true` (async job).
3. Backend builds context from components + connections + boundaries + sequences.
4. Backend calls `aiService.suggestThreats(context)` with THREAT_ANALYSIS_SYSTEM_PROMPT.
5. LLM returns JSON array of threats (8-12) with title, description, category, severity, targetComponentId, attackVector, mitigation, confidence.
6. Frontend renders threat cards with severity badges + category chips.
7. Each card is expandable to show full attack vector + mitigation.

**Alt flows:**
- **LLM timeout** (qwen cold start) — UI shows loading state for up to 120s then error toast.
- **Invalid JSON response** — fallback error, log raw output for debugging.
- **Rate limited** (429) — retry with backoff.
- **AI disabled mid-run** — current run finishes, next button click shows unavailable.

**Success criteria:**
- Returns 8-12 threats covering ≥4 distinct STRIDE categories.
- Every threat has a non-empty targetComponentId referencing a real node.
- No `title: "SQL Injection"`-style boilerplate — threats must reference the actual architecture.
- Total round-trip < 90s for a 5-component system.

**Touches:** `/ai/suggest-threats`, `/ai/micro-analysis`, `aiService.suggestThreats`, `buildThreatModelContext`, threat-prompts.ts, AI provider.

---

### UC-29 · Accept / reject AI-suggested threats

**Persona:** Sam.

**Main flow:**
1. From the populated AI panel, user clicks "+ Add" next to a threat.
2. `POST /api/threat-models/:id/threats` with the threat fields + `source: AI_SUGGESTED`.
3. Threat is created, moves from AI panel to Threats tab.
4. Audit log entry.
5. User can also reject — sets local "rejected" state, threat remembered so it's not re-suggested on next run.

**Success criteria:**
- Accepted threat appears in Threats tab within 1s.
- AI panel updates to remove the accepted item (or marks it "added").
- Subsequent `suggestThreats` runs don't re-propose the exact same threat (dedup).

**Touches:** `POST /threats`, `AISuggestedThreat` type, threats-panel.

---

### UC-36 · Document import — upload SRS/SAD, AI extracts components

**Persona:** Dev, Sam.

**Goal:** User has an architecture document; AI reads it and builds the diagram automatically.

**Preconditions:** AI provider available; a document file (md, pdf, docx) available; user on a threat model page.

**Main flow:**
1. User clicks Import in toolbar → Import dialog opens → Document tab.
2. User selects file(s) — SRS, SAD, SDS.
3. Client uploads to `POST /api/threat-models/:id/import-documents` (multipart).
4. Server stores file, classifies doc type (SRS / SAD / ADR / OpenAPI / IaC).
5. Server calls AI extraction agent with document-type-specific prompt.
6. AI returns JSON with `{ components: [...], connections: [...], requirements: [...] }`.
7. Server runs merge engine against existing canvas state — fuzzy match existing components, classify each as add/update/skip.
8. Frontend shows MergeReviewDialog with per-component add/update/skip choice.
9. User confirms → canvas updates with new nodes + edges.
10. Requirements from doc get stored for later linking in Tour 6.

**Alt flows:**
- **Document too large** — error with size limit.
- **Unsupported format** — error; show supported types.
- **AI extraction fails** (invalid JSON) — fallback to manual import.
- **Merge review has conflicts** — user reviews each decision.
- **Existing components on canvas** — AI is given existing summary in prompt so it doesn't duplicate.

**Success criteria:**
- Post-import canvas has new nodes positioned sensibly (auto-layout).
- New connections show inferred protocols from doc.
- Requirements stored in `requirements` table with docId + reqId.

**Touches:** `POST /import-documents`, extraction-agent, merge engine, MergeReviewDialog.

---

### UC-40 · Code scan via file upload

**Persona:** Dev.

**Main flow:**
1. User opens Gap Analysis panel → clicks Upload button.
2. Selects source files (multi-select: .ts .js .py .go .rb .java .cs .php).
3. Optionally selects a target threat to attach findings to.
4. `POST /api/threat-models/:id/scan-code` with file contents.
5. Backend code-scanner runs pattern matching for hardcoded secrets, SQL injection, SSRF, weak crypto, etc.
6. Findings attached to the threat or model.
7. Each finding becomes a mitigation on the target threat with status PLANNED.

**Success criteria:**
- Secrets and common vulns are found in test fixtures.
- No false-positive spam on clean files.
- Runs in under 10 seconds for 20 files.

**Touches:** `POST /scan-code`, scanner.ts, patterns.ts, mitigation create.

---

### UC-41 · Code scan via GitHub URL

**Persona:** Dev.

**Main flow:**
1. User opens Gap Analysis → Scan button → dialog asking for repo URL.
2. User pastes `https://github.com/org/repo` (or `org/repo`).
3. `POST /api/threat-models/:id/scan-from-github` with URL.
4. Server clones or fetches via GitHub API.
5. Walks file tree, runs same scanner as UC-40.
6. Creates components inferred from folder structure (if diagram is empty).
7. Maps findings to components.

**Alt flows:**
- **Private repo, no token** — error with link to configure GitHub integration.
- **Repo too large** — timeout with fallback to specific paths.
- **Rate limited by GitHub** — retry with backoff, surface clearly.

**Success criteria:**
- Public repos scan successfully within 2 minutes.
- Findings reference file:line in the source.
- Graceful degradation on network failures.

**Touches:** `POST /scan-from-github`, code-scanner, component auto-creation.

---

### UC-42 · Scan findings mapped to components

**Persona:** Dev.

**Main flow:** After UC-40 or UC-41, findings are visible per-component.

**Success criteria:**
- Each finding has: severity, category, description, file path, line number, recommended mitigation.
- Clicking a finding jumps to the affected component on canvas.
- Findings persist across sessions.

---

### UC-44 · Browse template library

**Persona:** Sam.

**Main flow:**
1. User navigates to `/templates` from sidebar.
2. Template library shows curated cards: Web App, Microservices, Mobile, IoT, AWS 3-tier, etc.
3. Each card shows preview image, description, component count, creator.
4. User can filter by category or search.

**Success criteria:**
- At least 6 built-in templates.
- Preview loads without error.
- "Use template" button routes to new-model flow with template ID.

**Touches:** `GET /api/templates`, templates feature.

---

### UC-45 · Create model from template

**Persona:** Sam.

**Main flow:**
1. From /templates, user clicks "Use template" on a card.
2. Dialog asks for new model name.
3. User submits → `POST /api/threat-models` with `templateId`.
4. Backend clones template's nodes + edges + boundaries into new model.
5. Redirect to canvas with pre-populated diagram.

**Success criteria:**
- New model has all template components.
- Template remains unchanged.
- Audit log records creation from template.

---

### UC-48 · Add threat manually

**Persona:** Sam.

**Main flow:**
1. User opens Threats tab.
2. Clicks "Add" → dialog with name, description, STRIDE category (multi), severity, target component.
3. Submit → `POST /api/threat-models/:id/threats` with source: MANUAL.
4. Threat appears in the list.

---

### UC-49 · Browse threat library (curated)

**Persona:** Sam.

**Main flow:**
1. User clicks "Browse Library" (previously mislabeled "Suggest with AI" — fixed 2026-04-11).
2. Dialog shows curated STRIDE templates filtered by applicable component types.
3. User selects one → threat added to model.

---

### UC-55 · Add mitigation to a threat

**Persona:** Sam.

**Main flow:**
1. Expand a threat card.
2. Click "+ Mitigation" → dialog with description, priority, strategy (preventive / detective / corrective / compensating), notes.
3. Submit → `POST /api/threat-models/:id/threats/:threatId/mitigations`.
4. Mitigation appears under the threat.

---

### UC-56 · Mitigation with evidence links and requirement traceability

**Persona:** Sam, Carla.

**Main flow:**
1. User edits an existing mitigation.
2. Adds control category (IAM, ENCRYPTION, ACCESS_CONTROL, etc.).
3. Sets test criteria ("Confirm that all requests to /api/payment require mTLS") and test result.
4. Adds evidence links (type: ticket / document / screenshot / test_report, URL, title).
5. Links to compliance requirements from the imported framework.
6. Submits.

**Success criteria:**
- Evidence links stored in `mitigation.evidenceLinks` JSON.
- Requirement IDs stored in `mitigation_requirements` join table.
- UI surfaces the linked requirements in the mitigation card.

---

### UC-58 · Link mitigation to compliance requirement

**Persona:** Carla.

**Main flow:**
1. From a mitigation's edit dialog, user opens the Requirement picker.
2. Picker shows requirements from imported frameworks + from imported SRS/SAD documents.
3. User selects one or more.
4. Submit → creates `mitigation_requirements` rows.
5. Gap analysis dashboard updates to reflect new coverage.

---

### UC-61 · Framework import

**Persona:** Carla.

**Main flow:**
1. User opens Requirements panel → "Import Framework".
2. Dialog shows 12 built-in frameworks (NIST 800-53, PCI-DSS 4.0, HIPAA, SOC 2, ISO 27001, NIST CSF, OWASP ASVS, CMMC, NIST 800-171, ISO 27701, CCPA, FDA).
3. User selects one → `POST /api/threat-models/:id/requirements/import-framework`.
4. Backend loads framework's controls into `requirements` table for this model.
5. Dashboard updates with coverage bar.

---

### UC-63 · Gap analysis

**Persona:** Carla.

**Main flow:**
1. User opens Gap Analysis panel.
2. `GET /api/threat-models/:id/gap-analysis` returns uncovered threats + uncovered requirements.
3. UI shows two columns: threats without mitigations, requirements without linked mitigations.
4. Filters: by severity, by framework, by control category.
5. Click a gap to jump to the affected threat or requirement.

**Important correctness fix (2026-04-11):** Gap analysis excludes `category: CODE_SCAN` threats from counts so auto-generated scanner findings don't inflate coverage.

---

### UC-64 · Requirements coverage dashboard

**Persona:** Carla.

**Main flow:**
1. User opens Coverage panel from the right-panel tabs.
2. `GET /api/threat-models/:id/requirements-coverage` returns per-requirement status.
3. UI shows list with Covered / Uncovered icons, percentage bar, filter tabs (All / Uncovered).
4. Expanding a requirement shows linked mitigations + control categories.

---

### UC-67 · Risk dashboard (org-wide)

**Persona:** Vera.

**Main flow:**
1. User navigates to `/analytics/risk` from sidebar.
2. Dashboard shows heat map, top risks, trend chart, severity distribution.
3. User can filter by project or time range.

**Success criteria:**
- Aggregates data from all models in the org.
- Loads in under 5 seconds.
- Updates as threats/mitigations change.

---

### UC-72 · Export PDF report

**Persona:** Sam, Vera.

**Main flow:**
1. User clicks Export in toolbar → PDF.
2. `GET /api/threat-models/:id/export/pdf` streams PDF.
3. Report includes: cover page, diagram, threats table, mitigations, compliance coverage, appendix.
4. Browser downloads the file.

**Success criteria:**
- PDF opens in standard viewer without errors.
- Diagram image is legible.
- Tables render correctly with real data.
- < 10 seconds for a typical model.

---

### UC-76 · Risk register CSV (GRC format)

**Persona:** Carla.

**Main flow:**
1. User clicks Export → Risk Register CSV.
2. File downloads with columns: Risk ID, Description, Category, Severity, Likelihood, Impact, Status, Owner, Mitigation, Target Date, Evidence.
3. Compatible with common GRC tools.

---

### UC-78 · Invite user to organization

**Persona:** Adam.

**Main flow:**
1. Admin opens Admin Console → Users → Invite.
2. Enters email + role (MEMBER / ADMIN / OWNER).
3. Submit → `POST /api/organizations/:orgId/invitations`.
4. Invitation email sent (or link shown inline for copy).
5. New user clicks link → signup flow → auto-joined to org.

---

### UC-81 · Configure AI provider

**Persona:** Adam.

**Main flow:**
1. Admin → Settings → AI → Add provider.
2. Select type (Claude / OpenAI / Ollama / LM Studio / Gemini / Vertex).
3. Enter API key (encrypted on save) or base URL (for local).
4. Select model.
5. Click "Test connection" → UC-82.
6. On success, provider saved as default (if first) or additional.
7. **Must update both `organization.aiSettings` JSON and `ai_providers` table** until dual-source tech debt is resolved.

---

### UC-82 · Test AI provider connection

**Persona:** Adam.

**Main flow:**
1. From the AI settings screen, click "Test" on a provider.
2. `POST /api/ai/providers/:id/test` sends a minimal prompt.
3. Response: latency, model name echoed, usage.
4. UI shows green check or red error.

**Success criteria:**
- Completes in < 30s even for slow cold-start models.
- Error messages are specific ("connection refused", "auth failed", "model not found").

---

## P1 Use Cases

_Listed here, detailed in individual spec files when we write them. Each follows the same template as P0s above._

UC-05, 06, 09, 12, 13, 14, 23, 28, 30, 31, 38, 39, 43, 46, 50, 51, 52, 53, 54, 57, 59, 62, 65, 66, 68, 69, 70, 71, 73, 75, 77, 79, 80, 87, 88, 91, 94.

## P2 / P3 Use Cases

_Same principle. Document later, test after P0/P1 are green._

UC-15, 16, 24, 25, 32, 33, 34, 35, 47, 60, 74, 83, 84, 85, 86, 89, 90, 92, 93, 95.

---

## Cross-cutting concerns

These apply to every use case and should be validated as part of every E2E test:

- **No console errors** from the pages we exercise.
- **No 4xx/5xx** network responses for endpoints the UC touches.
- **Loading states** visible during async operations.
- **Error states** shown (not silent failures) when something goes wrong.
- **Keyboard accessible** — tab order works, Enter submits, Escape closes dialogs.
- **Screen reader** labels present on icon buttons and form controls.
- **Responsive** — renders correctly at 1440×900 (demo) and 1024×768 (smaller laptop).
- **Audit log entry** written for any state-changing operation (create/update/delete).

---

## Maintenance

- **When a new feature ships**, add a use case here BEFORE writing code.
- **When a use case's behavior changes**, update this doc in the same PR as the code change.
- **When an E2E test fails**, update the use case's success criteria if the intended behavior has evolved.
- **When demoing**, use P0 list as the checklist for pre-demo verification.

---

## SDLC Coverage Mapping

_Added by SDLC Mode 2 Quick Onboard (2026-05-24). Maps from VNV matrix user story IDs to use case IDs in this catalog._

| User Story | Title | Use Case IDs | Coverage |
|-----------|-------|-------------|---------|
| US-1.1 | User Registration | UC-01 | P0 |
| US-1.2 | User Login | UC-02, UC-03, UC-04 | P0 |
| US-1.3 | Password Recovery | UC-05 | P1 |
| US-2.1 | View Dashboard | UC-07, UC-08 | P0 |
| US-3.1 | View Canvas | UC-11 | P0 |
| US-3.2–3.5 | Canvas Operations | UC-17–25 | P0/P1 |
| US-4.1 | Add Threats | UC-48 | P0 |
| US-4.4 | Add Mitigations | UC-55, UC-56 | P0 |
| US-5.1 | AI Threat Suggestions | UC-27, UC-28, UC-29 | P0/P1 |
| US-8.1 | Export to PDF | UC-72 | P0 |
| US-11.1 | Admin Dashboard | UC-67 | P0 |
| US-11.2 | User Management | UC-78–80 | P0/P1 |
| US-13.2 | Threat Templates | UC-44, UC-45 | P0 |
| US-15.1 | Import Documents | UC-36, UC-37 | P0 |
| US-16.1 | Scan GitHub Repository | UC-41 | P0 |

**Total use cases:** 95 (30 P0 · 34 P1 · 31 P2/P3)  
**Automated E2E coverage:** ~40% of P0+P1 use cases  
**Priority gaps:** UC-17–21 (canvas operations), UC-78–80 (org management), UC-15 (version history)

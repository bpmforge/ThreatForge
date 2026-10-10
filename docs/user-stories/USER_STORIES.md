# User Stories — ThreatForge

**Version:** 4.3
**Last Updated:** 2026-05-05
**Source of Truth:** Implemented features in `frontend/src/` and `server/src/`

This document describes user stories organized by persona and feature area. Stories marked `[x]` are implemented; `[~]` are in progress; `[ ]` are planned.

---

## Table of Contents

1. [Personas](#personas)
2. [Epic 1: Authentication & Onboarding](#epic-1-authentication--onboarding)
3. [Epic 2: Dashboard & Navigation](#epic-2-dashboard--navigation)
4. [Epic 3: Threat Model Canvas](#epic-3-threat-model-canvas)
5. [Epic 4: Threats & Mitigations](#epic-4-threats--mitigations)
6. [Epic 5: AI-Powered Features](#epic-5-ai-powered-features)
7. [Epic 6: Multi-Diagram Support](#epic-6-multi-diagram-support)
8. [Epic 7: Collaboration](#epic-7-collaboration)
9. [Epic 8: Export & Reporting](#epic-8-export--reporting)
10. [Epic 9: Organization & Team Management](#epic-9-organization--team-management)
11. [Epic 10: User Profile & Security](#epic-10-user-profile--security)
12. [Epic 11: System Administration](#epic-11-system-administration)
13. [Epic 12: Integrations & Ecosystem](#epic-12-integrations--ecosystem)
14. [Epic 13: Junior Engineer Support](#epic-13-junior-engineer-support)
15. [Epic 14: Expert Productivity](#epic-14-expert-productivity)
16. [Epic 15: Document Lifecycle](#epic-15-document-lifecycle)
17. [Epic 16: Code Security Analysis](#epic-16-code-security-analysis)
18. [Epic 17: Requirements & Traceability](#epic-17-requirements--traceability)
19. [Epic 18: Risk Intelligence](#epic-18-risk-intelligence)
20. [Epic 19: AI Personalization & Pipelines](#epic-19-ai-personalization--pipelines)
21. [Epic 20: Platform Extensibility](#epic-20-platform-extensibility)
22. [Epic 21: Version History & Change Tracking](#epic-21-version-history--change-tracking)
23. [Epic 22: Connection Intelligence & Security Semantics](#epic-22-connection-intelligence--security-semantics)

---

## Personas

| Persona | Description | Experience | Primary Goals |
|---------|-------------|------------|---------------|
| **James** | Junior Developer | New to threat modeling | Learn STRIDE, create first model |
| **Sarah** | Security Architect | Expert | Efficient modeling, team collaboration |
| **Carlos** | Compliance Officer | Intermediate | Reports, audit trails, compliance |
| **Paula** | Product Manager | Limited security | Risk communication, stakeholder reports |
| **Derek** | DevOps Engineer | Infrastructure expert | CI/CD integration, IaC scanning |
| **Admin** | System Administrator | Technical | Platform management, user admin |
| **Guest** | External Reviewer | Varies | View/comment on shared models |

---

## Epic 1: Authentication & Onboarding

**Location:** `app/(auth)/`, `features/guided-wizard/`

### US-1.1: User Registration

**As a** new user
**I want to** create an account
**So that** I can start using the threat modeling tool

**Implemented Features:**
- [x] Register with email and password
- [x] Register via OAuth (Google, GitHub)
- [x] Password strength validation (configurable policy)
- [x] Email verification (optional, admin-configurable)
- [x] Personal organization auto-created on signup
- [x] Experience level selection (New/Some/Expert)

**UI Location:** `/register`

---

### US-1.2: User Login

**As a** returning user
**I want to** log into my account
**So that** I can access my threat models

**Implemented Features:**
- [x] Login with email/password
- [x] Login via OAuth providers (Google, GitHub, Microsoft)
- [x] Login via SSO (SAML, OIDC) for enterprise
- [x] Two-factor authentication (TOTP)
- [x] "Remember me" functionality
- [x] Account lockout after failed attempts
- [x] Password reset via email

**UI Location:** `/login`

---

### US-1.3: Password Recovery

**As a** user who forgot my password
**I want to** reset my password via email
**So that** I can regain access to my account

**Implemented Features:**
- [x] Request password reset email
- [x] Time-limited reset tokens
- [x] Password policy enforcement on reset
- [x] Confirmation of successful reset

**UI Location:** `/forgot-password`, `/reset-password`

---

### US-1.4: Guided Onboarding

**As a** new user
**I want to** learn how to use the tool
**So that** I can create effective threat models

**Implemented Features:**
- [x] Experience level selection (New/Some/Expert)
- [x] Interactive guided wizard for beginners
- [x] STRIDE methodology introduction
- [x] Step-by-step first model creation
- [x] Template-based quick start
- [x] Skip option for experienced users

**UI Location:** `features/guided-wizard/`

---

## Epic 2: Dashboard & Navigation

**Location:** `app/(app)/dashboard/`, `features/dashboard/`

### US-2.1: View Dashboard

**As a** user
**I want to** see an overview of my work
**So that** I can quickly understand my threat modeling status

**Implemented Features:**
- [x] Recent threat models list
- [x] Threat statistics (by severity, STRIDE category)
- [x] Risk score widget
- [x] Projects at risk indicators
- [x] Quick actions (new model, recent models)
- [x] Activity feed
- [x] Portfolio risk heatmap
- [x] Program health panel
- [x] Top unmitigated threats
- [x] Trend chart

**UI Location:** `/dashboard`

---

### US-2.2: Global Search

**As a** user
**I want to** search across all my content
**So that** I can quickly find specific models, threats, or components

**Implemented Features:**
- [x] Command palette (Cmd/Ctrl+K)
- [x] Search models by name
- [x] Search threats by title/description
- [x] Search components
- [x] Filter by organization/project
- [x] Recent searches

**UI Location:** `features/search/`, Command Palette

---

### US-2.3: Navigate Application

**As a** user
**I want to** easily navigate between different areas
**So that** I can efficiently work across projects

**Implemented Features:**
- [x] Collapsible sidebar navigation
- [x] Breadcrumb navigation
- [x] Organization switcher
- [x] Project quick access
- [x] Keyboard shortcuts for navigation
- [x] Mobile-responsive navigation

**UI Location:** `components/layout/AppSidebar`

---

## Epic 3: Threat Model Canvas

**Location:** `app/models/[id]/`, `features/canvas/`, `components/canvas/`

### US-3.1: View Canvas

**As a** user
**I want to** see a visual canvas for my threat model
**So that** I can understand the system architecture

**Implemented Features:**
- [x] Full-screen canvas editor
- [x] Pan and zoom (mouse wheel, pinch)
- [x] Grid background for alignment
- [x] Mini-map for large diagrams
- [x] Fit-to-view button
- [x] Dark/light canvas themes

**UI Location:** `/models/[id]`

---

### US-3.2: Add Components

**As a** user
**I want to** add system components to the canvas
**So that** I can model my architecture

**Implemented Features:**
- [x] Component palette (left panel)
- [x] Drag-and-drop from palette
- [x] Right-click context menu to add
- [x] Component types: Actors, Processing, Storage, Network
- [x] Cloud service components (AWS, Azure, GCP)
- [x] Custom component icons
- [x] Component templates

**UI Location:** `components/panels/ComponentPalette`

---

### US-3.3: Configure Components

**As a** user
**I want to** configure component properties
**So that** I can document what each component represents

**Implemented Features:**
- [x] Properties panel (right side)
- [x] Name and description fields
- [x] Technology/stack tags
- [x] Trust level (internal/external/boundary)
- [x] Data classification
- [x] Custom properties (key-value)
- [x] Auto-save on changes

**UI Location:** `components/panels/PropertiesPanel`

---

### US-3.4: Connect Components

**As a** user
**I want to** draw connections between components
**So that** I can show data flows and communicate security semantics

**Implemented Features:**
- [x] Drag handles to create edges
- [x] User-editable text label (double-click to edit inline, drag to reposition)
- [x] Protocol specification: HTTP, HTTPS, gRPC, WebSocket, TCP, UDP, AMQP, MQTT, Kafka, PostgreSQL, MySQL, MongoDB, Redis, SSH, SFTP, Custom
- [x] Authentication type: None, API_KEY, JWT, OAuth2, mTLS, Basic, SAML, Custom
- [x] Encryption indicator (encrypted/unencrypted flag)
- [x] Data flow direction (source → target, target → source, bidirectional)
- [x] A* orthogonal edge routing with line jumps at crossings
- [x] **Protocol pill** auto-rendered from protocol field (always visible in overlay mode; hover/select only in default mode)
- [x] **Auth pill** auto-rendered from authentication field with color-coded security level: None=red, Basic=orange, API_KEY=yellow, JWT=blue, OAuth2/mTLS=green, SAML=purple
- [x] **"No Auth" warning**: auth=None + connection crosses trust boundary → red edge stroke
- [x] **Missing-field hint**: selected edge with no protocol or auth set shows "set protocol →" badge in red
- [x] **Security overlay mode**: toggle (Lucid-Lines toolbar) shows all pills across all edges simultaneously regardless of hover/select state
- [x] **Security level badge** on hover tooltip: high/medium/low/critical computed from protocol + auth + encryption combination
- [x] **Pill handles** at quarter-marks on longer edges (LL2)
- [x] **Arrowhead picker**: none/open/closed/diamond/circle per end (LL4)
- [x] **Stroke pattern**: solid/dashed/dotted (LL4)
- [x] Right-click edge context menu (LL2): edit label, set protocol, set auth, delete, add waypoint

**UI Location:** Canvas edge handles, `components/canvas/edges/SecurityEdge.tsx`, `components/canvas/edges/EdgeLabel.tsx`

---

### US-3.7: Connection Authorization & Data Classification

**As a** security architect
**I want to** document what authorization model a connection enforces and what data flows through it
**So that** my threat model captures the full A&A (Authentication & Authorization) posture and data exposure for each flow

**Implemented Features:**
- [x] Authentication method per connection (set via edge properties panel)
- [ ] **Authorization model** per connection: None, RBAC, ACL, Scope-based (OAuth), Attribute-based (ABAC), Custom — distinct from authentication
- [ ] **Data classifications** on connections: select one or more of PII, PHI, Financial, Credentials, Internal, Public — describes what data traverses the flow
- [ ] **Port number** field on connection (e.g., 443, 5432, 8080)
- [ ] **A&A label auto-generation**: when both protocol and authorization model are set, the text label auto-populates as "HTTPS · mTLS · RBAC" (user can override)
- [ ] Connection security score: composite score (0–100) derived from protocol + auth method + authorization model + encryption + whether it crosses trust boundaries
- [ ] AI threat generation uses data classifications to generate targeted threats (PII on unencrypted connection → automatic Information Disclosure threat suggestion)

**Acceptance Criteria:**
- Given a connection with protocol=HTTPS, auth=mTLS, authorization=RBAC → label auto-populates "HTTPS · mTLS · RBAC" on first save if label is blank
- Given a connection carrying PII data with auth=None → AI threat suggestions include at least one Information Disclosure threat referencing PII exposure
- Authorization model "None" on a connection crossing a trust boundary → orange warning badge (less severe than auth=None which is red)

**UI Location:** Edge properties panel (right sidebar when edge selected)

---

### US-3.8: Security Overlay Mode

**As a** security architect
**I want to** toggle a security overlay on the canvas
**So that** I can see the authentication, authorization, and encryption posture of every connection simultaneously without selecting each one

**Implemented Features:**
- [x] Security overlay toggle button in canvas toolbar
- [x] When overlay ON: all protocol + auth pills visible on all edges simultaneously
- [x] auth=None + boundary-crossing → red edge stroke (always, not just in overlay mode)
- [x] Security overlay state persists in canvas store (survives page reload)
- [ ] **Overlay legend**: small legend panel showing pill color meanings (None=red, Basic=orange, API_KEY=yellow, JWT=blue, OAuth2/mTLS=green)
- [ ] **Aggregate security score** displayed in toolbar when overlay is ON: percentage of connections that have both protocol and authentication set
- [ ] **Filter mode**: when overlay is ON, show only connections with a specific security level (e.g., "show only insecure connections")
- [ ] Export: PDF export with overlay ON captures the security view as a separate diagram page

**Acceptance Criteria:**
- User toggles overlay ON → every edge shows its protocol and auth pill without hover or selection
- A model with 10 connections, 3 having auth=None → overlay shows 3 red-stroke edges and toolbar shows "70% secured" score
- User exports to PDF with overlay ON → a "Security Posture View" diagram is included as an additional page

**UI Location:** Canvas toolbar, `features/canvas/`, `components/canvas/edges/`

---

### US-3.5: Create Trust Boundaries

**As a** user
**I want to** group components in trust boundaries
**So that** I can identify security zones

**Implemented Features:**
- [x] Boundary tool in palette
- [x] Drag to create boundary region
- [x] Resize boundaries
- [x] Nest components inside boundaries
- [x] Boundary labels and colors
- [x] Multiple boundary levels
- [x] Color-coded zones (PUBLIC/INTERNAL/CONFIDENTIAL/RESTRICTED)

**UI Location:** Palette boundary tool

---

### US-3.6: Canvas Operations

**As a** user
**I want to** manipulate canvas elements with a full suite of diagramming tools
**So that** I can organize and style my diagram efficiently

**Implemented Features:**
- [x] Select single element (click)
- [x] Multi-select (rubber band or Shift+click)
- [x] Move elements (drag)
- [x] Copy/paste elements (Ctrl+C/V)
- [x] Delete elements (Delete / Backspace)
- [x] Undo/redo (Ctrl+Z / Ctrl+Y)
- [x] Snap to grid (16×16px, toggleable with G)
- [x] Align and distribute (6 align + 2 distribute directions via floating action bar)
- [x] Match size (width / height / both) to reference node — Lucidchart-style
- [x] **Lock / unlock nodes** — locked nodes are unmovable and uneditable; lock badge shown on node; arrow nudge skips locked nodes
- [x] **Format painter** — select source node, activate painter, click target to copy all style properties (fill, border, text color, size)
- [x] **Arrow key nudge** — nudge selected node(s) by 1px (hold Shift for 10px) using keyboard arrow keys
- [x] **Alt+drag duplicate** — hold Alt while dragging a node → original stays in place, a copy follows the cursor
- [x] **Select inverse** (Ctrl+Shift+A) — invert current selection (all non-selected become selected)
- [x] **Select same type** — right-click a node → "Select all [type]" selects every node of that component type on the canvas
- [x] Fit view to all nodes (Ctrl+0); Fit selected elements (Ctrl+Shift+F)
- [x] **Zoom percentage indicator** — bottom-center of canvas shows current zoom %; click to reset to 100%
- [x] **Smart alignment guides** — appear during drag when a node aligns horizontally or vertically with another; snap triggers automatically
- [x] **Sibling overlap prevention** — when dropping a node inside a boundary, auto-offsets if it would overlap an existing sibling
- [x] **Node status chip** — component nodes display a draft/in-review/approved/deprecated badge; set in Properties panel
- [x] **Coverage indicator** — component nodes show a threat count badge; badge turns red when HIGH/CRITICAL threats are unmitigated
- [x] Keyboard shortcuts help dialog (press ?)
- [x] Bulk floating action bar: delete, duplicate, align, lock, change status on multi-selected elements

**UI Location:** `features/bulk-operations/`, `components/canvas/`

---

### US-3.9: Quick Canvas Interaction

**As a** user
**I want to** quickly add and connect components without returning to the palette
**So that** my flow stays uninterrupted while I build the diagram

**Implemented Features:**
- [x] **Quick Connect Overlay** — hover a selected component node → N/E/S/W directional arrows appear; click an arrow to spawn a same-type node in that direction, pre-connected
- [x] **Quick Add Shape Picker** — drag an edge onto empty canvas and release → picker appears showing the top-5 most-used component types + "More…" button; selecting a type creates the node and the connecting edge atomically
- [x] **Legend Node** — special node type available in palette for adding colour-coded legends to diagrams; not treated as a component for threat analysis purposes
- [x] **Canvas Empty State** — when the canvas has no nodes, a hint panel guides the user to drag from the palette or describe their system
- [x] **Boundary Drop Zone** — visual highlight when dragging a component near an existing boundary indicates it will be nested
- [x] **Nesting Indicator** — when a node is nested inside a boundary, a small depth indicator shows its nesting level

**UI Location:** `components/canvas/QuickConnectOverlay.tsx`, `components/canvas/QuickAddShapePicker.tsx`, `components/canvas/LegendNode.tsx`, `components/canvas/CanvasEmptyState.tsx`

---

### US-3.10: Edge Waypoints & Label Positioning

**As a** user
**I want to** precisely control the path and label position of connections
**So that** complex diagrams remain readable

**Implemented Features:**
- [x] **Waypoint drag** — drag any segment of an edge to add a waypoint; edge routes through the waypoint
- [x] **Add waypoint** — Alt/Opt+click on any edge segment adds a waypoint at that position
- [x] **Remove waypoint** — double-click a waypoint removes it; edge re-routes
- [x] **Shift=45° constraint when drawing** — hold Shift while dragging a new edge → endpoint snaps to 45° angle increments (horizontal, vertical, diagonal)
- [x] **Endpoint reconnect** — drag either end of an existing edge to reconnect it to a different node handle
- [x] **Label drag along path** (LL3) — grab the edge label and drag it to any position along the edge path; it stays path-relative (not absolute coordinates)
- [x] **Label offset** (LL3) — label can be nudged above or below the path (three states: on-path / above / below) to avoid overlapping arrows
- [x] **Label collision dodge** (LL3) — when two edge labels would overlap, the layout engine nudges them apart automatically
- [x] **Pill handles** (LL2) — protocol/auth pills are also interactive draggable handles at the quarter-mark positions on longer edges

**UI Location:** `components/canvas/edges/WaypointHandles.tsx`, `components/canvas/edges/EdgeLabel.tsx`, `hooks/useEdgeReconnect.ts`, `hooks/useShiftSnap.ts`

---

### US-3.11: Rich Text & Shape Styling

**As a** user
**I want to** format text inside shapes and apply detailed visual styling
**So that** my diagrams communicate clearly and match my organisation's visual language

**Implemented Features:**
- [x] Fill color per node (`customStyle.backgroundColor`)
- [x] Border color per node (`customStyle.borderColor`)
- [x] Border thickness (`strokeWidth`)
- [x] Text color (`customStyle.textColor`)
- [x] Font size (4-preset picker: xs / sm / base / lg)
- [ ] **Rich text inside shapes** (L1): bold, italic, underline, strikethrough, font family, arbitrary font size, horizontal/vertical alignment, bulleted/numbered lists, hyperlinks within text — replace plain input with lightweight editor (tiptap or Lexical)
- [ ] **Shape rotation** (L1): drag rotation handle above selected node; Shift snaps to 15° increments; value persists through save/reload
- [ ] **Border style on nodes** (L5): solid / dashed / dotted border independent of edge style
- [ ] **Drop shadow** (L5): configurable shadow offset and blur
- [ ] **Gradient fill** (L5): two-stop linear gradient; direction picker

**Acceptance Criteria (planned):**
- Double-click a node label → rich-text editor with Ctrl+B/I/U working; formatting persists on save
- Drag rotation handle → node rotates; Ctrl+Z reverts; label remains readable at any rotation

**UI Location:** `components/canvas/ComponentNode.tsx`, Properties panel

---

### US-3.12: Swimlanes & Multi-Page Diagrams

**As a** user
**I want to** organise my diagram into swimlanes and separate pages
**So that** I can model processes across actors (swimlanes) and separate diagram types (pages) without cluttering a single canvas

**Implemented Features:**
- [x] Multi-diagram tabs (DFD / Sequence Diagram as separate canvas tabs — `stores/diagram-store.ts`)
- [ ] **Horizontal swimlanes** (L2): new `swimlane` node type; header row with actor label; `+`/`-` buttons to add/remove lanes; drag-to-resize lanes; H↔V orientation toggle; shapes placed in a lane magnetize to it (move with lane)
- [ ] **Cross-functional flowchart template** (L2): swimlane starter template with 3 lanes and sample actors
- [ ] **Multi-page per threat model** (L2): tab strip at bottom of canvas; Add/rename/reorder/delete pages; each page is a separate canvas state stored under the same threat model; switching pages preserves per-page viewport and selection

**Acceptance Criteria (planned):**
- Drag "Swimlane" from palette → 3-lane container; click `+` → 4th lane appears; drag component into lane → component moves with lane
- Canvas bottom tab strip: "+" adds page; double-click tab name to rename; drag to reorder

**UI Location:** Palette, `components/canvas/`, schema: `ThreatModel.pages` (new field)

---

### US-3.13: Layers & Grouping

**As an** expert user
**I want to** manage visibility and organisation of diagram elements via layers and arbitrary groups
**So that** I can work with complex diagrams without visual clutter

**Implemented Features:**
- [x] Trust boundaries (semantic grouping with security meaning)
- [x] Z-order control (bring to front / send to back / forward / backward) via `layer-slice.ts`
- [ ] **Layers panel** (L3): user-created named layers; eye icon to show/hide; lock icon to lock all shapes in layer; assign selected shapes to layer; drag to reorder layers
- [ ] **True generic grouping** (L3): Ctrl+G on arbitrary selection → group node with no security semantics; double-click to enter group, Esc to exit; Ctrl+Shift+G to ungroup
- [ ] **Rulers** (L3): pixel rulers at top and left canvas edges; drag from ruler to create custom snap guides
- [ ] **Find in diagram** (L1): Ctrl+F → overlay search input; matches node labels, edge labels, notes, comments; highlights matches; Enter navigates to next match; Esc closes

**Acceptance Criteria (planned):**
- Ctrl+G on 3 selected nodes → group node created; moving the group moves all children; double-click enters group for individual editing
- Ctrl+F "payment" → all nodes/edges with "payment" in their label are highlighted; status bar shows "3 of 7 results"

**UI Location:** Canvas toolbar, right rail panel

---

### US-3.14: Presentation Mode & Shape Annotations

**As a** security architect
**I want to** present my threat model and annotate shapes with comments and notes
**So that** I can use the canvas as a live presentation surface and capture review feedback directly on shapes

**Implemented Features:**
- [x] Real-time collaboration cursors (existing)
- [x] Review workflow with comment threads on threats (existing, `features/review/`)
- [ ] **Presentation mode** (L4): full-screen canvas; hide all chrome (sidebar, panels, toolbar); arrow keys navigate between canvas pages; Esc exits; optional auto-advance timer
- [ ] **Shape-anchored comments** (L4): right-click a node → "Add comment"; thread is attached to the node; badge count on node; comments panel lists all open threads; resolve/reopen; integrates with real-time collaboration
- [ ] **Shape hyperlinks** (L4): URL field in Properties panel; link icon renders on shape; clicking opens URL in new tab
- [ ] **Shape notes** (L4): private plain-text note field per shape (not visible to collaborators by default); note icon appears if note is present; visible in Properties panel

**Acceptance Criteria (planned):**
- Press Presentation Mode → chrome hides; right arrow key advances page; Esc returns to edit mode
- Right-click node → "Add comment" → comment thread appears; badge count increments; in review panel, comment is listed with node reference

**UI Location:** Canvas toolbar; Properties panel; collaboration layer

---

### US-3.15: Visual Richness & Auto-Layout

**As a** user
**I want to** enhance diagrams visually and automatically arrange imported or AI-generated models
**So that** my diagrams look professional and AI-imported models are immediately readable

**Implemented Features:**
- [x] Auto-layout applied after document import (existing, AI-extraction places nodes in a layout)
- [ ] **Image/icon upload** (L5): drag any PNG/SVG onto the canvas → creates an image node; also uploadable from the Properties panel "Custom Icon" field; stored in org media library
- [ ] **Custom shape library** (L5): org admin uploads SVG shapes that appear in a "Custom" palette section; shapes are threat-model-aware (can host threats)
- [ ] **One-click auto-layout** (L5): button in canvas toolbar; applies dagre/elk.js force-directed layout to all nodes; preserves boundary containment; undo-able

**Acceptance Criteria (planned):**
- Drag a PNG logo onto the canvas → image node created at drop position; resize handles work
- Click "Auto-layout" on a 20-node AI-generated model → nodes rearrange without overlaps; Ctrl+Z reverts

**UI Location:** Canvas toolbar; Properties panel

---

## Epic 4: Threats & Mitigations

**Location:** `features/threats/`, `features/threat-library/`, `features/threat-checklist/`

### US-4.1: Add Threats

**As a** user
**I want to** add threats to components or connections
**So that** I can document security risks with full context

**Implemented Features:**
- [x] Add threat via right-click menu on component or connection
- [x] Add threat via toolbar button
- [x] Methodology selection: STRIDE, PASTA, Kill Chain, MITRE ATT&CK
- [x] Severity: CRITICAL / HIGH / MEDIUM / LOW
- [x] Link to component or connection
- [x] Threat description and impact
- [x] Attack vector details
- [x] CWE and OWASP references
- [x] Human-in-the-loop review status (AI_SUGGESTED → ACCEPTED/REJECTED/MODIFIED)
- [x] **CIA impact flags** per threat: Confidentiality / Integrity / Availability — tracked via CIA Triad risk scoring panel (see US-4.6)
- [x] **CVSS base score** attached to threat — CVSS 3.1 and 4.0 calculators with full metric entry (see US-4.7)
- [x] **STRIDE-to-CIA mapping hint**: selecting a STRIDE category shows expected CIA impact (see US-4.6)

**UI Location:** `features/threats/components/AddThreatDialog`

---

### US-4.2: Use Threat Library

**As a** user
**I want to** select threats from a library
**So that** I can apply common threats quickly

**Implemented Features:**
- [x] Built-in threat libraries (STRIDE, PASTA, Kill Chain, MITRE ATT&CK)
- [x] OWASP Top 10 threats
- [x] CWE database integration
- [x] Filter by methodology category
- [x] Search threats
- [x] Apply to selected component
- [x] Custom threat templates
- [x] Threat catalog with external indexes and cloud-specific threats

**UI Location:** `features/threat-library/`, `features/threat-catalog/`

---

### US-4.3: Threat Checklist

**As a** user
**I want to** review threats by category
**So that** I can ensure comprehensive coverage

**Implemented Features:**
- [x] Category tabs (STRIDE, PASTA, Kill Chain, MITRE ATT&CK)
- [x] Checklist per category
- [x] Progress tracking
- [x] Mark items as reviewed
- [x] Link to relevant threats
- [x] Completeness score

**UI Location:** `features/threat-checklist/`

---

### US-4.4: Add Mitigations

**As a** user
**I want to** add mitigations for threats
**So that** I can document how risks are addressed

**Implemented Features:**
- [x] Add mitigation to threat
- [x] Implementation status: NOT_IMPLEMENTED / IMPLEMENTED
- [x] Verified flag (independently confirm implementation)
- [x] Obligation level: REQUIRED / RECOMMENDED
- [x] Control category: IAM, ENCRYPTION, ACCESS_CONTROL, NETWORK, LOGGING, INPUT_VALIDATION, SECRETS, BACKUP, MONITORING, SUPPLY_CHAIN
- [x] Priority (LOW/MEDIUM/HIGH/CRITICAL)
- [x] Effectiveness score (0–85%, diminishing returns model)
- [x] Implementation notes
- [x] Test criteria ("Confirm that [condition]") with test result (PASS/FAIL/PARTIAL)
- [x] Evidence links (ticket, document, screenshot, test report, scan result, manual)
- [x] Move mitigation between threats

**UI Location:** `features/threats/components/EditMitigationDialog`

---

### US-4.5: View Threats Panel

**As a** user
**I want to** see all threats in one place
**So that** I can manage them effectively

**Implemented Features:**
- [x] Threats panel (sidebar)
- [x] Filter by STRIDE category
- [x] Filter by severity
- [x] Filter by status
- [x] Sort options
- [x] Click to highlight component
- [x] Inline editing
- [x] Remediation tracker
- [x] Next action suggestions

**UI Location:** `features/threats/components/ThreatsPanel`

---

### US-4.6: CIA Impact Assessment

**As a** security architect
**I want to** record which CIA triad pillars each threat impacts
**So that** I can communicate risk in standard security language and drive compliance mapping

**Background:** The CIA triad (Confidentiality, Integrity, Availability) is the foundational security model. STRIDE maps naturally: Information Disclosure → C; Tampering → I; Denial of Service → A; Spoofing → I + authenticity threat; Repudiation → C + I + A; Elevation of Privilege → C + I + A.

**Implemented Features:**
- [x] CIA Triad panel on threat risk scoring: Confidentiality / Integrity / Availability impact level (NONE/LOW/MEDIUM/HIGH/CRITICAL)
- [x] `CIATriadPanel.tsx` — interactive panel in EditThreatDialog risk scoring section
- [x] `calculateCIAImpactScore()` — composite CIA impact score (0–100)
- [x] `ThreatRiskScore` Prisma model persists CIA scores per threat
- [x] CIA score displayed on threat cards via `RiskScoreBadge.tsx`
- [x] CIA data included in risk framework comparison (`FrameworkCompare.tsx`)
- [x] STRIDE-to-CIA guidance in `ScoreHelpTooltip.tsx`
- [ ] STRIDE-to-CIA **auto pre-fill**: selecting a STRIDE category auto-populates the CIA fields (currently guidance only; auto-fill not yet wired)
- [ ] CIA distribution chart in Risk Dashboard (threats by C / I / A pillar — widget not yet added)
- [ ] Export: C/I/A levels included in PDF and CSV reports (fields exist in schema; export wiring TBD)

**Acceptance Criteria:**
- Open EditThreatDialog → CIA Triad tab visible; set C=HIGH, I=LOW, A=NONE → score computed and persisted
- CIA badge shows on threat card after save
- Selecting STRIDE "Denial of Service" → CIA panel highlights A (Availability) as expected primary impact

**UI Location:** `features/threats/components/risk-scoring/CIATriadPanel.tsx`, `features/threats/utils/` CIA utilities

---

### US-4.7: CVSS Scoring (3.1 + 4.0)

**As a** security architect
**I want to** compute and record CVSS scores for threats using industry-standard calculators
**So that** severity is standardized, reproducible, and auditable across teams and compliance reports

**Implemented Features:**
- [x] Severity field (CRITICAL/HIGH/MEDIUM/LOW) as quick-select on all threats
- [x] **CVSS 3.1 Calculator** (`CVSS31Panel.tsx`, `cvss31-calculator.ts`):
  - Full base metrics: AV (Network/Adjacent/Local/Physical), AC (Low/High), PR (None/Low/High), UI (None/Required), S (Unchanged/Changed), C/I/A Impact (None/Low/High)
  - Auto-computed base score (0.0–10.0) + qualitative rating using official FIRST specification weights
  - CVSS vector string generation (e.g., `CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:N`)
- [x] **CVSS 4.0 Calculator** (`CVSS40Panel.tsx`, `cvss40-calculator.ts`):
  - Base: AV, AC, AT (Attack Requirements), PR, UI (None/Passive/Active), VC/VI/VA, SC/SI/SA
  - Auto-computed score (0.0–10.0) per CVSS 4.0 macrovector specification
- [x] **AI severity calculation** via `CALCULATE_SEVERITY` BullMQ job + `aiService.calculateSeverity()` — AI analyzes threat description and component context to suggest severity adjustment
- [x] `Threat.cvssScore31` and `Threat.cvssScore40` Float fields in Prisma schema (persisted)
- [x] `ThreatRiskScore` model — stores full metric breakdown per framework per threat
- [x] `RiskScoreBadge.tsx` — displays computed score on threat cards
- [x] `FrameworkCompare.tsx` — compare scores across multiple frameworks side-by-side
- [x] Expert analysis pipeline generates `severityAdjustments` recommendations
- [ ] CVSS vector string displayed on threat cards and included in PDF/CSV exports (fields persisted; export wiring in progress)
- [ ] Severity field auto-syncs from CVSS score (CRITICAL: 9.0–10.0; HIGH: 7.0–8.9; MEDIUM: 4.0–6.9; LOW: 0.1–3.9) — currently manual

**Acceptance Criteria:**
- User opens CVSS 3.1 panel, sets AV=Network, AC=Low, PR=None, UI=None, S=Unchanged, C=High, I=None, A=None → score shows 7.5 and rating shows HIGH
- CVSS score persists after save and re-appears on reloading the threat
- AI severity job completes → severity field updates with AI recommendation shown as a "suggestion" chip the user can accept or dismiss

**UI Location:** `features/threats/components/risk-scoring/CVSS31Panel.tsx`, `CVSS40Panel.tsx`, `features/threats/utils/cvss31-calculator.ts`

---

### US-4.8: Multi-Framework Risk Scoring (DREAD, OWASP Risk Rating, FAIR)

**As a** security architect
**I want to** score threats using DREAD, OWASP Risk Rating, and FAIR in addition to CVSS
**So that** I can apply the methodology most appropriate to my organization's risk language

**Background:** Different organisations use different scoring frameworks. DREAD is popular in Microsoft-ecosystem teams. OWASP Risk Rating adds threat-agent and business-impact dimensions. FAIR (Factor Analysis of Information Risk) quantifies risk in financial terms — useful for board-level reporting.

**Implemented Features:**
- [x] **DREAD Calculator** (`DREADPanel.tsx`, `dread-calculator.ts`): Damage, Reproducibility, Exploitability, Affected Users, Discoverability — each 0–10; overall score = average (0–10)
- [x] **OWASP Risk Rating Calculator** (`OWASPRiskPanel.tsx`, `owasp-risk-calculator.ts`): Threat Agent Factors (skill, motive, opportunity, size), Vulnerability Factors (discovery, exploit, awareness, intrusion detection), Technical Impact (loss of confidentiality/integrity/availability/accountability), Business Impact (financial, reputation, non-compliance, privacy) — Overall risk = Likelihood × Impact
- [x] **FAIR Calculator** (`FAIRPanel.tsx`, `fair-calculator.ts`): TEF (Threat Event Frequency), Vulnerability, SLE (Single Loss Expectancy), SLEF (Secondary Loss Event Frequency), ALE (Annualized Loss Expectancy) — produces financial risk estimate
- [x] **Framework comparison** (`FrameworkCompare.tsx`) — view CVSS 3.1, CVSS 4.0, CIA, DREAD, OWASP, FAIR scores side-by-side for any single threat
- [x] `RiskFramework` Prisma model — org-configurable framework definitions; `RiskFrameworkType` enum: OWASP_RISK_RATING, FAIR, CVSS, DREAD, CUSTOM
- [x] `ThreatRiskScore` Prisma model — `factors` (JSON), `score`, `rating` per threat per framework
- [x] Default framework per org (admin-configurable)
- [x] `RiskScorePanel.tsx` — unified panel that shows all calculated scores for a threat
- [x] Framework guidance tooltip (`FrameworkGuidance.tsx`) — explains which framework to use when
- [ ] Custom framework builder — org admin defines their own scoring formula (CUSTOM type schema ready; UI builder not yet implemented)
- [ ] FAIR financial estimate used in risk dashboard (ALE aggregated across all threats per model)
- [ ] Export: all framework scores in PDF and CSV reports (schema persists; export wiring pending)

**Acceptance Criteria:**
- Open a threat's risk scoring panel → tabs for CIA, CVSS 3.1, CVSS 4.0, DREAD, OWASP Risk Rating, FAIR
- Fill in DREAD scores (all 10) → overall score = 10.0, rating = CRITICAL
- OWASP Risk Rating: Likelihood=HIGH, Impact=HIGH → risk matrix shows CRITICAL
- FAIR: set TEF=12/yr, Vulnerability=0.5, SLE=$50,000 → ALE shows $300,000/yr
- Framework Compare view shows all six scores in one table

**UI Location:** `features/threats/components/risk-scoring/`, `features/threats/utils/`

---

## Epic 5: AI-Powered Features

**Location:** `features/ai/`, `features/proactive-ai/`, `features/natural-language/`

### US-5.1: AI Threat Suggestions

**As a** user
**I want to** get AI-generated threat suggestions
**So that** I can identify threats I might have missed

**Implemented Features:**
- [x] "Suggest Threats" button
- [x] Analysis of selected components
- [x] Context-aware suggestions (architecture, data types, connections)
- [x] Multi-methodology categorization (STRIDE, PASTA, Kill Chain, MITRE ATT&CK)
- [x] Accept/dismiss individual suggestions
- [x] Bulk accept all
- [x] AI provider selection (Claude, OpenAI, Gemini, Ollama, LM Studio, Vertex AI)
- [x] Auto-suggest mode

**UI Location:** `features/ai/components/AIThreatSuggestions`

---

### US-5.2: AI Chat Assistant

**As a** user
**I want to** chat with an AI assistant
**So that** I can get help with threat modeling questions

**Implemented Features:**
- [x] Streaming chat panel interface
- [x] Context-aware responses (model state injected)
- [x] Markdown rendering with code blocks
- [x] Chat history per model
- [x] Clear conversation
- [x] Multiple AI providers

**UI Location:** `features/ai/components/StreamingChatPanel`

---

### US-5.3: AI Mitigation Suggestions

**As a** user
**I want to** get AI-suggested mitigations
**So that** I can address threats effectively

**Implemented Features:**
- [x] Suggest mitigations for threat
- [x] Context-aware recommendations
- [x] Implementation guidance
- [x] Accept suggestions as mitigations
- [x] Categorized by control type

**UI Location:** AI panel

---

### US-5.4: Natural Language Commands

**As an** expert user
**I want to** use natural language to modify my model
**So that** I can work faster

**Implemented Features:**
- [x] NL command input
- [x] "Add a database component"
- [x] "Connect user to API"
- [x] "Add SQL injection threat to database"
- [x] Command history

**UI Location:** `features/natural-language/`

---

### US-5.5: AI Review

**As a** user
**I want to** get an AI review of my threat model
**So that** I can improve its quality

**Implemented Features:**
- [x] Full model analysis
- [x] Coverage assessment
- [x] Missing threat identification
- [x] Best practice recommendations
- [x] Severity validation

**UI Location:** `features/ai-review/`

---

### US-5.6: Expert Analysis

**As a** security architect
**I want to** run a deep, multi-pass AI analysis
**So that** I get comprehensive threat coverage with high confidence

**Implemented Features:**
- [x] 6-pass expert analysis pipeline
- [x] Per-component, per-category micro-analysis
- [x] Reference data injection (CWEs, OWASP entries, compliance requirements)
- [x] Confidence loop: re-prompts when confidence below threshold
- [x] Separate mitigation generation pass (2–4 mitigations per threat from different control categories)
- [x] Supply chain threats from SOUP/dependency analysis
- [x] ML/AI-specific threats for ML components
- [x] Sequence-aware analysis (passes sequence diagram flows into prompts)
- [x] Cross-component compound analysis + severity calibration
- [x] Background execution via BullMQ jobs
- [x] Refinement questions (AI asks follow-up questions before analyzing)

**UI Location:** `features/ai/components/ExpertAnalysisButton`, `RefinementQuestionsPanel`

---

### US-5.7: Proactive AI Assistance

**As a** user
**I want to** receive contextual AI guidance as I build my model
**So that** I can make informed security decisions in real time

**Implemented Features:**
- [x] Component threat popover (contextual hints when selecting components)
- [x] Severity calculator
- [x] STRIDE contextual help
- [x] Threat badges on components

**UI Location:** `features/proactive-ai/`

---

## Epic 6: Multi-Diagram Support

**Location:** `features/dfd/`, `features/sequence-diagrams/`

### US-6.1: Data Flow Diagrams

**As a** user
**I want to** create DFD-style diagrams
**So that** I can model data flows specifically

**Implemented Features:**
- [x] DFD canvas mode
- [x] Process, Data Store, External Entity nodes
- [x] Data flow connections
- [x] DFD-specific properties
- [x] Link to threat model

**UI Location:** `features/dfd/`

---

### US-6.2: Sequence Diagrams

**As a** user
**I want to** create sequence diagrams
**So that** I can model interaction flows

**Implemented Features:**
- [x] Sequence diagram canvas
- [x] Actors and lifelines
- [x] Messages and arrows
- [x] Activation boxes
- [x] Notes and comments
- [x] Link threats to interactions
- [x] AI-powered sequence diagram generation

**UI Location:** `features/sequence-diagrams/`

---

### US-6.3: Multi-Diagram Tabs

**As a** user
**I want to** manage multiple diagrams per model
**So that** I can document different aspects

**Implemented Features:**
- [x] Tab interface for diagrams
- [x] Add new diagram tabs
- [x] Switch between diagrams
- [x] Rename/delete diagrams
- [x] Copy components between diagrams

**UI Location:** `stores/diagram-store.ts`

---

## Epic 7: Collaboration

**Location:** `features/collaboration/`

### US-7.1: Real-Time Editing

**As a** team member
**I want to** edit models simultaneously with colleagues
**So that** we can collaborate effectively

**Implemented Features:**
- [x] Real-time sync (Yjs CRDT)
- [x] See other users' cursors
- [x] Presence indicators
- [x] Conflict-free concurrent editing
- [x] Automatic reconnection

**UI Location:** `features/collaboration/`

---

### US-7.2: Invite Team Members

**As a** project owner
**I want to** invite team members
**So that** we can work together

**Implemented Features:**
- [x] Invite by email
- [x] Role assignment (Viewer/Editor/Admin)
- [x] Invitation email sent
- [x] Accept invitation flow
- [x] View pending invitations
- [x] Revoke invitations

**UI Location:** `features/organizations/components/InviteMemberDialog`

---

### US-7.3: Guest Access

**As a** model owner
**I want to** share models with external reviewers
**So that** they can review without an account

**Implemented Features:**
- [x] Generate shareable link
- [x] Set guest role (Viewer/Commenter/Editor)
- [x] Set expiration date
- [x] Revoke access
- [x] Guest activity tracking
- [x] Organization-level guest access policy (allow/deny)
- [ ] Optional password protection per link
- [ ] IP restrictions per link

**UI Location:** Share dialog

---

### US-7.4: Review Workflow

**As a** security architect
**I want to** formally review threats with my team
**So that** we can track review status and sign-off

**Implemented Features:**
- [x] Review panel with thread-based comments
- [x] Review status badges
- [x] Reviewer list and assignment
- [x] Review history timeline
- [x] Comment threads per threat
- [x] Review actions (approve/request changes)

**UI Location:** `features/review/`

---

## Epic 8: Export & Reporting

**Location:** `features/export/`, `features/stakeholder-exports/`

### US-8.1: Export to PDF

**As a** compliance officer
**I want to** export threat models as PDF
**So that** I can share with stakeholders

**Implemented Features:**
- [x] PDF report generation
- [x] Include diagram image
- [x] Threat table
- [x] Mitigation status
- [x] STRIDE summary chart
- [x] Risk matrix
- [x] Executive summary option

**UI Location:** `features/export/`

---

### US-8.2: Export Data Formats

**As a** user
**I want to** export my model data
**So that** I can use it in other tools

**Implemented Features:**
- [x] JSON export
- [x] YAML export
- [x] Mermaid diagram export
- [x] Draw.io compatible export
- [x] CSV threat list
- [x] Risk Register CSV (GRC-compatible)

**UI Location:** Export menu

---

### US-8.3: Export Images

**As a** user
**I want to** export my diagram as an image
**So that** I can use it in presentations

**Implemented Features:**
- [x] PNG export
- [x] SVG export
- [x] Resolution options (1x, 2x, 4x)
- [x] Background options
- [x] Selected elements only option

**UI Location:** Export menu

---

### US-8.4: Stakeholder Reports

**As a** security architect
**I want to** generate role-specific reports
**So that** I can communicate appropriately

**Implemented Features:**
- [x] Executive summary (high-level)
- [x] Technical report (detailed)
- [x] Compliance report (framework-mapped)
- [x] Export hub with format selection

**UI Location:** `features/stakeholder-exports/`

---

## Epic 9: Organization & Team Management

**Location:** `features/organizations/`, `app/(app)/organization/`

### US-9.1: Create Organization

**As a** team lead
**I want to** create an organization
**So that** I can manage team access

**Implemented Features:**
- [x] Create team organization
- [x] Set organization name and description
- [x] Upload organization logo
- [x] Configure default settings

**UI Location:** `/organization`

---

### US-9.2: Manage Members

**As an** organization admin
**I want to** manage organization members
**So that** I can control access

**Implemented Features:**
- [x] View member list
- [x] Change member roles
- [x] Remove members
- [x] Transfer ownership
- [x] View member activity

**UI Location:** Organization settings

---

### US-9.3: Custom Roles

**As an** organization admin
**I want to** create custom roles
**So that** I can have fine-grained permissions

**Implemented Features:**
- [x] Create custom roles
- [x] Define permissions per role
- [x] Assign custom roles to members
- [x] Edit/delete custom roles

**UI Location:** `features/organizations/` custom roles

---

### US-9.4: Configure Webhooks

**As an** integration admin
**I want to** configure webhooks
**So that** I can integrate with external systems

**Implemented Features:**
- [x] Add webhook endpoints
- [x] Select events to subscribe
- [x] Configure secret for signature
- [x] View delivery logs
- [x] Test webhook

**UI Location:** Organization settings → Webhooks

---

### US-9.5: SSO Configuration

**As an** enterprise admin
**I want to** configure SSO
**So that** users can login with corporate credentials

**Implemented Features:**
- [x] SAML 2.0 configuration
- [x] OIDC configuration
- [x] Metadata upload
- [x] Test SSO connection
- [x] Enforce SSO for organization

**UI Location:** Organization settings → SSO

---

## Epic 10: User Profile & Security

**Location:** `features/profile/`, `features/security/`, `app/(app)/profile/`

### US-10.1: Manage Profile

**As a** user
**I want to** manage my profile
**So that** I can keep my information current

**Implemented Features:**
- [x] Edit name and avatar
- [x] Change email
- [x] Update password
- [x] Set default organization
- [x] View account activity

**UI Location:** `/profile`

---

### US-10.2: Two-Factor Authentication

**As a** security-conscious user
**I want to** enable 2FA
**So that** my account is more secure

**Implemented Features:**
- [x] Enable TOTP 2FA
- [x] QR code setup
- [x] Backup codes generation
- [x] Disable 2FA
- [x] Recovery flow

**UI Location:** `/profile` → Security tab

---

### US-10.3: Manage Sessions

**As a** user
**I want to** view and manage my sessions
**So that** I can ensure account security

**Implemented Features:**
- [x] View active sessions
- [x] See device and location info
- [x] Revoke individual sessions
- [x] Revoke all other sessions

**UI Location:** `/profile` → Security tab

---

### US-10.4: API Tokens

**As a** developer
**I want to** create API tokens
**So that** I can access the API programmatically

**Implemented Features:**
- [x] Generate personal access tokens
- [x] Set token name and description
- [x] Select scopes/permissions
- [x] Set expiration
- [x] View and revoke tokens

**UI Location:** `/profile` → API Tokens tab

---

## Epic 11: System Administration

**Location:** `features/admin/`, `app/admin/`

### US-11.1: Admin Dashboard

**As a** system admin
**I want to** see system overview
**So that** I can monitor platform health

**Implemented Features:**
- [x] User count statistics
- [x] Organization count
- [x] Model count
- [x] System health indicators (database, Redis, memory, CPU)
- [x] Connection pool metrics
- [x] Cache statistics
- [x] Recent activity

**UI Location:** `/admin`

---

### US-11.2: User Management

**As a** system admin
**I want to** manage all users
**So that** I can administer the platform

**Implemented Features:**
- [x] List all users with search
- [x] View last login timestamps
- [x] Promote/demote system admins
- [x] Suspend/unsuspend users
- [x] Delete users
- [x] Bulk import via CSV

**UI Location:** `/admin/users`

---

### US-11.3: System Settings

**As a** system admin
**I want to** configure system settings
**So that** I can customize the platform

**Implemented Features:**
- [x] General settings (signups, email verification)
- [x] Security settings (session timeout, lockout, password policy, MFA)
- [x] AI settings (enable/disable, provider, guardrails)
- [x] SSO settings (SAML configuration)
- [x] IP allowlist (system-wide)
- [x] Email configuration
- [x] OAuth provider management

**UI Location:** `/admin/settings`

---

### US-11.4: Audit Logs

**As a** system admin
**I want to** view audit logs
**So that** I can investigate security events

**Implemented Features:**
- [x] View all system events
- [x] Filter by entity type, action, user
- [x] Date range filtering
- [x] Export to CSV/JSON
- [x] Configure retention policy
- [x] Purge old logs

**UI Location:** `/admin/audit`

---

### US-11.5: Account Lockout & Brute Force Protection

**As a** system admin
**I want to** automatically lock accounts after repeated failed login attempts
**So that** credential stuffing and brute force attacks are blocked and I receive alerts

**Implemented Features:**
- [x] Rate limiting on login endpoint (prevents rapid-fire attempts)
- [ ] **Account lockout**: after N failed attempts (configurable, default 5), account is locked for M minutes (configurable, default 30)
- [ ] **Admin unlock**: system admin can unlock any account from `/admin/users`
- [ ] **Lockout notification**: email sent to account owner when their account is locked (with IP and timestamp)
- [ ] **Admin alert**: system admin notified when any account is locked (configurable — email / in-app)
- [ ] **Lockout audit log entry**: lockout event recorded with IP address, user agent, and timestamp
- [ ] Admin-configurable: max attempts before lockout, lockout duration, whether to notify admin

**Acceptance Criteria:**
- 5 failed logins in < 10 minutes → 6th attempt returns 429 with "Account temporarily locked" message
- Waiting 30 minutes (default) → account auto-unlocks; next login succeeds with correct credentials
- Admin visits `/admin/users` → locked accounts show a lock icon; admin can unlock immediately
- Lockout event appears in audit log with IP address

**UI Location:** `/admin/settings` → Security tab; `/admin/users`

---

## Epic 12: Integrations & Ecosystem

**Location:** `features/integrations/`

### US-12.1: Jira Integration

**As a** development team member
**I want to** create Jira issues from threats
**So that** I can track remediation in our workflow

**Implemented Features:**
- [x] Connect Jira instance via setup wizard
- [x] Create issues from threats
- [x] Map fields (severity → priority)
- [x] Sync issue status
- [x] View linked issues

**UI Location:** `features/integrations/components/JiraSetupWizard.tsx`

---

### US-12.2: GitHub Integration

**As a** developer
**I want to** create GitHub issues from threats
**So that** I can track in our repository

**Implemented Features:**
- [x] Connect GitHub repository via setup wizard
- [x] Create issues from threats
- [x] Link to threat model
- [x] View linked issues

**UI Location:** `features/integrations/components/GitHubSetupWizard.tsx`

---

### US-12.3: Diagram Import

**As a** user
**I want to** import diagrams from other tools
**So that** I can start a threat model from an existing architecture diagram without redrawing it

**Implemented Features:**
- [x] Import from Draw.io (.drawio / .xml)
- [x] Import from Lucidchart (exported .xml)
- [x] Import from Mermaid text/diagram
- [x] **Import from MS Threat Modeling Tool** (.tm7 files) — converts MS TMT elements and threats to ThreatForge format
- [x] **Import from OWASP Threat Dragon** (JSON format) — converts Dragon diagrams and threat flows
- [x] **Import from Threagile** (YAML format) — converts Threagile's YAML threat model to canvas + threats
- [x] **YAML round-trip import** — import a ThreatForge YAML export back into a new model (full round-trip: threats, mitigations, connections, canvas state restored)
- [x] Map components automatically to ThreatForge component types
- [x] Review and adjust component mapping before import completes

**UI Location:** `features/integrations/diagram-import/`, `server/src/api/threat-models/routes/export-import.ts`

---

### US-12.4: CI/CD Integration

**As a** DevOps engineer
**I want to** scan threat models in CI/CD
**So that** I can enforce security gates

**Implemented Features:**
- [x] CI API endpoints
- [x] API key management
- [x] Scan threat model
- [x] Fail on severity threshold
- [x] GitHub Actions support
- [x] Webhook integration for CI feedback

**UI Location:** API documentation, `/docs` (Swagger)

---

### US-12.5: Communication Integrations

**As a** team lead
**I want to** receive notifications in Slack or Teams
**So that** my team stays informed about threat model changes

**Implemented Features:**
- [x] Slack setup wizard
- [x] Microsoft Teams setup wizard
- [x] Event-based notifications

**UI Location:** `features/integrations/components/SlackSetupWizard.tsx`, `TeamsSetupWizard.tsx`

---

### US-12.6: Public REST API

**As a** developer or tool author
**I want to** access ThreatForge programmatically via a documented REST API with scoped authentication
**So that** I can build custom add-ins, connect my GRC/SIEM/ITSM tools, or automate threat model workflows without using the UI

**Implemented Features:**

*Authentication:*
- [x] **Personal API tokens** — user generates tokens at `/profile` → API Tokens tab; scoped, expiry-settable, prefix `ftm_xxx`
- [x] **CI/CD API keys** — org-admin generates keys at `/admin` for automated pipelines; separate from user tokens
- [x] **9 token scopes** with wildcard support: `read:models`, `write:models`, `read:threats`, `write:threats`, `read:projects`, `write:projects`, `read:organizations`, `ci:read`, `ci:write` — `read:*` matches all read scopes
- [x] **Cookie + Bearer + CI key** — three auth methods; session cookie for browser, Bearer for API clients, CI key for pipelines
- [x] All API tokens logged in audit trail with last-used timestamp and usage count

*`/api/v1/` — versioned public surface:*
- [x] `GET /api/v1/threat-models` — list all models in org (scope: `read:models`); pagination, filter by project
- [x] `GET /api/v1/threat-models/:id` — model detail with metadata
- [x] `GET /api/v1/threat-models/:id/threats` — threats + mitigations + risk scores per model (scope: `read:threats`)
- [x] `GET /api/v1/threat-models/:id/compliance` — compliance coverage per framework
- [x] `GET /api/v1/risk-scoring` — risk frameworks and scores
- [x] `GET /api/v1/model-templates` — template library
- [x] `GET /api/v1/mitigation-libraries` — mitigation template libraries
- [x] `GET /api/v1/organizations/:id/custom-categories` — custom threat categories
- [x] `GET /api/v1/marketplace/libraries` — marketplace content
- [x] `GET /api/v1/integrations` — integration status and config

*CI/CD API:*
- [x] `POST /api/ci/scan` — scan a threat model; returns severity counts + pass/fail against `failOnSeverity` threshold
- [x] Source type: GITHUB, GITLAB, BITBUCKET, AZURE_DEVOPS
- [x] Scan result linked to commit SHA and PR number for traceability

*Webhooks (push events to your systems):*
- [x] **15 outbound webhook events**: `threat.created/updated/deleted`, `mitigation.created/updated/deleted`, `model.created/updated/deleted/exported`, `member.invited/joined/removed`, `project.created/deleted`
- [x] HMAC-SHA256 signed payloads (`X-ThreatForge-Signature` header) for verification
- [x] Test webhook endpoint (fire a synthetic event to test your receiver)
- [x] Delivery logs (view past deliveries and their response codes)
- [x] Per-event subscription (select only the events you need)

*Documentation:*
- [x] **OpenAPI 3.1** spec auto-generated at `GET /docs/json`
- [x] **Swagger UI** at `/docs` — interactive explorer with all 18 tag categories: Threat Models, Threats, Mitigations, Projects, Organizations, Admin, AI, Auth, CI/CD, Attack Surface, Compliance, Reporting, Custom Categories, Mitigation Libraries, Model Templates, Risk Scoring, Integrations, Marketplace
- [x] Consistent response envelope: `{ data: ..., pagination: { page, limit, total, totalPages, hasNext, hasPrev } }`
- [x] Standard error codes: 200/201/204/400/401/403/404/409/429/500

*Gaps (write operations via API token):*
- [ ] `POST/PATCH/DELETE /api/v1/threat-models/:id/threats` — write threats via API token (routes exist for session auth but not yet wired for token auth)
- [ ] `POST/PATCH /api/v1/threat-models/:id/mitigations` — write mitigations via API token
- [ ] `POST /api/v1/threat-models` — create a model via API token
- [ ] Webhook events for: AI job completion, compliance assessment results, review sign-off
- [ ] Published rate limiting contract (limits exist; not documented)
- [ ] API versioning policy (what constitutes a breaking change, deprecation notice period)

**UI Location:** `/profile` → API Tokens; Swagger UI at `/docs`; `server/src/api/v1/`, `server/src/api/ci/`, `server/src/api/webhooks/`

---

### US-12.7: GitHub Actions Integration

**As a** DevOps engineer
**I want to** add ThreatForge threat model validation to my GitHub Actions workflow
**So that** PRs are automatically blocked when new HIGH/CRITICAL threats are unmitigated

**Implemented Features:**
- [x] CI/CD scan API endpoint (`GET /api/v1/threat-models/:id/scan`)
- [x] API Bearer token auth for CI
- [x] Severity threshold configuration
- [ ] **Official GitHub Action** published to the GitHub Marketplace (`threatforge/threatforge-action`):
  - Inputs: `api-url`, `api-token`, `model-id`, `fail-on` (severity threshold), `comment-on-pr` (bool)
  - Output: threat count by severity; PR comment summarizing unmitigated threats
  - Exit code 1 when `fail-on` threshold is met
- [ ] **Action YAML template** in docs: copy-paste workflow for common use cases
- [ ] **Security baseline check** as a separate step (US-22.4 baseline rules — pass/fail)
- [ ] `threatforge scan` CLI command (ties to SDK — US Q4 2026)

**Acceptance Criteria:**
- Developer adds `uses: threatforge/threatforge-action@v1` to their workflow → action runs on PR open/update
- Model has 2 CRITICAL unmitigated threats, `fail-on: HIGH` → action fails and PR is blocked
- PR comment shows: "ThreatForge scan: 2 CRITICAL, 3 HIGH unmitigated threats [view details]"

**UI Location:** GitHub Actions Marketplace; docs: `docs/DEPLOYMENT_CLOUD.md`

---

### US-12.8: Azure DevOps Integration

**As a** DevOps engineer in a Microsoft-stack organisation
**I want to** integrate ThreatForge with Azure DevOps
**So that** threat model validation fits into our ADO pipeline and work-item tracking

**Implemented Features:**
- [x] REST API (any CI system can call it)
- [ ] **Azure DevOps pipeline task** published to the Azure DevOps Marketplace
- [ ] **Work item creation from threats** — push ThreatForge threats as Azure DevOps Bugs or Tasks
- [ ] **Bidirectional status sync** — when an ADO work item is closed, the linked mitigation updates to IMPLEMENTED
- [ ] **Azure Boards backlog view** — threats visible in a backlog column via the ADO extension

**Acceptance Criteria:**
- ADO pipeline task runs on PR → fails pipeline when unmitigated CRITICAL threats exist
- Create threat in ThreatForge → "Push to Azure DevOps" button creates linked Bug in the configured project
- Close the ADO Bug → mitigation status updates to IMPLEMENTED in ThreatForge within 5 minutes (via webhook)

**UI Location:** `features/integrations/`, ADO Marketplace extension

---

### US-12.9: ITSM Integration (ServiceNow)

**As an** enterprise security architect
**I want to** create ServiceNow incidents and change requests from ThreatForge threats
**So that** security remediation fits into our existing ITSM workflow

**Implemented Features:**
- [ ] ServiceNow connection wizard (instance URL + OAuth credentials)
- [ ] Create Incident from threat (maps severity to impact/urgency)
- [ ] Create Change Request from mitigation
- [ ] View linked ServiceNow records in threat detail
- [ ] Bidirectional status sync via ServiceNow webhook

**Acceptance Criteria:**
- "Create ServiceNow Incident" button appears on threat detail → incident created in the configured SN instance
- Incident number shows as a clickable link in ThreatForge evidence links
- When SN incident is resolved → threat's mitigation status updates to IMPLEMENTED

**UI Location:** `features/integrations/`

---

### US-12.10: Developer Platform & SDK

**As a** developer building an add-in or integration
**I want to** a well-documented SDK and developer platform
**So that** I can integrate ThreatForge into my own tools, GRC systems, or automation pipelines without manually crafting HTTP requests

**Background:** The REST API and Swagger UI are fully implemented (US-12.6). This story covers the higher-level developer experience: SDKs, webhook reliability, a developer portal, and an explicit API versioning contract.

**Implemented Features:**
- [x] OpenAPI 3.1 spec at `/docs/json` — machine-readable; can be used to auto-generate client SDKs with `openapi-generator`
- [x] Swagger UI at `/docs` — interactive exploration
- [x] Consistent response envelope and error codes

**Planned:**
- [ ] **Python SDK** (`pip install threatforge`) — CRUD for models, threats, mitigations, components; retry logic, pagination helpers; async-native
- [ ] **Node.js / TypeScript SDK** (`npm install @threatforge/sdk`) — same surface; typed response objects matching Prisma types
- [ ] **SDK docs** — auto-generated from OpenAPI spec + hand-written guides
- [ ] **Webhook reliability** — retry with exponential backoff (3 retries over 1 hour); dead-letter queue for failed deliveries; delivery log UI shows response body
- [ ] **Additional webhook events**: `ai_job.completed`, `ai_job.failed`, `compliance.assessed`, `review.approved`, `review.changes_requested`, `scan.completed`, `model.version_created`
- [ ] **API write operations** via token: `POST/PATCH/DELETE` for threats, mitigations, components, models — fully token-authenticated (scope: `write:threats`, `write:models`)
- [ ] **Developer portal** — beyond Swagger UI: getting-started guides, code examples (Python/Node/curl), use-case recipes (export to GRC, push threats to Jira, CI scan setup), changelog
- [ ] **Published rate limits** — requests/min per token tier (default: 100 req/min; enterprise: 1000 req/min)
- [ ] **API versioning contract** — semantic versioning; `/api/v2/` when breaking changes are introduced; 12-month deprecation notice on breaking changes
- [ ] **Webhook HMAC verification library** — published as a small utility (`@threatforge/webhook-verify`) to make payload verification trivial in any language

**Acceptance Criteria:**
- `pip install threatforge && python -c "from threatforge import Client; c = Client(token='ftm_xxx'); print(c.threat_models.list())"` works without other dependencies
- Webhook delivery fails → ThreatForge retries 3 times; delivery log shows each attempt with status code
- API token with `write:threats` scope → `POST /api/v1/threat-models/:id/threats` returns 201 with created threat
- Developer portal has a "Quick Start in 5 minutes" guide that a developer unfamiliar with ThreatForge can follow without help

**UI Location:** Docs at `/docs`; developer portal (new route `/developer`); SDK packages on PyPI + npm

---

## Epic 13: Junior Engineer Support

**Location:** `features/junior-success/`, `features/guided-wizard/`, `features/completeness/`

### US-13.1: Guided Wizard

**As a** junior developer
**I want to** follow a guided process
**So that** I can create my first threat model correctly

**Implemented Features:**
- [x] Step-by-step wizard
- [x] STRIDE education integrated
- [x] Validation at each step
- [x] Context-sensitive help
- [x] Progress tracking

**UI Location:** `features/guided-wizard/`

---

### US-13.2: Threat Templates

**As a** junior developer
**I want to** use pre-built threat templates
**So that** I can apply common threats easily

**Implemented Features:**
- [x] Template library by methodology (STRIDE, PASTA, Kill Chain, MITRE ATT&CK)
- [x] Web application templates
- [x] API templates
- [x] Database templates
- [x] Cloud templates
- [x] Browse via Threat Library dialog

**UI Location:** `features/threat-library/`

---

### US-13.3: Completeness Tracking

**As a** junior developer
**I want to** see how complete my model is
**So that** I know what's missing

**Implemented Features:**
- [x] Completeness score card
- [x] Missing threat categories
- [x] Uncovered components list
- [x] Improvement suggestions
- [x] Quality indicators

**UI Location:** `features/completeness/`

---

### US-13.4: Reference Links

**As a** junior developer
**I want to** access educational resources
**So that** I can learn while working

**Implemented Features:**
- [x] STRIDE methodology links
- [x] OWASP references
- [x] CWE links for threats
- [x] Best practice guides

**UI Location:** `features/reference-links/`

---

### US-13.5: Smart Connection Suggestions

**As any** user (novice or expert)
**I want to** receive context-aware suggestions when drawing connections between components
**So that** I don't accidentally create insecure data flows or forget to document security properties

**Background:** When a user draws a connection from an External Entity to a Database, ThreatForge knows these component types and can suggest the most appropriate protocol, auth method, and encryption setting. This prevents the "I forgot to set auth" problem proactively rather than reactively.

**Implemented Features:**
- [ ] **Type-aware protocol suggestion**: when connecting Web App → Database, suggest PostgreSQL/MySQL + TLS; when connecting External Entity → API, suggest HTTPS; when connecting API → Message Queue, suggest AMQP/Kafka (shown as a non-blocking suggestion chip, dismissible)
- [ ] **Auth suggestion based on boundary crossing**: if the connection crosses a trust boundary, suggest a stronger auth method (OAuth2 or mTLS minimum); if same zone, JWT/API_KEY may be sufficient
- [ ] **"Quick fill from suggestion"** button: one-click to accept all suggestions and populate protocol, auth, encryption fields
- [ ] Suggestion rules are configurable per org (admin can define custom type-pair → suggestion mappings)
- [ ] Learning mode: if user consistently overrides a suggestion (3+ times), it stops showing for that type pair for this user
- [ ] Suggestion tooltip explains WHY (e.g., "External-to-database connections should use certificate-based auth to prevent credential theft")

**Acceptance Criteria:**
- Draw a connection from an External Entity to a Database → suggestion chip appears: "Suggest: PostgreSQL · mTLS · Encrypted"
- User clicks "Quick fill" → protocol, auth, encryption fields all populate immediately
- User dismisses the suggestion → it does not reappear for 1 hour (session suppression)
- Draw a connection that stays within the same trust boundary → suggestion chip shows a weaker auth option

**UI Location:** Canvas edge creation flow, `components/canvas/edges/`

---

### US-13.6: Proactive Security Warnings

**As any** user
**I want to** see real-time warnings when my diagram has insecure configurations
**So that** I catch security issues before they become threats I have to manage manually

**Implemented Features:**
- [x] auth=None + boundary crossing → red edge stroke
- [x] "No Auth" pill shown in red on hover/overlay
- [ ] **Canvas Warning Panel** (collapsible, bottom of canvas): list of all current security issues across the whole diagram — ranked by severity
  - "3 connections cross trust boundaries without authentication"
  - "External Entity 'User' connects to Database 'Orders DB' without encryption"
  - "Component 'Payment API' has no threats documented"
- [ ] **Warning badges on components**: small warning icon on a component node when it has issues (no threats + is connected to external entity, or hosts a HIGH/CRITICAL unmitigated threat)
- [ ] **One-click fix**: each warning in the panel has a "Fix" button that opens the relevant dialog or highlights the relevant edge for quick remediation
- [ ] Warnings are grouped by type: Security Configuration, Missing Documentation, High-Risk Unmitigated Threats
- [ ] Warning count shown in the canvas toolbar (e.g., "⚠ 5 warnings")
- [ ] Suppress warning: user can dismiss individual warnings with a reason (snooze for this session, or mark as "accepted risk")

**Acceptance Criteria:**
- Add a connection from External Entity → Database with auth=None → warning appears in panel within 1 second: "Unauthenticated connection crosses trust boundary"
- Click "Fix" on that warning → edge properties panel opens with auth field highlighted
- Add a threat and set to CRITICAL + no mitigations → warning appears: "CRITICAL unmitigated threat on [component name]"
- Suppress a warning as "accepted risk" → warning disappears from panel and an audit log entry is created

**UI Location:** Canvas, `components/canvas/`, `features/proactive-ai/`

---

### US-13.7: Security Posture Score

**As any** user
**I want to** see a real-time security posture score for my threat model as I build it
**So that** I have a single number that tells me how complete and secure my model is

**Background:** A posture score gives junior users a north-star metric they can improve. For expert users, it validates their work before review. The score is not a risk score — it measures *completeness* and *security configuration quality* of the diagram, not threat severity.

**Implemented Features:**
- [x] Completeness score (existing, per `features/completeness/`) — counts threat coverage
- [ ] **Unified Posture Score** (0–100): composite of:
  - Connection security (40%): % of connections with protocol + auth + encryption set; penalty for auth=None on boundary crossings
  - Threat coverage (30%): % of components with at least one threat documented per relevant STRIDE category
  - Mitigation coverage (20%): % of HIGH/CRITICAL threats with at least one IMPLEMENTED mitigation
  - Documentation completeness (10%): % of components with description + trust level set
- [ ] Score displayed in canvas toolbar (real-time update as user makes changes)
- [ ] Score breakdown panel: click the score to see breakdown by category with specific gaps
- [ ] Score trend: compare current score to the last saved version
- [ ] Export: posture score included in PDF report header with breakdown table

**Acceptance Criteria:**
- New empty model → score starts at 0; adding one component with threats and mitigations → score increases measurably
- All connections have protocol + auth + encryption set → Connection Security component is 100%
- Score updates within 2 seconds of any canvas change (connection added, threat added, mitigation status changed)
- Clicking the score opens a breakdown: "Connection Security: 75% (3 of 4 connections secured)"

**UI Location:** Canvas toolbar, `features/completeness/`, `features/proactive-ai/`

---

### US-13.8: Questionnaire-Based Threat Generation

**As a** developer without a security background
**I want to** answer guided questions about my system to get threat coverage
**So that** I can produce a meaningful security assessment without needing to draw a diagram

**Background:** SD Elements' biggest differentiator is that non-security engineers can answer a questionnaire ("Is your app public-facing? Does it handle PII? Does it accept file uploads?") and automatically get a tailored set of security requirements and threats — no architecture diagram required. ThreatForge's guided wizard requires the user to build a canvas. This story adds a questionnaire path as an alternative entry point.

**Implemented Features:**
- [x] Guided wizard with step-by-step STRIDE education
- [x] Template-based quick start (applies pre-built threats to a model)
- [ ] **Questionnaire mode**: a step-by-step interview (`/models/new/interview` route) with questions covering:
  - System type (web app / API / mobile / desktop / IoT / data pipeline / ML system)
  - Exposure (public internet / internal network / VPN-only / air-gapped)
  - Data handled (PII, PHI, financial, credentials, none)
  - Authentication model (none / API key / OAuth / SSO / MFA)
  - External integrations (payment processor / third-party APIs / cloud storage)
  - Compliance requirements (HIPAA / PCI / SOC 2 / none)
  - Tech stack (optional — improves threat specificity)
- [ ] Based on answers, AI generates: a starter component diagram, pre-populated connection security properties, suggested threats per component (categorized by STRIDE), relevant compliance frameworks auto-selected
- [ ] User can review the generated model and switch to canvas edit mode to refine
- [ ] Questionnaire answers saved with the model for re-running if system context changes
- [ ] Completeness score starts populated based on questionnaire answers

**Acceptance Criteria:**
- User selects "Start with Interview" from new model flow → 8-step questionnaire shown
- Answers: web app, public internet, PII, OAuth, payment processor → model created with: Web App, Database, Payment Processor nodes; HTTPS connections with OAuth; HIPAA + PCI-DSS auto-selected; 5–10 starter threats suggested
- User can click "Edit in Canvas" → existing interview-generated model opens in canvas editor
- Re-running the interview with changed answers updates the model and appends new threats (does not delete manually added threats)

**UI Location:** `/models/new/interview`, new `features/guided-wizard/components/InterviewWizard.tsx`

---

## Epic 14: Expert Productivity

**Location:** `features/expert-productivity/`, `features/cross-model-intelligence/`

### US-14.1: Cross-Model Intelligence

**As an** expert user
**I want to** see patterns across models
**So that** I can identify systemic issues

**Implemented Features:**
- [x] Cross-model threat analysis
- [x] Similar models panel (learn from comparable threat models)
- [x] Reuse recommendations

**UI Location:** `features/cross-model-intelligence/`

---

### US-14.2: Keyboard Shortcuts

**As an** expert user
**I want to** use keyboard shortcuts
**So that** I can work faster

**Implemented Features:**
- [x] Comprehensive shortcut set
- [x] Shortcuts help dialog (? key)
- [x] Category-organized shortcut list

**UI Location:** `components/dialogs/ShortcutsHelpDialog`

---

### US-14.3: Bulk Operations

**As an** expert user
**I want to** perform bulk operations
**So that** I can make changes efficiently

**Implemented Features:**
- [x] Multi-select elements
- [x] Bulk delete
- [x] Bulk move
- [x] Bulk apply threats
- [x] Floating action bar
- [x] Batch operations toolbar

**UI Location:** `features/bulk-operations/`

---

### US-14.4: Attack Path Analysis

**As an** expert user
**I want to** visualize attack paths
**So that** I can understand attack chains

**Implemented Features:**
- [x] Attack path visualization canvas
- [x] Entry point identification
- [x] Target asset mapping
- [x] Path severity calculation
- [x] Attack path edges and nodes

**UI Location:** `features/attack-paths/`

---

### US-14.5: Attack Surface Analysis

**As an** expert user
**I want to** see my attack surface
**So that** I can prioritize hardening

**Implemented Features:**
- [x] Attack surface summary chart
- [x] External-facing components list
- [x] Risk exposure metrics
- [x] Component cards with surface detail

**UI Location:** `features/attack-surface/`

---

## Epic 15: Document Lifecycle

**Location:** `features/documents/`, `features/document-import/`, `features/toolbar/`

### US-15.1: Import Documents

**As a** security architect
**I want to** import architecture documents (PDF, Word, Markdown, Terraform, OpenAPI, etc.)
**So that** AI can extract components and generate a threat model

**Implemented Features:**
- [x] File upload dropzone and image dropzone
- [x] URL import (GitHub repo URL → scan → extract → diagram)
- [x] Text paste form
- [x] AI extraction of components, connections, trust boundaries
- [x] Auto-layout on canvas
- [x] Import progress indicator
- [x] Smart merge: fuzzy-match extracted components against existing canvas
- [x] MergeReviewDialog for user confirmation before changes
- [x] Confidence scores and match reasons per component

**UI Location:** `features/document-import/`, `features/toolbar/`

---

### US-15.2: Persist Documents

**As a** user
**I want to** see my imported documents stored in the model
**So that** I can refer back to them later

**Implemented Features:**
- [x] Documents saved with extracted text content (up to 500KB)
- [x] Document metadata: name, type, size, page count, extraction summary
- [x] Document types: PDF, DOCX, MARKDOWN, TERRAFORM, DOCKER_COMPOSE, OPENAPI, YAML, TEXT, SOURCE_CODE
- [x] Toolbar persists documents to Documents API after import
- [x] Documents visible in Docs tab on the right panel

**UI Location:** `features/documents/components/DocumentsPanel`

---

### US-15.3: View Document Content

**As a** user
**I want to** view the extracted content of my imported documents
**So that** I can see what was captured and what requirements were identified

**Implemented Features:**
- [x] Two-column viewer dialog: document text (left) and extracted requirements (right)
- [x] Requirements show coverage status (linked to threats/mitigations or uncovered)
- [x] Document metadata header (type, size, import date)
- [x] Actions dropdown per document (view, analyze gaps, delete)

**UI Location:** `features/documents/components/DocumentViewerDialog`

---

### US-15.4: Document Gap Analysis

**As a** compliance officer
**I want to** see which document requirements are not yet covered by threats or mitigations
**So that** I can identify gaps in my security posture

**Implemented Features:**
- [x] Uncovered requirements grouped by source document
- [x] Collapsible sections per document
- [x] CSV export of gaps
- [x] Gap count badges
- [x] Link to requirement details

**UI Location:** `features/documents/components/DocGapAnalysisDialog`

---

### US-15.5: Version-Linked Evidence

**As a** compliance officer
**I want to** version snapshots to capture which documents were present at each version
**So that** I have evidence traceability for audits

**Implemented Features:**
- [x] Version snapshots store documentIds
- [x] Documents linked to the model at snapshot time

**UI Location:** Version history panel

---

## Epic 16: Code Security Analysis

**Location:** `features/requirements/components/`, `server/src/services/code-scanner/`, `server/src/api/threat-models/routes/`

### US-16.1: Scan GitHub Repository

**As a** security architect
**I want to** scan a GitHub repository for existing security controls
**So that** I can see what protections are already in place in the codebase

**Implemented Features:**
- [x] Enter GitHub repo URL, optional branch, optional token (for private repos)
- [x] Fetches repo tree via GitHub API (up to 30 files, 256KB each)
- [x] Pattern-based file selection (security-relevant paths: middleware, auth, routes, etc.)
- [x] Creates or reuses a "Security Controls (Code Scan)" threat
- [x] Generates COMPLETED mitigations with code evidence links (GitHub permalink)
- [x] Deduplication against existing mitigations
- [x] Persists scan as a SOURCE_CODE Document in the Docs tab
- [x] Helpful error messages for 401/403/404 scenarios

**UI Location:** `features/requirements/components/ScanGithubDialog`

---

### US-16.2: Upload Local Files for Scanning

**As a** developer
**I want to** upload source files from my machine
**So that** I can detect security controls without pushing to GitHub

**Implemented Features:**
- [x] File picker (multi-select: .ts, .tsx, .js, .jsx, .py, .go, .rb, .java, .cs, .php)
- [x] Attach findings to a user-selected threat
- [x] Reads files as text, scans for security control patterns
- [x] Creates COMPLETED mitigations with evidence
- [x] Deduplication against existing mitigations
- [x] Persists scan as a SOURCE_CODE Document in the Docs tab

**UI Location:** `features/requirements/components/UploadFilesDialog`

---

### US-16.3: Code Control Pattern Detection

**As a** security architect
**I want to** the scanner to detect known security patterns in source code
**So that** existing controls are automatically identified

**Implemented Features:**
- [x] Pattern library with CWE references
- [x] Control categories: IAM, ENCRYPTION, ACCESS_CONTROL, NETWORK, LOGGING, INPUT_VALIDATION, SECRETS, BACKUP, MONITORING, SUPPLY_CHAIN
- [x] Evidence URL generation (GitHub permalinks)
- [x] Pattern name, description, and evidence title per finding

**UI Location:** Backend service `server/src/services/code-scanner/`

---

## Epic 17: Requirements & Traceability

**Location:** `features/requirements/`, `server/src/api/threat-models/routes/requirements*.ts`

### US-17.1: Manage Requirements

**As a** compliance officer
**I want to** create, import, and manage security requirements
**So that** I can track what my system must satisfy

**Implemented Features:**
- [x] Requirements panel in right sidebar
- [x] Add requirement dialog
- [x] CSV import for bulk requirements
- [x] Framework import (pre-built compliance frameworks)
- [x] Requirement fields: title, description, source document, priority

**UI Location:** `features/requirements/components/RequirementsPanel`

---

### US-17.2: Requirements Coverage Tracking

**As a** compliance officer
**I want to** see which requirements are covered by threats and mitigations
**So that** I can demonstrate compliance

**Implemented Features:**
- [x] Requirements coverage panel
- [x] Coverage status per requirement (covered/uncovered)
- [x] Link requirements to mitigations
- [x] Coverage percentage

**UI Location:** `features/requirements/components/RequirementsCoveragePanel`

---

### US-17.3: Gap Analysis

**As a** security architect
**I want to** see gaps between my requirements and my threat model
**So that** I can prioritize remediation work

**Implemented Features:**
- [x] Gap analysis panel
- [x] Gap-threat row mapping (which gaps relate to which threats)
- [x] Gap analysis API endpoint
- [x] Uncovered requirements list

**UI Location:** `features/requirements/components/GapAnalysisPanel`

---

### US-17.4: Mitigation-to-Requirement Traceability

**As a** compliance officer
**I want to** link mitigations to specific requirements
**So that** auditors can trace controls back to their source requirements

**Implemented Features:**
- [x] Requirement picker in EditMitigationDialog
- [x] Link mitigations to SRS/SAD requirements ({docId, reqId, text})
- [x] Requirements extracted from documents during import using document numbering
- [x] Evidence links on mitigations (ticket, document, screenshot, test report, scan result)

**UI Location:** `features/threats/components/EditMitigationDialog`

---

### US-17.5: User Story Tracker

**As a** development team member
**I want to** manage user stories within my project and link them to threat model elements
**So that** I can trace security requirements from Agile user stories through to threats and mitigations

**Implemented Features:**
- [x] User story CRUD (create, edit, delete) per project
- [x] User story fields: title, description, status (backlog/in-progress/done/cancelled), priority, acceptance criteria
- [x] User story list view with filter by status and priority
- [x] User story editor (inline edit of title, description, acceptance criteria)
- [x] Link user stories to data flow elements (DFD data flows)
- [x] User story status workflow (Backlog → In Progress → Done)
- [ ] **Link user stories to threats and mitigations** — "this threat implements the security acceptance criteria of US-23" traceability
- [ ] **Import user stories from Jira** — fetch Jira issues as user stories with status sync
- [ ] **Import user stories from GitHub Issues** — fetch GitHub issues as user stories
- [ ] **Acceptance criteria coverage** — for each user story, show which acceptance criteria are covered by threats/mitigations

**UI Location:** `features/user-stories/`, `server/src/api/user-stories.ts`

---

## Epic 18: Risk Intelligence

**Location:** `features/risk-dashboard/`, `features/compliance/`, `features/threats/components/Compliance*`

### US-18.1: Risk Dashboard

**As a** product manager
**I want to** see an organization-wide risk dashboard
**So that** I can understand risk posture and communicate to stakeholders

**Implemented Features:**
- [x] Organization-level risk dashboard
- [x] Risk heatmap
- [x] Risk score cards
- [x] Risk trend over time
- [x] STRIDE coverage chart
- [x] Threat distribution visualization
- [x] Top risks list
- [x] Uncovered components list
- [x] Coverage overview

**UI Location:** `features/risk-dashboard/`

---

### US-18.2: Compliance Framework Mapping

**As a** compliance officer
**I want to** see how my threat model maps to compliance frameworks
**So that** I can demonstrate regulatory compliance

**Implemented Features:**
- [x] 12 compliance frameworks (669 controls): HIPAA, PCI-DSS 4.0, NIST 800-53, FDA, SOC 2, ISO 27001, NIST CSF, OWASP ASVS, CMMC, NIST 800-171, ISO 27701, CCPA
- [x] Framework card per framework with coverage percentage
- [x] Coverage bar visualization
- [x] STRIDE category badges per control

**UI Location:** `features/threats/components/ComplianceReport`

---

### US-18.3: Compliance Detail Drill-Down

**As a** compliance officer
**I want to** click into a compliance framework to see every control
**So that** I can identify exactly which controls are covered and which have gaps

**Implemented Features:**
- [x] Full-width dialog per framework
- [x] Every control listed with covered/uncovered status icon
- [x] STRIDE category badges per control
- [x] Linked threats with severity badges
- [x] Linked mitigations with implementation status
- [x] Footer summary: total controls, covered, gaps
- [x] Link to framework documentation

**UI Location:** `features/threats/components/ComplianceDetailDialog`

---

### US-18.4: Threat Coverage Dashboard

**As a** security architect
**I want to** see a coverage dashboard for my model
**So that** I can identify under-protected areas

**Implemented Features:**
- [x] Coverage overview
- [x] Coverage matrix
- [x] Gap list
- [x] Compliance gap cards

**UI Location:** `features/compliance/`

---

### US-18.5: Expanded Compliance Frameworks

**As a** compliance officer
**I want to** map my threat model to additional regulatory and security frameworks beyond the current 12
**So that** ThreatForge covers our specific regulatory obligations without requiring manual mapping

**Background:** ThreatForge currently ships 12 frameworks (669 controls). Competitors IriusRisk and SD Elements have 15–20+. Key missing frameworks identified from customer requests and competitive analysis.

**Implemented Features:**
- [x] 12 frameworks: HIPAA, PCI-DSS 4.0, NIST 800-53, FDA, SOC 2, ISO 27001, NIST CSF, OWASP ASVS, CMMC, NIST 800-171, ISO 27701, CCPA
- [ ] **ISO 27002:2022** — information security controls (distinct from ISO 27001 ISMS; 93 controls in 4 themes): needed by organisations that implement 27001 and want control-level mapping
- [ ] **GDPR Article Mapping** — 99 articles mapped to control types; covers data minimisation, breach notification (72hr), DPO requirements, DPIA obligations; needed for any EU data processing
- [ ] **DORA (EU Digital Operational Resilience Act)** — ICT risk management for financial sector; 5 pillars (ICT risk, incident reporting, resilience testing, third-party risk, information sharing); required for EU banks and financial entities by Jan 2025
- [ ] **SLSA (Supply Chain Levels for Software Artifacts)** — 4 levels of supply chain integrity; maps to build provenance, source control, and dependency controls; needed for teams responding to US EO 14028
- [ ] **NIST SP 800-82 Rev 3** — OT/ICS/SCADA cybersecurity; needed by industrial, energy, and utilities sectors
- [ ] **UK Cyber Essentials Plus** — UK government certification scheme; 5 control areas; needed for UK government contracts
- [ ] **Cloud Security Alliance CCM v4** — 197 controls for cloud providers and customers; overlaps with ISO 27001 but cloud-native

**Acceptance Criteria:**
- GDPR framework added → `POST /api/threat-models/:id/compliance/assess` returns GDPR coverage %
- ISO 27002 controls appear in the Compliance report with linked threats/mitigations
- DORA framework card visible in the Compliance panel for models tagged with `regulatoryScope=DORA`
- A model covering "Breach Notification" threats → GDPR Article 33 shows as "covered" in the GDPR framework

**UI Location:** `features/compliance/`, `server/prisma/schema/20-compliance.prisma` (new framework seed data)

---

## Epic 19: AI Personalization & Pipelines

**Location:** `features/prompt-library/`, `app/(app)/profile/`, `server/src/services/ai/`

### US-19.1: AI Writing Style Preferences

**As a** security architect
**I want to** configure how AI writes threats and mitigations in my preferred style
**So that** AI output matches my organization's tone and documentation standards

**Implemented Features:**
- [x] Separate threat and mitigation writing style configuration
- [x] Enable/disable toggle per style
- [x] Tone selector: formal, concise, detailed, conversational
- [x] Free-text examples field for each style
- [x] Styles stored in user preferences (no schema migration needed)
- [x] Styles injected into universal system prompt during AI execution
- [x] Backwards-compatible with older single-style format

**UI Location:** `/profile` → AI Style tab

---

### US-19.2: Prompt Template Library

**As an** organization admin
**I want to** create and manage reusable AI prompt templates
**So that** my team uses consistent, tested prompts for threat analysis

**Implemented Features:**
- [x] Prompt editor with template variables
- [x] Built-in and custom prompts per organization
- [x] Document type detection with automatic prompt selection
- [x] System prompts hidden from non-admin users (security)
- [x] Clone prompts (user prompts only, system prompt excluded)
- [x] Usage statistics per prompt
- [x] Execution logging

**UI Location:** `features/prompt-library/`

---

### US-19.3: Multi-Stage AI Pipelines

**As an** expert user
**I want to** define multi-stage AI pipelines
**So that** I can chain analysis steps with variable passing between stages

**Implemented Features:**
- [x] Pipeline builder UI
- [x] Stage cards with ordering
- [x] Variable mapping between stages
- [x] Pipeline execution viewer
- [x] Pipeline settings (model, temperature, etc.)
- [x] Execution logging
- [~] End-to-end pipeline execution wired to threat model context (in progress — backend API exists; frontend execution trigger not fully wired)
- [ ] **Threat-specific built-in pipeline stages**: Extract → Analyze → Score → Mitigate — pre-built stage library a user can drag into their pipeline
- [ ] **Pipeline variables from diagram**: built-in variables `{{component.name}}`, `{{component.type}}`, `{{connections}}`, `{{trust_boundaries}}`, `{{existing_threats}}` available in all stage prompts
- [ ] **Per-stage AI model selection**: different stages can use different providers (e.g., fast model for extraction, powerful model for analysis)
- [ ] **Conditional stages**: a stage only runs if the previous stage's output matches a condition (e.g., only run compliance mapping if threat count > 5)
- [ ] **Pipeline sharing**: org admins can share pipelines with all org members; personal pipelines remain private

**UI Location:** `features/prompt-library/` (Pipeline tab)

---

### US-19.4: Universal System Prompt

**As a** platform admin
**I want to** enforce a universal system prompt across all AI executions
**So that** AI behavior is consistent and protected against prompt injection

**Implemented Features:**
- [x] Central system prompt with security guardrails
- [x] Anti-injection instructions baked in
- [x] Task-specific addenda per AI feature
- [x] User writing style injected when configured

**UI Location:** Backend `server/src/services/ai/universal-system-prompt.ts`

---

### US-19.5: Per-User Analysis Scope Configuration

**As any** user
**I want to** configure the scope and depth of AI threat analysis for my personal workflow
**So that** I can get fast results when I need a quick check, or comprehensive results when I need thoroughness

**Implemented Features:**
- [x] AI provider selection per user (which provider to use for analysis)
- [x] Writing style preferences (tone, examples) per user
- [ ] **Analysis depth preset** per user: Quick / Standard / Deep
  - Quick: 1 pass, STRIDE only, top 3 threats per component, no mitigation generation
  - Standard: 3 passes, STRIDE + PASTA, up to 5 threats per component, 2 mitigations per threat
  - Deep: full 6-pass expert pipeline, all methodologies, unlimited threats, full mitigation generation
- [ ] **Category filter**: user can exclude specific STRIDE/PASTA categories from their personal analysis (e.g., "never suggest Repudiation threats for my models")
- [ ] **Component scope**: user can set default to "analyze only components I've marked as in-scope" vs "analyze all components"
- [ ] **Auto-run preference**: whether AI analysis triggers automatically when a model is opened, or only on explicit user request
- [ ] These preferences are per-user (stored in user profile), not org-level

**Acceptance Criteria:**
- User sets depth preset to "Quick" → next "Suggest Threats" run completes in < 30 seconds and returns ≤ 3 threats per component
- User sets STRIDE category filter to exclude Repudiation → no Repudiation threats appear in AI suggestions
- User sets auto-run ON → when opening a model that hasn't been analyzed in > 7 days, analysis starts automatically in background

**UI Location:** `/profile` → AI Analysis tab

---

### US-19.6: Threat Recipe Builder

**As an** expert user
**I want to** create a named, reusable sequence of AI analysis operations
**So that** I can run my personal threat modeling workflow on any model with one click

**Background:** An expert might have a specific workflow: (1) extract architecture from any docs, (2) suggest STRIDE threats per component, (3) check against their org's compliance framework, (4) generate mitigations scoped to their tech stack. A "recipe" captures this as a reusable definition.

**Implemented Features:**
- [~] Pipeline builder (existing — in progress for threat model context wiring)
- [ ] **Recipe library** in user profile: create, name, edit, delete personal recipes
- [ ] **Recipe steps**: ordered list of AI operations, each with a prompt template reference and scope (all components / selected / external-facing only)
- [ ] **Built-in step library**: "Extract from Documents", "STRIDE Threat Suggestions", "Expert Analysis", "CVSS Scoring", "Mitigation Generation", "Compliance Mapping", "Citation Verification"
- [ ] **Run recipe button** on canvas: select a recipe from dropdown → runs steps in sequence, showing progress per step
- [ ] **Recipe output summary**: after run, shows: X threats generated, Y mitigations suggested, Z compliance gaps found
- [ ] **Org-shared recipes**: org admin can promote a personal recipe to org-level (shared with all members)
- [ ] **Recipe version history**: track changes to a recipe over time (same pattern as threat model versioning)

**Acceptance Criteria:**
- User creates a recipe with 3 steps: "STRIDE Threats" → "CVSS Scoring" → "Mitigation Generation"; runs it → all 3 steps execute in order; progress indicator shows current step
- User shares recipe to org → it appears in the "Run Recipe" dropdown for all org members
- Recipe fails at step 2 (AI error) → steps 1's results are preserved; error shown for step 2; user can retry from step 2

**UI Location:** `features/prompt-library/` → Recipes tab; canvas toolbar "Run Recipe" button

---

### US-19.7: Analysis Configuration & Guardrails

**As an** organization admin
**I want to** configure what AI can and cannot do when analyzing threat models in our org
**So that** AI behavior is predictable, compliant with our security policies, and appropriate for our users' skill levels

**Implemented Features:**
- [x] Universal system prompt with anti-injection guardrails
- [x] AI provider configuration per org (which providers members can use)
- [ ] **Minimum analysis depth**: org admin sets a floor (e.g., all members must use at least "Standard" depth; Quick is disabled)
- [ ] **Required categories**: admin mandates that specific STRIDE/PASTA categories are always included (can't be excluded by user scope filter)
- [ ] **Output format rules**: admin can require that all AI-generated threats include CWE references, or that CVSS scores are always populated
- [ ] **Prohibited content filter**: org-configurable list of topics the AI should not include in threat descriptions (e.g., for classified environments, don't mention specific technology names)
- [ ] **Max tokens budget per analysis**: org admin sets a cap to control AI API costs
- [ ] **Rate limiting**: max AI analysis runs per user per day (to prevent runaway usage)

**Acceptance Criteria:**
- Org admin sets minimum depth to "Standard" → individual user's "Quick" preset is overridden; Quick option grayed out in UI
- Org admin enables required CWE references → all AI-generated threats that don't have a CWE are flagged for review after analysis
- Rate limit set to 5 runs/day → on the 6th attempt, user sees "Daily analysis limit reached" message

**UI Location:** `/admin/settings` → AI tab

---

## Epic 20: Platform Extensibility

**Location:** `features/marketplace/`, `features/customization/`

### US-20.1: Extensions — REMOVED (2026-10-07)

The extensions registry/install/actions feature was removed: its UI was never
rendered and its actions posted decrypted install credentials to arbitrary
endpoints. The `Extension*` Prisma models remain only to avoid a destructive
migration.

---

### US-20.2: Marketplace

**As a** user
**I want to** browse a marketplace of templates and libraries
**So that** I can reuse community content

**Implemented Features:**
- [x] Marketplace browser
- [x] Library cards with metadata
- [x] Search and filter

**UI Location:** `features/marketplace/`

---

### US-20.3: Custom Threat Categories & Mitigation Libraries

**As an** organization admin
**I want to** define custom threat categories and mitigation libraries
**So that** our threat modeling uses our organization's taxonomy

**Implemented Features:**
- [x] Custom categories panel with add/edit/delete
- [x] Mitigation libraries panel
- [x] Mitigation templates panel
- [x] Template dialog for creating reusable mitigations

**UI Location:** `features/customization/`

---

### US-20.4: Component Templates

**As a** security architect
**I want to** save and reuse component templates
**So that** I can quickly build models with common architecture patterns

**Implemented Features:**
- [x] Component template browser
- [x] Component template manager (create, edit, delete)
- [x] Template libraries with grouping
- [x] Save model as template

**UI Location:** `features/component-templates/`, `features/model-templates/`

---

## Epic 21: Version History & Change Tracking

**Location:** `features/version-history/`, `server/src/api/versions.ts`, `server/src/services/versioning/`

### US-21.1: Create Version Snapshots

**As a** security architect
**I want to** save named version snapshots of my threat model
**So that** I can track changes over time and revert if needed

**Implemented Features:**
- [x] Create version with optional name and changes summary
- [x] Auto-incrementing version numbers
- [x] Canvas state captured as JSON
- [x] Document IDs captured for evidence traceability
- [x] Canvas synced to normalized tables on version creation

**UI Location:** `features/version-history/`

---

### US-21.2: Compare Versions

**As a** security architect
**I want to** compare two versions side by side
**So that** I can see what changed between iterations

**Implemented Features:**
- [x] Version comparison dialog
- [x] Structured diff: components added/removed/modified
- [x] Connection changes
- [x] Threat and mitigation changes
- [x] Diff API endpoint

**UI Location:** `features/version-history/components/VersionCompareDialog`

---

### US-21.3: Restore Version

**As a** user
**I want to** restore a previous version
**So that** I can revert to a known-good state

**Implemented Features:**
- [x] Restore from any previous version
- [x] Current state auto-saved before restore
- [x] New version created for the restore
- [x] Canvas synced to normalized tables after restore

**UI Location:** Version history panel

---

## Epic 22: Connection Intelligence & Security Semantics

**Location:** `components/canvas/edges/`, `features/proactive-ai/`, `server/src/services/ai/`

*This epic covers how connection security properties are captured, displayed, and used to drive threat generation. It documents the "security language" of the canvas — how every data flow communicates protocol, authentication, authorization, and data classification to both human reviewers and the AI analysis pipeline.*

---

### US-22.1: Connection Security Vocabulary

**As a** security architect
**I want to** have a complete, structured vocabulary for describing every data flow's security properties
**So that** my threat model precisely captures the authentication, authorization, and data semantics of each connection

**Implemented Features:**
- [x] Protocol: HTTP, HTTPS, gRPC, WebSocket, TCP, UDP, AMQP, MQTT, Kafka, PostgreSQL, MySQL, MongoDB, Redis, SSH, SFTP, Custom
- [x] Authentication method: None, API_KEY, JWT, OAuth2, mTLS, Basic, SAML, Custom
- [x] Encryption indicator (boolean — encrypted or not)
- [x] Data flow direction: source→target, target→source, bidirectional
- [ ] **Authorization model** (the second A in A&A): None, RBAC, ACL, Scope-based (OAuth scopes), ABAC, Custom — separate from authentication; describes *who can do what* not *who are you*
- [ ] **Data classifications on connection**: PII, PHI, Financial, Credentials, Internal, Public — multi-select; what types of data traverse this flow
- [ ] **Port number**: specific port (e.g., 443, 5432, 8080, 6379)
- [ ] **TLS version**: TLS 1.2, TLS 1.3, None — relevant for compliance (PCI-DSS requires TLS 1.2+)
- [ ] **Connection type**: synchronous request/response, async event, streaming, batch — affects threat patterns
- [ ] **Rate limiting**: documented max requests/second (relevant for DoS threat assessment)

**Acceptance Criteria:**
- All connection properties are saveable and retrievable via API
- AI expert analysis receives the full connection vocabulary (auth method, authorization model, data classifications, TLS version) as context for threat generation
- A connection with data classification=PII and TLS version=None → AI automatically generates an Information Disclosure threat
- Authorization model "None" on a connection from External Entity to any internal component → proactive warning

**UI Location:** Edge properties panel (right sidebar)

---

### US-22.2: Connection-to-Threat Intelligence

**As a** security architect
**I want to** the AI to use connection security properties when generating threats
**So that** threats are specific to the actual protocol and authentication failure modes, not generic

**Implemented Features:**
- [x] AI context builders include component types and connection labels
- [x] Micro-analysis pipeline passes sequence diagram flows into per-component prompts
- [ ] **Protocol-specific threat templates**: when protocol=HTTP (unencrypted), AI prioritizes Information Disclosure and Man-in-the-Middle threats; when protocol=WebSocket, AI considers connection hijacking; when protocol=Kafka, AI considers topic poisoning and message replay
- [ ] **Auth-specific failure modes**: when auth=JWT, AI generates token forgery and algorithm confusion threats; when auth=mTLS, AI generates certificate pinning bypass and revocation failures; when auth=None on boundary connection → guaranteed Spoofing + Elevation of Privilege threat suggestions
- [ ] **Data classification threats**: when dataClassification includes PII → AI generates GDPR/HIPAA-relevant threats (data residency, breach notification window, data minimization); when Financial → PCI-DSS specific threats
- [ ] **Authorization gap detection**: when authorizationModel=None on a connection to a sensitive component (RESTRICTED trust zone) → AI flags as a missing control, suggests adding RBAC

**Acceptance Criteria:**
- Connection with protocol=HTTP, auth=None, data=PII → AI suggestions include at minimum: Information Disclosure (unencrypted PII), Spoofing (no authentication), Man-in-the-Middle
- Connection with protocol=WebSocket → AI suggestions include WebSocket-specific threats not generated for HTTP connections
- Connection with auth=JWT → AI suggests JWT-specific threats (alg:none attack, token expiry not enforced)

**UI Location:** AI suggestion pipeline (backend) — no direct UI, drives AI output quality

---

### US-22.3: Security Label Auto-Generation

**As a** user
**I want to** the connection text label to be automatically suggested based on the security properties I set
**So that** my diagram is self-documenting without manual label entry

**Implemented Features:**
- [x] Protocol and auth pills auto-rendered from data fields (separate from text label)
- [x] User-editable text label (independent of pills)
- [ ] **Auto-suggest label**: when a connection has no text label and protocol + auth are set, suggest a label like "HTTPS · mTLS" or "Kafka (SASL)" as a ghost text placeholder
- [ ] **"Use suggested label" button**: one-click to accept the auto-suggested label as the actual text label
- [ ] **Label format templates**: org admin configures the format (e.g., "{protocol} | {auth}" or "{protocol}/{port} [{auth}]")
- [ ] **A&A annotation mode**: org admin can enable "A&A mode" where all labels are automatically formatted as "{protocol} · {authMethod} · {authzModel}" (the three-part A&A annotation)
- [ ] When A&A annotation mode is enabled, the text label syncs automatically when protocol/auth/authz model changes (with a warning before overwriting user-typed labels)

**Acceptance Criteria:**
- Connection with protocol=HTTPS, auth=mTLS, no existing text label → ghost text "HTTPS · mTLS" appears in the label area
- User clicks "Use suggested" → text label becomes "HTTPS · mTLS"
- A&A annotation mode ON + connection has protocol=HTTPS, auth=OAuth2, authz=RBAC → label reads "HTTPS · OAuth2 · RBAC" automatically
- User has manually set a label "Payment Flow" → A&A mode update shows warning before overwriting

**UI Location:** Edge label area, canvas settings

---

### US-22.4: Connection Security Baseline

**As an** organization admin
**I want to** define minimum security requirements for connections in our org's threat models
**So that** models that don't meet our standards are flagged before review or export

**Implemented Features:**
- [ ] **Security baseline rules** per org (admin-configurable):
  - "All connections crossing trust boundaries must have auth ≠ None"
  - "All connections carrying PII must use HTTPS or equivalent encrypted protocol"
  - "No connection may use auth=Basic in RESTRICTED zones"
  - "TLS version must be 1.2 or higher on all external connections"
- [ ] **Baseline check on export**: running a PDF or CSV export triggers a baseline check; violations shown in a pre-export dialog ("3 connections violate your org's security baseline — export anyway?")
- [ ] **Baseline check in CI**: `GET /api/threat-models/:id/baseline-check` returns pass/fail + violation list; integrates with CI scan endpoint
- [ ] **Baseline rule editor**: admin UI to define rules using a structured rule builder (not free-text)
- [ ] Violation badges on connections in the canvas (shown when overlay is ON)

**Acceptance Criteria:**
- Org rule: "boundary connections must have auth ≠ None" → connection with auth=None crossing a boundary shows a rule violation badge
- User attempts PDF export with 2 violations → dialog shows "2 baseline violations: [list]"; user can export anyway or go fix
- CI endpoint returns `{ passed: false, violations: [...] }` for a model with rule violations

**UI Location:** `/admin/settings` → Security Baseline tab; canvas overlay; export flow

---

## Appendix A: Notification System

**Location:** `features/notifications/`

### US-A.1: Notifications

**As a** user
**I want to** receive notifications about model changes, reviews, and team activity
**So that** I stay informed without checking manually

**Implemented Features:**
- [x] Notification center
- [x] Notification list with items
- [x] In-app notification display

**UI Location:** `features/notifications/`

---

## Appendix B: Security Scanner Integration

**Location:** `features/scanners/`

### US-B.1: Security Scanner Results

**As a** DevOps engineer
**I want to** import SAST/DAST/SCA scanner results
**So that** vulnerability findings are connected to my threat model

**Implemented Features:**
- [x] Scanner configuration dialog
- [x] Findings cards with details
- [x] Findings statistics
- [x] Scanner panel in right sidebar

**UI Location:** `features/scanners/`

---

## Appendix C: Encryption

**Location:** `features/encryption/`

### US-C.1: End-to-End Encryption

**As a** security-conscious organization
**I want to** enable end-to-end encryption for sensitive threat models
**So that** data is protected even from platform administrators

**Implemented Features:**
- [x] Encryption panel
- [x] Key registration dialog
- [x] Encryption service on backend

**UI Location:** `features/encryption/`

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 4.3 | May 2026 | US-12.6 fully documented (9 scopes, 15 webhook events, v1 API surface, CI scan, Swagger UI, read-only gap noted); US-12.10 Developer Platform & SDK (Python/Node SDK, webhook retry, write-via-token, developer portal, versioning contract, additional webhook events) |
| 4.2 | May 2026 | US-4.6/4.7 corrected to [x] — all 6 risk calculators confirmed fully implemented (CVSS 3.1, CVSS 4.0, CIA Triad, DREAD, OWASP Risk Rating, FAIR); US-4.8 added for DREAD/OWASP/FAIR; US-4.1 CIA/CVSS references corrected to [x]; US-11.5 account lockout; US-12.7 GitHub Actions; US-12.8 Azure DevOps; US-12.9 ServiceNow; US-13.8 questionnaire-based entry (SD Elements parity); US-18.5 expanded compliance frameworks (ISO 27002, GDPR, DORA, SLSA, NIS 800-82, UK Cyber Essentials, CSA CCM); desktop/offline removed from roadmap (not planned) |
| 4.1 | May 2026 | US-3.6 expanded with all V1 Lucidchart parity features (lock, format painter, arrow nudge, match size, select inverse/same-type, alt-drag, alignment guides, zoom indicator, status chip, coverage indicator); US-3.9–3.15 added (quick connect, waypoints+label positioning, rich text [planned], swimlanes [planned], layers [planned], presentation mode [planned], visual richness [planned]); US-12.3 updated with MS TMT/.tm7, OWASP Dragon, Threagile, YAML round-trip; US-17.5 added (User Story Tracker product feature) |
| 4.0 | May 2026 | Added Epic 22 (Connection Intelligence); US-3.4 fully documented with LL1-LL4 pill behavior; US-3.7/3.8 (connection A&A + security overlay); US-4.6/4.7 (CIA triad + CVSS 3.1/4.0); US-13.5/13.6/13.7 (smart suggestions, proactive warnings, posture score); US-19.3 marked in-progress; US-19.5/19.6/19.7 (per-user analysis scope, recipe builder, guardrails); `[~]` status added for in-progress stories |
| 3.0 | Apr 2026 | Major update: added Epics 15-21, fixed accuracy (mitigation status model, guest access), added personas (Paula, Derek), multi-methodology support, 50+ new stories |
| 2.0 | Dec 2025 | Complete rewrite from implemented source code |
| 1.0 | Nov 2025 | Initial MVP user stories |

---

## Related Documents

- User Personas — Detailed persona profiles
- [User Flows](../design/USER_FLOWS.md) — Visual user journey diagrams
- User Research — Research findings and JTBD
- [Features Guide](../FEATURES.md) — Technical feature documentation
- [API Reference](../API_REFERENCE.md) — API endpoints

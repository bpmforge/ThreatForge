# User Flows

This document describes the key user journeys through ThreatForge.

---

## 1. First-Time User Onboarding

**Persona:** Junior Developer James

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           ONBOARDING FLOW                                    │
└─────────────────────────────────────────────────────────────────────────────┘

[Landing Page] ──→ [Sign Up] ──→ [Email Verification] ──→ [Welcome Screen]
                                                                  │
                                                                  ▼
                                                    ┌─────────────────────────┐
                                                    │  Experience Level?      │
                                                    │  ○ New to threat model  │
                                                    │  ○ Some experience      │
                                                    │  ● Security expert      │
                                                    └─────────────────────────┘
                                                                  │
                     ┌────────────────────────────────────────────┼────────────┐
                     ▼                                            ▼            ▼
            [Guided Tutorial]                              [Quick Start]  [Skip to Dashboard]
            - STRIDE intro                                 - Template     - Empty canvas
            - Add component                                - Pre-filled   - Full control
            - Add threat                                   - Guided
            - Add mitigation
                     │
                     ▼
            [First Model Complete]
                     │
                     ▼
               [Dashboard]
```

### Steps:

1. **Landing Page** - Value proposition, "Start Free" CTA
2. **Sign Up** - Email/password or OAuth (Google, GitHub)
3. **Email Verification** - Confirm email (optional skip for OAuth)
4. **Welcome Screen** - Personal org auto-created
5. **Experience Level** - Determines default UI complexity
6. **Path Selection:**
   - New: Guided tutorial with STRIDE teaching
   - Some: Start from template
   - Expert: Empty canvas, full feature access
7. **Dashboard** - Home base after onboarding

---

## 2. Creating a Threat Model

**Persona:** Security Architect Sarah

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        CREATE THREAT MODEL FLOW                              │
└─────────────────────────────────────────────────────────────────────────────┘

[Dashboard] ──→ [+ New Model] ──→ [Create Dialog]
                                       │
                                       ▼
                          ┌────────────────────────┐
                          │  Name: "Payment API"   │
                          │  Project: [Select ▼]   │
                          │  Template: [Optional]  │
                          │  [Create]              │
                          └────────────────────────┘
                                       │
                                       ▼
                              [Canvas Editor]
                                       │
              ┌────────────────────────┼────────────────────────┐
              ▼                        ▼                        ▼
    [Component Palette]         [Canvas Area]           [Properties Panel]
    - Drag components           - Drop zone             - Edit selected
    - Search types              - Connect nodes         - Add details
    - Cloud services            - Create boundaries
              │                        │
              └────────────────────────┤
                                       ▼
                            [Add Threats to Components]
                                       │
              ┌────────────────────────┼────────────────────────┐
              ▼                        ▼                        ▼
       [Manual Add]           [From Library]            [AI Suggest]
       - STRIDE select        - Browse threats          - Analyze diagram
       - Set severity         - Filter by type          - Review suggestions
       - Link to component    - Apply to component      - Accept/dismiss
                                       │
                                       ▼
                              [Add Mitigations]
                                       │
                                       ▼
                              [Save / Auto-save]
                                       │
                                       ▼
                              [Export / Share]
```

### Key Interactions:

| Action | Trigger | Result |
|--------|---------|--------|
| Add component | Drag from palette | Node appears on canvas |
| Connect | Drag between handles | Edge created |
| Create boundary | Drag boundary, resize | Group node |
| Add threat | Right-click → Add Threat | Threat dialog |
| AI suggest | Select component → AI button | Suggestions panel |
| Save | Ctrl+S or auto (2s debounce) | Saved indicator |

---

## 3. AI Threat Suggestion Flow

**Persona:** Junior Developer James

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         AI SUGGESTION FLOW                                   │
└─────────────────────────────────────────────────────────────────────────────┘

[Select Component(s)] ──→ [Click "AI Suggest"] ──→ [Loading State]
                                                          │
                                                          ▼
                                              ┌───────────────────────┐
                                              │  Analyzing:           │
                                              │  • Component type     │
                                              │  • Connections        │
                                              │  • Trust boundaries   │
                                              │  [████████░░] 80%     │
                                              └───────────────────────┘
                                                          │
                                                          ▼
                                              ┌───────────────────────┐
                                              │  5 Threats Suggested  │
                                              │                       │
                                              │  ☐ SQL Injection      │
                                              │    STRIDE: T, I       │
                                              │    Severity: High     │
                                              │    [Accept] [Dismiss] │
                                              │                       │
                                              │  ☐ Auth Bypass        │
                                              │    STRIDE: S, E       │
                                              │    ...                │
                                              └───────────────────────┘
                                                          │
                                    ┌─────────────────────┼─────────────────────┐
                                    ▼                     ▼                     ▼
                              [Accept All]          [Accept Some]         [Dismiss All]
                                    │                     │
                                    ▼                     ▼
                              [Threats Added to Model]
                                    │
                                    ▼
                              [Suggest Mitigations?]
                                    │
                                    ▼
                              [Mitigation Suggestions]
```

### AI Provider Flow:

```
User Request ──→ Frontend ──→ Backend API ──→ Provider Manager
                                                    │
                    ┌───────────────────────────────┼───────────────────────────────┐
                    ▼                               ▼                               ▼
              [Claude API]                   [OpenAI API]                    [Ollama Local]
                    │                               │                               │
                    └───────────────────────────────┼───────────────────────────────┘
                                                    ▼
                                              [Parse Response]
                                                    │
                                                    ▼
                                              [Return Threats]
```

---

## 4. Collaboration Flow

**Persona:** Security Architect Sarah + Team

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          COLLABORATION FLOW                                  │
└─────────────────────────────────────────────────────────────────────────────┘

                              [Owner: Sarah]
                                    │
                    ┌───────────────┴───────────────┐
                    ▼                               ▼
            [Invite Team]                    [Share Link]
                    │                               │
                    ▼                               ▼
        ┌─────────────────────┐         ┌─────────────────────┐
        │ Invite Member       │         │ Guest Access        │
        │ Email: [          ] │         │ Link: [Copy]        │
        │ Role: [Editor ▼]    │         │ Role: [Viewer ▼]    │
        │ [Send Invite]       │         │ Expires: [7 days]   │
        └─────────────────────┘         └─────────────────────┘
                    │                               │
                    ▼                               ▼
            [Email Sent]                    [Link Generated]
                    │                               │
                    ▼                               ▼
        [Teammate Accepts]              [Guest Opens Link]
                    │                               │
                    └───────────────┬───────────────┘
                                    ▼
                          [Real-Time Session]
                                    │
              ┌─────────────────────┼─────────────────────┐
              ▼                     ▼                     ▼
        [Sarah's View]        [James's View]        [Guest View]
        - Full access         - Edit access          - Read only
        - See cursors         - See cursors          - See cursors
        - All features        - Most features        - Limited export
```

### Real-Time Sync (Yjs):

```
[User A Edit] ──→ [Local Yjs Doc] ──→ [WebSocket] ──→ [Server]
                                                          │
                                                          ▼
                                                      [Redis Pub/Sub]
                                                          │
                    ┌─────────────────────────────────────┼─────────────────────────────────────┐
                    ▼                                     ▼                                     ▼
              [User B]                              [User C]                              [User D]
              [Apply Update]                        [Apply Update]                        [Apply Update]
```

---

## 5. Export & Reporting Flow

**Persona:** Compliance Officer Carlos

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           EXPORT FLOW                                        │
└─────────────────────────────────────────────────────────────────────────────┘

[Canvas Editor] ──→ [Export Button] ──→ [Format Selection]
                                              │
              ┌───────────────────────────────┼───────────────────────────────┐
              ▼                               ▼                               ▼
        [PDF Report]                    [Data Export]                  [Image Export]
              │                               │                               │
              ▼                               ▼                               ▼
    ┌─────────────────┐             ┌─────────────────┐             ┌─────────────────┐
    │ Options:        │             │ Format:         │             │ Format:         │
    │ ☑ Diagram       │             │ ○ JSON          │             │ ○ PNG           │
    │ ☑ Threat Table  │             │ ● YAML          │             │ ● SVG           │
    │ ☑ Mitigations   │             │ ○ Mermaid       │             │                 │
    │ ☑ Compliance    │             │ ○ Draw.io       │             │ Resolution:     │
    │ ☑ STRIDE Chart  │             │                 │             │ [2x ▼]          │
    │ [Generate PDF]  │             │ [Download]      │             │ [Download]      │
    └─────────────────┘             └─────────────────┘             └─────────────────┘
              │                               │                               │
              ▼                               ▼                               ▼
    [Browser Print Dialog]          [File Downloaded]               [File Downloaded]
              │
              ▼
    [Save as PDF / Print]
```

### PDF Report Contents:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  THREAT MODEL REPORT                                              Page 1   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Model: Payment API Security                                                │
│  Version: 3                                                                 │
│  Status: In Review                                                          │
│  Last Updated: December 30, 2025                                            │
│  Author: Sarah Security                                                     │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  [Architecture Diagram Image]                                               │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  THREAT SUMMARY                                                             │
│  ┌─────────┬─────────┬────────┬────────┬────────┐                          │
│  │ Total   │ Critical│ High   │ Medium │ Low    │                          │
│  │ 15      │ 2       │ 5      │ 6      │ 2      │                          │
│  └─────────┴─────────┴────────┴────────┴────────┘                          │
│                                                                             │
│  [STRIDE Pie Chart]                                                         │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  DETAILED THREATS                                                           │
│                                                                             │
│  1. SQL Injection (Critical)                                                │
│     Component: Database                                                     │
│     STRIDE: Tampering, Information Disclosure                               │
│     CWE: CWE-89                                                             │
│     Status: Mitigated                                                       │
│     Mitigations:                                                            │
│       - Use parameterized queries (Completed)                               │
│       - Input validation (In Progress)                                      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 6. CI/CD Integration Flow

**Persona:** DevOps Engineer Derek

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          CI/CD INTEGRATION FLOW                              │
└─────────────────────────────────────────────────────────────────────────────┘

[Settings] ──→ [API Keys] ──→ [Generate CI Key]
                                     │
                                     ▼
                          ┌─────────────────────┐
                          │ API Key Created     │
                          │ ftm_xxxxxxxx...     │
                          │ [Copy to Clipboard] │
                          └─────────────────────┘
                                     │
                                     ▼
                          [Add to CI Secrets]
                                     │
                                     ▼
                    ┌────────────────────────────────────┐
                    │  .github/workflows/security.yml    │
                    │                                    │
                    │  - name: Threat Model Scan         │
                    │    run: ftm validate model.yaml    │
                    │      --fail-on HIGH                │
                    └────────────────────────────────────┘
                                     │
                                     ▼
                              [PR Created]
                                     │
                                     ▼
                          [CI Pipeline Runs]
                                     │
                                     ▼
                          [API Call to Flow TM]
                                     │
                    ┌────────────────┴────────────────┐
                    ▼                                 ▼
            [No Issues Found]               [Issues Found]
                    │                                 │
                    ▼                                 ▼
            [✓ Check Passed]                [✗ Check Failed]
                                                     │
                                                     ▼
                                          [PR Comment Posted]
                                          ┌─────────────────────┐
                                          │ ⚠️ 3 threats found  │
                                          │ • 1 Critical        │
                                          │ • 2 High            │
                                          │ [View Details]      │
                                          └─────────────────────┘
```

---

## 7. Version History Flow

**Persona:** Security Architect Sarah

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        VERSION HISTORY FLOW                                  │
└─────────────────────────────────────────────────────────────────────────────┘

[Canvas Editor] ──→ [Version History Button] ──→ [Version Panel]
                                                       │
                                                       ▼
                                        ┌─────────────────────────┐
                                        │ VERSION HISTORY         │
                                        │                         │
                                        │ v5 - Current            │
                                        │ "Added auth threats"    │
                                        │ Sarah, 2 hours ago      │
                                        │                         │
                                        │ v4                      │
                                        │ "Added payment flow"    │
                                        │ James, yesterday        │
                                        │ [View] [Restore]        │
                                        │                         │
                                        │ v3                      │
                                        │ ...                     │
                                        └─────────────────────────┘
                                                       │
                              ┌────────────────────────┼────────────────────────┐
                              ▼                        ▼                        ▼
                        [View Version]          [Compare Versions]        [Restore Version]
                              │                        │                        │
                              ▼                        ▼                        ▼
                    [Read-only Canvas]        [Diff View]              [Confirm Dialog]
                                              (nodes added/removed)           │
                                                                              ▼
                                                                    [Canvas Restored]
                                                                    [New Version Created]
```

---

## Mobile/Responsive Considerations

```
Desktop (1200px+)           Tablet (768-1200px)         Mobile (< 768px)
┌─────┬─────────┬─────┐    ┌─────────────┬─────┐       ┌─────────────┐
│Palet│ Canvas  │Props│    │   Canvas    │Props│       │   Canvas    │
│ ette│         │     │    │             │(tab)│       │  (touch)    │
│     │         │     │    │             │     │       │             │
│     │         │     │    ├─────────────┴─────┤       ├─────────────┤
│     │         │     │    │    Palette (tab)  │       │ Bottom Nav  │
└─────┴─────────┴─────┘    └───────────────────┘       └─────────────┘

Full 3-column layout        Collapsible panels          View-only mode
                            Touch-friendly              Full edit on tablet+
```

---

*User flows should be validated with usability testing and updated based on analytics.*

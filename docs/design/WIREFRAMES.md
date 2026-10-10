# Wireframes & Visual Design

This document describes the UI layouts and visual design specifications for ThreatForge.

---

## Design Tool Links

> **Note:** Replace these placeholders with actual design tool links.

| Asset | Link | Status |
|-------|------|--------|
| Figma Design System | `[Add Figma link]` | Pending |
| Component Library | `[Add Storybook link]` | Pending |
| Icon Set | Lucide Icons | Active |
| Color Palette | See below | Active |

---

## Layout Wireframes

### 1. Dashboard Layout

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  ┌─────────┐                                              [?] [🔔] [👤 Sarah ▼] │
│  │  LOGO   │  Dashboard                                                         │
├──┴─────────┴────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ┌──────────────┐  ┌─────────────────────────────────────────────────────────┐  │
│  │ 📊 Dashboard │  │                                                         │  │
│  │              │  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐       │  │
│  │ 📁 Projects  │  │  │ Models  │ │ Threats │ │  Open   │ │ Recent  │       │  │
│  │              │  │  │   24    │ │   156   │ │   42    │ │ Activity│       │  │
│  │ 📚 Libraries │  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘       │  │
│  │              │  │                                                         │  │
│  │ ⚙️ Settings  │  │  RECENT MODELS                          [+ New Model]  │  │
│  │              │  │  ┌─────────────────────────────────────────────────┐   │  │
│  │              │  │  │ ┌───────┐ ┌───────┐ ┌───────┐ ┌───────┐        │   │  │
│  │              │  │  │ │ Model │ │ Model │ │ Model │ │ Model │  ...   │   │  │
│  │              │  │  │ │ Card  │ │ Card  │ │ Card  │ │ Card  │        │   │  │
│  │              │  │  │ └───────┘ └───────┘ └───────┘ └───────┘        │   │  │
│  │              │  │  └─────────────────────────────────────────────────┘   │  │
│  │              │  │                                                         │  │
│  │              │  │  ACTIVITY                              STRIDE BREAKDOWN │  │
│  │              │  │  ┌───────────────────────┐             ┌─────────────┐  │  │
│  │              │  │  │ • Sarah edited...     │             │  [Pie Chart]│  │  │
│  │              │  │  │ • James added...      │             │             │  │  │
│  │              │  │  │ • Model exported...   │             │             │  │  │
│  │              │  │  └───────────────────────┘             └─────────────┘  │  │
│  └──────────────┘  └─────────────────────────────────────────────────────────┘  │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

**Specifications:**
- Sidebar: 240px fixed width, collapsible to 64px (icons only)
- Stats cards: 4-column grid, responsive to 2x2 on tablet
- Model cards: Minimum 280px width, auto-fill grid

---

### 2. Canvas Editor Layout

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  [←] Payment API Security           [💾 Saved] [↩️] [↪️]  [📤 Export ▼] [👥 2]  │
├─────────────────────────────────────────────────────────────────────────────────┤
│  │ Architecture │ Sequence │ DFD │                              [+ Add Diagram] │
├──┴──────────────┴──────────┴─────┴──────────────────────────────────────────────┤
│                                                                                 │
│  ┌────────────┐  ┌───────────────────────────────────────────┐  ┌────────────┐ │
│  │ PALETTE    │  │                                           │  │ PROPERTIES │ │
│  │            │  │                                           │  │            │ │
│  │ 🔍 Search  │  │        ┌─────────────────────┐            │  │ API Gateway│ │
│  │            │  │        │   Trust Boundary    │            │  │            │ │
│  │ ▼ DFD      │  │        │   ┌───────┐         │            │  │ Type:      │ │
│  │   Actor    │  │        │   │ API   │─────────┼────→       │  │ [AWS_ALB ▼]│ │
│  │   Process  │  │        │   │Gateway│         │            │  │            │ │
│  │   Store    │  │        │   └───┬───┘         │            │  │ Trust:     │ │
│  │            │  │        │       │             │            │  │ [Medium ▼] │ │
│  │ ▼ AWS      │  │        │   ┌───▼───┐         │            │  │            │ │
│  │   EC2      │  │        │   │ Auth  │         │            │  │ Interfaces:│ │
│  │   Lambda   │  │        │   │Service│         │            │  │ + Add      │ │
│  │   RDS      │  │        │   └───────┘         │            │  │            │ │
│  │   ...      │  │        └─────────────────────┘            │  │ ─────────  │ │
│  │            │  │                                           │  │            │ │
│  │ ▼ Security │  │                     ┌───────┐             │  │ THREATS    │ │
│  │   IAM      │  │                     │  DB   │             │  │            │ │
│  │   WAF      │  │              ───────│ (RDS) │             │  │ 3 threats  │ │
│  │   KMS      │  │                     └───────┘             │  │ [View All] │ │
│  │            │  │                                           │  │            │ │
│  └────────────┘  │  [−] [100%] [+]  [🔲 Fit] [🔍 Minimap]   │  └────────────┘ │
│                  └───────────────────────────────────────────┘                  │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

**Specifications:**
- Palette: 280px width, collapsible
- Canvas: Flexible, minimum 600px
- Properties: 320px width, collapsible
- Toolbar: 48px height
- Zoom controls: Bottom-left of canvas

---

### 3. Threat Panel Layout

```
┌────────────────────────────────────────┐
│ THREATS                    [+ Add] [⋮] │
├────────────────────────────────────────┤
│ 🔍 Search threats...                   │
│                                        │
│ Filter: [All ▼] [All Severity ▼]       │
│ Group:  [By Component ▼]               │
├────────────────────────────────────────┤
│                                        │
│ ▼ API Gateway (3)                      │
│   ┌──────────────────────────────────┐ │
│   │ 🔴 SQL Injection                 │ │
│   │ T, I │ Critical │ Open           │ │
│   │ CWE-89                           │ │
│   │ [2 mitigations]          [Edit]  │ │
│   └──────────────────────────────────┘ │
│   ┌──────────────────────────────────┐ │
│   │ 🟠 Broken Authentication         │ │
│   │ S, E │ High │ Mitigated          │ │
│   │ OWASP A07                        │ │
│   │ [1 mitigation]           [Edit]  │ │
│   └──────────────────────────────────┘ │
│   ┌──────────────────────────────────┐ │
│   │ 🟡 Insufficient Logging          │ │
│   │ R │ Medium │ Open                │ │
│   │                          [Edit]  │ │
│   └──────────────────────────────────┘ │
│                                        │
│ ▶ Database (2)                         │
│                                        │
│ ▶ Auth Service (4)                     │
│                                        │
└────────────────────────────────────────┘
```

**Specifications:**
- Threat cards: Full width, 80-100px height
- Severity indicators: Color-coded badges
- Collapsible groups: Smooth animation
- Hover state: Subtle background highlight

---

### 4. Add Threat Dialog

```
┌─────────────────────────────────────────────────────────────┐
│ ADD THREAT                                            [✕]  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ Threat Name *                                               │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ SQL Injection Attack                                    │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ Description                                                 │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Attacker can inject malicious SQL commands through     │ │
│ │ unsanitized user input...                              │ │
│ │                                                         │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ STRIDE Categories *                                         │
│ ┌───────────────┐ ┌───────────────┐ ┌───────────────┐      │
│ │ ☐ Spoofing   │ │ ☑ Tampering  │ │ ☐ Repudiation │      │
│ └───────────────┘ └───────────────┘ └───────────────┘      │
│ ┌───────────────┐ ┌───────────────┐ ┌───────────────┐      │
│ │ ☑ Info Disc. │ │ ☐ DoS        │ │ ☐ Elev. Priv │      │
│ └───────────────┘ └───────────────┘ └───────────────┘      │
│                                                             │
│ Severity *                     Status                       │
│ ┌───────────────────────┐     ┌───────────────────────┐    │
│ │ Critical           ▼ │     │ Open               ▼ │    │
│ └───────────────────────┘     └───────────────────────┘    │
│                                                             │
│ Link to Component                                           │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ API Gateway (node-1)                                 ▼ │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ▶ Advanced (CWE, OWASP, Risk Score)                        │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                              [Cancel]  [Create Threat]      │
└─────────────────────────────────────────────────────────────┘
```

**Specifications:**
- Dialog width: 560px max
- Form fields: Full width with proper spacing (16px gap)
- STRIDE checkboxes: 3x2 grid layout
- Primary action: Right-aligned, filled button

---

### 5. AI Suggestions Panel

```
┌─────────────────────────────────────────────────────────────┐
│ AI THREAT SUGGESTIONS                 [Settings] [Refresh] │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ Analyzing: API Gateway, Auth Service, Database              │
│ Provider: Claude (claude-3-opus)                            │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ ████████████████████░░░░░░░░░░░░░░░░░░░░░  45%          │ │
│ │ Generating suggestions...                               │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ═══════════════════════════════════════════════════════════ │
│                                                             │
│ 5 suggestions generated                    [Accept All]     │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ ☐  SQL Injection                              🔴 Crit   │ │
│ │     Tampering, Information Disclosure                   │ │
│ │     API Gateway → Database connection may be            │ │
│ │     vulnerable to SQL injection...                      │ │
│ │                                                         │ │
│ │     Suggested Mitigations:                              │ │
│ │     • Use parameterized queries                         │ │
│ │     • Implement input validation                        │ │
│ │                                                         │ │
│ │     [Dismiss]                            [Accept] ✓     │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ ☐  Broken Authentication                      🟠 High   │ │
│ │     Spoofing, Elevation of Privilege                    │ │
│ │     Auth Service may have weak session management...    │ │
│ │                                                         │ │
│ │     [Dismiss]                            [Accept] ✓     │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ ☐  Sensitive Data Exposure                    🟠 High   │ │
│ │     ...                                                 │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Color Palette

### Brand Colors

| Name | Hex | Usage |
|------|-----|-------|
| Primary | `#2563EB` | Buttons, links, focus states |
| Primary Dark | `#1D4ED8` | Hover states |
| Primary Light | `#DBEAFE` | Backgrounds, badges |

### Semantic Colors

| Name | Hex | Usage |
|------|-----|-------|
| Critical | `#DC2626` | Critical severity |
| High | `#F97316` | High severity |
| Medium | `#EAB308` | Medium severity |
| Low | `#22C55E` | Low severity |
| Info | `#6B7280` | Info severity |

### STRIDE Colors

| Category | Hex |
|----------|-----|
| Spoofing | `#8B5CF6` |
| Tampering | `#F97316` |
| Repudiation | `#EAB308` |
| Info Disclosure | `#3B82F6` |
| Denial of Service | `#EF4444` |
| Elevation of Privilege | `#EC4899` |

### Neutral Colors

| Name | Hex | Usage |
|------|-----|-------|
| Background | `#FFFFFF` | Main background |
| Surface | `#F9FAFB` | Cards, panels |
| Border | `#E5E7EB` | Dividers, borders |
| Text | `#111827` | Primary text |
| Text Secondary | `#6B7280` | Secondary text |
| Text Muted | `#9CA3AF` | Disabled, hints |

---

## Typography

| Element | Font | Size | Weight |
|---------|------|------|--------|
| H1 | Inter | 30px | 700 |
| H2 | Inter | 24px | 600 |
| H3 | Inter | 20px | 600 |
| H4 | Inter | 16px | 600 |
| Body | Inter | 14px | 400 |
| Small | Inter | 12px | 400 |
| Code | JetBrains Mono | 13px | 400 |

---

## Component Specifications

### Buttons

```
Primary:   bg-blue-600 text-white hover:bg-blue-700 px-4 py-2 rounded-md
Secondary: bg-gray-100 text-gray-700 hover:bg-gray-200 px-4 py-2 rounded-md
Ghost:     text-gray-700 hover:bg-gray-100 px-4 py-2 rounded-md
Danger:    bg-red-600 text-white hover:bg-red-700 px-4 py-2 rounded-md
```

### Cards

```
bg-white border border-gray-200 rounded-lg shadow-sm p-4
hover: shadow-md transition-shadow
```

### Form Inputs

```
border border-gray-300 rounded-md px-3 py-2
focus: ring-2 ring-blue-500 border-blue-500
error: border-red-500 ring-red-500
```

---

## Responsive Breakpoints

| Breakpoint | Width | Layout Changes |
|------------|-------|----------------|
| Mobile | < 640px | Single column, bottom nav |
| Tablet | 640-1024px | 2 columns, collapsible panels |
| Desktop | 1024-1440px | 3 columns, all panels visible |
| Large | > 1440px | Extra spacing, larger canvas |

---

## Accessibility Requirements

- **Color contrast:** Minimum 4.5:1 for text, 3:1 for UI elements
- **Focus indicators:** Visible focus ring on all interactive elements
- **Keyboard navigation:** Full keyboard support, logical tab order
- **Screen readers:** ARIA labels on all interactive elements
- **Reduced motion:** Respect `prefers-reduced-motion`
- **Text scaling:** Support up to 200% text scaling

---

*Update this document when adding new UI patterns or components.*

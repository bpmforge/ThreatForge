# Frontend Architecture

**Last Updated:** May 2026

---

## Table of Contents

1. [Directory Structure](#1-directory-structure)
2. [Route Architecture](#2-route-architecture)
3. [Feature Modules](#3-feature-modules)
4. [State Management](#4-state-management)
5. [Component Hierarchy](#5-component-hierarchy)
6. [Data Flow Patterns](#6-data-flow-patterns)
7. [Feature Dependencies](#7-feature-dependencies)

---

## 1. Directory Structure

```
frontend/src/
├── app/                        # Next.js App Router
│   ├── (app)/                  # Authenticated app routes
│   │   ├── layout.tsx          # App shell (sidebar, org context)
│   │   ├── dashboard/          # Dashboard page
│   │   ├── projects/           # Project management
│   │   ├── organization/       # Org settings
│   │   ├── profile/            # User profile
│   │   ├── templates/          # Component templates
│   │   ├── libraries/          # Threat/component libraries
│   │   ├── analytics/          # Risk & compliance analytics
│   │   ├── reports/            # Report generation
│   │   ├── reviews/            # Security reviews
│   │   └── notifications/      # Notification center
│   ├── (auth)/                 # Authentication routes
│   │   ├── login/
│   │   ├── register/
│   │   ├── forgot-password/
│   │   ├── reset-password/
│   │   └── verify-email/
│   ├── admin/                  # System admin console
│   │   ├── layout.tsx          # Admin shell (requires superAdmin)
│   │   ├── users/
│   │   ├── organizations/
│   │   ├── audit/
│   │   └── settings/
│   ├── models/[id]/            # Threat model canvas (full-screen)
│   ├── setup/                  # First-time setup wizard
│   ├── organizations/[orgId]/  # Organization switcher
│   └── api/                    # Next.js API routes
│
├── components/                 # Shared React components
│   ├── canvas/                 # React Flow canvas components
│   │   ├── ThreatModelCanvas.tsx
│   │   ├── ComponentNode.tsx
│   │   ├── BoundaryNode.tsx
│   │   ├── SecurityEdge.tsx
│   │   └── ContextMenu.tsx
│   ├── dialogs/                # Modal dialogs
│   ├── layout/                 # App shell components
│   │   ├── AppSidebar.tsx
│   │   ├── AppHeader.tsx
│   │   └── Breadcrumbs.tsx
│   ├── panels/                 # Side panels
│   │   ├── ComponentPalette.tsx
│   │   └── PropertiesPanel.tsx
│   ├── providers/              # React context providers
│   └── ui/                     # shadcn/ui components
│
├── features/                   # Feature modules (56)
│   ├── threats/                # Threat management
│   ├── dashboard/              # Dashboard widgets
│   ├── ai/                     # AI suggestions & chat
│   ├── collaboration/          # Real-time sync
│   ├── export/                 # Export functionality
│   ├── dfd/                    # Data flow diagrams
│   ├── sequence-diagrams/      # Sequence diagrams
│   ├── toolbar/                # Toolbar controls
│   ├── settings/               # AI & user settings
│   ├── integrations/           # Third-party integrations
│   ├── organizations/          # Org management
│   ├── projects/               # Project CRUD
│   ├── version-history/        # Version snapshots
│   ├── threat-library/         # Threat templates
│   ├── junior-success/         # Junior engineer tools
│   ├── expert-productivity/    # Power user features
│   ├── proactive-ai/           # Auto-suggestions
│   ├── ux-modernization/       # Animation utilities
│   └── ...                     # 30+ more features
│
├── stores/                     # Zustand state stores (6 global)
│   ├── canvas-store.ts         # React Flow nodes/edges
│   ├── ui-store.ts             # Panel visibility
│   ├── history-store.ts        # Undo/redo stack
│   ├── diagram-store.ts        # Multi-diagram tabs
│   ├── dfd-canvas-store.ts     # DFD canvas state
│   └── org-store.ts            # Organization context
│   # Feature stores:
│   # features/ai/stores/provider-store.ts (AI provider config)
│
├── hooks/                      # Global hooks
│   ├── useUndoRedo.ts
│   ├── useCanvasWithHistory.ts
│   ├── useKeyboardShortcuts.ts
│   └── useResponsive.ts
│
├── types/                      # TypeScript definitions
│   ├── canvas.ts
│   ├── threat.ts
│   └── api.ts
│
└── lib/                        # Utility libraries
    ├── api-client.ts
    └── utils.ts
```

---

## 2. Route Architecture

### Route Groups & Layouts

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              ROOT LAYOUT                                     │
│                         (Providers: Session, Query, Theme)                   │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
        ┌────────────────────────────┼────────────────────────────┐
        │                            │                            │
        ▼                            ▼                            ▼
┌───────────────┐          ┌───────────────┐          ┌───────────────┐
│   (app)       │          │   (auth)      │          │   /admin      │
│   LAYOUT      │          │   LAYOUT      │          │   LAYOUT      │
│               │          │               │          │               │
│ + OrgProvider │          │ Full-screen   │          │ + AdminGuard  │
│ + Sidebar     │          │ forms only    │          │ + AdminSidebar│
│ + CommandK    │          │               │          │               │
└───────┬───────┘          └───────────────┘          └───────────────┘
        │
        │  ┌─────────────────────────────────────────────────────────────┐
        │  │                    /models/[id]                              │
        │  │                                                              │
        │  │  BYPASSES (app) layout - Full-screen canvas editor          │
        │  │                                                              │
        │  │  + ThreatModelCanvasProvider                                 │
        │  │  + DiagramTabs (Architecture, Sequence, DFD)                │
        │  │  + ComponentPalette (left)                                   │
        │  │  + 11-tab Right Panel (Threats, AI, Compliance, etc.)       │
        │  │                                                              │
        │  └─────────────────────────────────────────────────────────────┘
        │
        ├── /dashboard          → Dashboard with stats, recent models
        ├── /projects           → Project list
        ├── /projects/[id]      → Project detail + user stories
        ├── /organization       → Org settings (11 tabs)
        ├── /profile            → User profile + security
        ├── /templates          → Component templates
        ├── /libraries/threats  → Threat library browser
        ├── /analytics/*        → Risk, compliance, attack surface
        ├── /reports            → Report generation
        ├── /reviews            → Security review workflow
        └── /notifications      → Notification center
```

### Route Protection

| Route Pattern | Protection | Guard |
|---------------|------------|-------|
| `/(app)/**` | Authenticated | NextAuth middleware |
| `/(auth)/**` | Public | None |
| `/admin/**` | Super Admin | `useSystemAdminGuard()` |
| `/models/[id]` | Authenticated + Access | Model access check |
| `/setup` | First-time only | Setup status check |

---

## 3. Feature Modules

### Feature-Sliced Design Pattern

Each feature follows a consistent structure:

```
features/{feature}/
├── components/         # React components (PascalCase)
├── hooks/              # Custom hooks (useXxx)
├── services/           # API client functions
├── types/              # TypeScript interfaces
├── constants/          # Feature constants
├── data/               # Static data (for libraries)
├── utils/              # Helper functions
└── index.ts            # Public API (barrel exports)
```

### Import Rules

```typescript
// CORRECT: Import from feature index
import { ThreatPanel, useThreats, Threat } from '@/features/threats';

// WRONG: Import internal modules
import { ThreatCard } from '@/features/threats/components/ThreatCard';
```

### Top 15 Core Features

| Feature | Location | Purpose | Exports |
|---------|----------|---------|---------|
| **threats** | `features/threats/` | Threat CRUD, mitigations, risk scoring | 30+ components, 15+ hooks |
| **dashboard** | `features/dashboard/` | Stats, recent models, activity | 12 components, 15 hooks |
| **ai** | `features/ai/` | AI suggestions, chat | 4 components, 4 hooks |
| **collaboration** | `features/collaboration/` | Real-time Yjs sync | 3 components, 5 hooks |
| **export** | `features/export/` | PDF, JSON, Mermaid, Draw.io | 9 export services |
| **dfd** | `features/dfd/` | Data flow diagrams | 9 components, DFD hooks |
| **sequence-diagrams** | `features/sequence-diagrams/` | Sequence diagrams | 6 components, 10 hooks |
| **toolbar** | `features/toolbar/` | Save, load, export UI | 7 components, 1 hook |
| **settings** | `features/settings/` | AI provider config | 8 components, 10 hooks |
| **integrations** | `features/integrations/` | Jira, GitHub, diagram import | 8 components, 5 hooks |
| **organizations** | `features/organizations/` | Org management | 15 components, 10 hooks |
| **projects** | `features/projects/` | Project CRUD | 4 components, 8 hooks |
| **version-history** | `features/version-history/` | Version snapshots | 4 components, 5 hooks |
| **threat-library** | `features/threat-library/` | Threat templates | 5 components, 8 hooks |
| **junior-success** | `features/junior-success/` | STRIDE tutorial, readiness | 2 components, 1 hook |

---

## 4. State Management

### Zustand Store Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           STATE MANAGEMENT LAYER                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                         CLIENT STATE (Zustand)                               │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      CANVAS STORES (Primary)                         │   │
│  │                                                                       │   │
│  │  ┌───────────────────────────────────────────────────────────────┐  │   │
│  │  │  canvas-store.ts                                               │  │   │
│  │  │                                                                 │  │   │
│  │  │  State:                                                         │  │   │
│  │  │  - nodes: CanvasNode[]                                          │  │   │
│  │  │  - edges: CanvasEdge[]                                          │  │   │
│  │  │  - selectedNodeIds: string[]                                    │  │   │
│  │  │  - selectedEdgeIds: string[]                                    │  │   │
│  │  │  - isDirty: boolean                                             │  │   │
│  │  │  - referenceLinks: ReferenceLink[]                              │  │   │
│  │  │                                                                 │  │   │
│  │  │  Actions:                                                        │  │   │
│  │  │  - addComponent(type, position)                                 │  │   │
│  │  │  - addBoundary(position, label)                                 │  │   │
│  │  │  - updateNodeData(nodeId, data)                                 │  │   │
│  │  │  - deleteSelected()                                             │  │   │
│  │  │  - loadCanvas(nodes, edges)                                     │  │   │
│  │  │  - duplicateSelected()                                          │  │   │
│  │  │  - bringToFront/sendToBack(nodeId)                              │  │   │
│  │  │                                                                 │  │   │
│  │  │  Consumers: 45+ files (most used store)                         │  │   │
│  │  └───────────────────────────────────────────────────────────────┘  │   │
│  │                                                                       │   │
│  │  ┌───────────────────────────────────────────────────────────────┐  │   │
│  │  │  dfd-canvas-store.ts                                           │  │   │
│  │  │                                                                 │  │   │
│  │  │  Parallel store for DFD diagrams with same pattern             │  │   │
│  │  │  - Separate nodes/edges for DFD                                 │  │   │
│  │  │  - Process/DataStore/Entity counters                            │  │   │
│  │  │                                                                 │  │   │
│  │  │  Consumers: 3 files (DFDCanvas, DFDCanvasWrapper, Selection)   │  │   │
│  │  └───────────────────────────────────────────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         UI STORES                                    │   │
│  │                                                                       │   │
│  │  ┌─────────────────────────────┐  ┌─────────────────────────────┐  │   │
│  │  │  ui-store.ts                │  │  diagram-store.ts           │  │   │
│  │  │                             │  │                             │  │   │
│  │  │  - activeRightPanel         │  │  - activeTabId              │  │   │
│  │  │  - leftPanelCollapsed       │  │  - tabs: DiagramTab[]       │  │   │
│  │  │  - rightPanelCollapsed      │  │                             │  │   │
│  │  │  - threatCatalogOpen        │  │  Actions:                   │  │   │
│  │  │  - addThreatToComponentId   │  │  - setActiveTab()           │  │   │
│  │  │                             │  │  - addSequenceTab()         │  │   │
│  │  │  Actions:                   │  │  - addDfdTab()              │  │   │
│  │  │  - setActiveRightPanel()    │  │  - removeTab()              │  │   │
│  │  │  - requestAddThreat()       │  │                             │  │   │
│  │  │  - toggleLeftPanel()        │  │  Consumers: 3 files         │  │   │
│  │  │                             │  │                             │  │   │
│  │  │  Consumers: 8 files         │  │                             │  │   │
│  │  └─────────────────────────────┘  └─────────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      UTILITY STORES                                  │   │
│  │                                                                       │   │
│  │  ┌─────────────────────────────┐  ┌─────────────────────────────┐  │   │
│  │  │  history-store.ts           │  │  org-store.ts (persisted)   │  │   │
│  │  │                             │  │                             │  │   │
│  │  │  - past: HistoryEntry[]     │  │  - currentOrgId             │  │   │
│  │  │  - future: HistoryEntry[]   │  │  - isInitializing           │  │   │
│  │  │  - maxSize: 50              │  │                             │  │   │
│  │  │                             │  │  Persisted to localStorage  │  │   │
│  │  │  Actions:                   │  │  Key: 'org-context'         │  │   │
│  │  │  - push(snapshot)           │  │                             │  │   │
│  │  │  - undo(current)            │  │  Consumers: 4 files         │  │   │
│  │  │  - redo(current)            │  │                             │  │   │
│  │  │  - startBatch/endBatch()    │  │                             │  │   │
│  │  │                             │  │                             │  │   │
│  │  │  Consumers: 2 files         │  │                             │  │   │
│  │  └─────────────────────────────┘  └─────────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                       SERVER STATE (TanStack Query)                          │
│                                                                             │
│  Query Keys:                                                                │
│  - ['threat-models', orgId]           → useThreatModels()                  │
│  - ['threat-model', modelId]          → useThreatModel(id)                 │
│  - ['threats', modelId]               → useThreats(modelId)                │
│  - ['projects', orgId]                → useProjects()                      │
│  - ['dashboard-stats', orgId]         → useDashboardStats()                │
│  - ['ai-suggestions', modelId]        → useAISuggestions()                 │
│  - ['sequence-diagrams', modelId]     → useSequenceDiagrams()              │
│  - ['dfds', modelId]                  → useDFDs()                          │
│                                                                             │
│  Features:                                                                  │
│  - Automatic caching and refetching                                        │
│  - Optimistic updates for mutations                                        │
│  - Query invalidation on mutations                                         │
│  - Stale-while-revalidate pattern                                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Store Interaction Flow

```
User Action (Click "Add Threat")
         │
         ▼
┌─────────────────────┐
│    ContextMenu      │
│                     │
│ onClick={() =>      │
│   uiStore.request   │
│   AddThreat(nodeId) │
│ }                   │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│     UI Store        │
│                     │
│ requestAddThreat()  │──────────┐
│ - sets componentId  │          │
│ - switches panel    │          │
│   to 'threats'      │          │
└─────────────────────┘          │
                                 │
          ┌──────────────────────┘
          │
          ▼
┌─────────────────────┐     ┌─────────────────────┐
│   ThreatPanel       │────▶│   Canvas Store      │
│                     │     │                     │
│ reads:              │     │ getNode(nodeId)     │
│ - addThreatToCompId │     │ returns component   │
│                     │     │ data for display    │
│ opens AddThreatDlg  │     │                     │
└─────────────────────┘     └─────────────────────┘
```

---

## 5. Component Hierarchy

### Canvas Editor Page (`/models/[id]`)

```
ModelPage (Full-Screen)
│
├── Toolbar
│   ├── BackButton (→ /dashboard)
│   ├── ModelSelector (Load/Save)
│   ├── SaveStatusIndicator
│   ├── ImportDropdown
│   │   ├── DiagramImportDialog (Draw.io, Mermaid, Lucidchart)
│   │   └── DocumentImportDialog (PDF, DOCX, Markdown)
│   ├── ExportMenu (PDF, JSON, Mermaid, Draw.io, PNG, SVG)
│   ├── UndoButton / RedoButton
│   ├── VersionHistoryButton
│   ├── ModelStatusBadge (Draft/Published)
│   ├── ModelTagsEditor
│   └── ReadinessIndicator (junior-success)
│
├── DiagramTabs
│   ├── Architecture Tab (always present)
│   ├── Sequence Diagram Tabs (dynamic)
│   └── DFD Tabs (dynamic)
│
├── Left Panel (collapsible)
│   └── ComponentPalette
│       ├── DFD Category
│       ├── AWS Category
│       ├── GCP Category
│       ├── Azure Category
│       ├── Security Category
│       └── Custom Category
│
├── Center (Active Canvas)
│   │
│   ├── [Architecture Tab Active]
│   │   └── ThreatModelCanvas (React Flow)
│   │       ├── ComponentNode (custom node)
│   │       ├── BoundaryNode (group node)
│   │       ├── SecurityEdge (custom edge)
│   │       ├── ContextMenu (right-click)
│   │       ├── CollaboratorCursors (Yjs)
│   │       ├── MiniMap
│   │       └── Controls (zoom, fit)
│   │
│   ├── [Sequence Tab Active]
│   │   └── SequenceCanvas
│   │       ├── SequenceParticipant
│   │       └── SequenceMessage
│   │
│   └── [DFD Tab Active]
│       └── DFDCanvasWrapper
│           └── DFDCanvas (React Flow)
│               ├── DFDProcessNode
│               ├── DFDDataStoreNode
│               ├── DFDExternalEntityNode
│               └── DFDFlowEdge
│
├── Right Panel (tabbed, collapsible)
│   │
│   ├── Properties Tab
│   │   └── PropertiesPanel
│   │       ├── NodeProperties (when node selected)
│   │       └── EdgeProperties (when edge selected)
│   │
│   ├── Threats Tab
│   │   └── ThreatPanel
│   │       ├── ThreatPanelHeader (add, filter)
│   │       ├── ThreatCard (for each threat)
│   │       │   ├── ThreatHeader (name, severity badge)
│   │       │   ├── STRIDEBadges
│   │       │   └── MitigationList
│   │       └── AddThreatDialog
│   │
│   ├── Checklist Tab
│   │   └── ThreatChecklistPanel
│   │       └── StrideChecklistItem (for each category)
│   │
│   ├── Suggest Tab
│   │   └── SuggestionsPanel
│   │       └── ComponentSuggestionCard
│   │
│   ├── Score Tab
│   │   └── CompletenessPanel
│   │       ├── ScoreBreakdown
│   │       └── RecommendationsList
│   │
│   ├── Compliance Tab
│   │   └── ComplianceReport
│   │       ├── FrameworkSelector
│   │       └── ControlMappingTable
│   │
│   ├── Review Tab
│   │   └── ReviewPanel
│   │       ├── ReviewRequestForm
│   │       └── ReviewStatusIndicator
│   │
│   ├── AI Tab
│   │   └── AIThreatSuggestions
│   │       └── SuggestedThreatCard
│   │
│   ├── Chat Tab
│   │   └── AIChatPanel
│   │       ├── MessageList
│   │       └── ChatInput
│   │
│   ├── Similar Tab
│   │   └── SimilarModelsPanel
│   │       └── SimilarModelCard
│   │
│   └── Docs Tab
│       └── LinkedDocumentsPanel
│           └── LinkedDocumentCard
│
├── Dialogs (Modal)
│   ├── ThreatCatalogDialog (CWE/MITRE search)
│   ├── ThreatLibraryDialog (templates)
│   ├── StrideTutorialDialog (junior-success)
│   ├── SaveAsTemplateDialog
│   └── RestoreBackupConfirmation
│
└── Mobile Adaptations (< lg breakpoint)
    ├── Floating Action Buttons
    │   ├── Left FAB → Opens ComponentPalette drawer
    │   └── Right FAB → Opens Right Panel drawer
    └── Sheet/Drawer components for side panels
```

### Dashboard Page (`/dashboard`)

```
DashboardPage
│
├── PageHeader
│   ├── Title
│   ├── SearchInput
│   └── FilterButtons
│
├── [hasModels = false]
│   └── EmptyDashboard
│       ├── ValuePropCard
│       └── CreateModelDialog
│
├── [hasModels = true]
│   │
│   ├── StatsGrid (4 columns)
│   │   ├── StatsCard (Total Models)
│   │   ├── StatsCard (Total Threats)
│   │   ├── StatsCard (Open Threats)
│   │   └── StatsCard (Mitigated)
│   │
│   ├── ProjectsAtRisk
│   │   └── AtRiskProjectCard (for each)
│   │
│   └── MainGrid (3 + 1 columns)
│       │
│       ├── Left (3 cols)
│       │   │
│       │   ├── [No model focused]
│       │   │   └── RecentModels
│       │   │       └── ModelCard (for each)
│       │   │
│       │   └── [Model focused]
│       │       └── FocusedModelStats
│       │           ├── STRIDEBreakdown (chart)
│       │           └── ThreatsByComponent
│       │
│       └── Right Sidebar (1 col)
│           ├── RiskScoreWidget
│           ├── QuickActions
│           │   ├── CreateModelButton
│           │   └── ImportModelButton
│           └── ActivityFeed
│               └── ActivityItem (for each)
```

---

## 6. Data Flow Patterns

### Canvas Load Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         CANVAS LOAD SEQUENCE                                 │
└─────────────────────────────────────────────────────────────────────────────┘

1. Page Mount (/models/[id])
         │
         ▼
2. useThreatModel(id) - TanStack Query
         │
         ├─── Cache hit? Return cached data
         │
         └─── Cache miss? Fetch from API
                    │
                    ▼
3. API Response: { id, name, canvasState, ... }
         │
         ▼
4. useEffect in page.tsx
         │
         ├─── canvasStore.loadCanvas(canvasState.nodes, canvasState.edges)
         │
         └─── diagramStore.initializeTabs(sequenceDiagrams, dfds)
         │
         ▼
5. React Flow renders nodes/edges from store
         │
         ▼
6. [If collaboration enabled]
         │
         └─── useCollaboration(modelId)
                    │
                    ├─── Connect WebSocket to /ws/{modelId}
                    │
                    └─── Sync local store with Yjs Y.Doc
```

### Threat Creation Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       THREAT CREATION SEQUENCE                               │
└─────────────────────────────────────────────────────────────────────────────┘

1. User clicks "Add Threat" on component
         │
         ▼
2. ContextMenu calls uiStore.requestAddThreat(componentId)
         │
         ├─── uiStore.addThreatToComponentId = componentId
         └─── uiStore.activeRightPanel = 'threats'
         │
         ▼
3. ThreatPanel detects addThreatToComponentId
         │
         └─── Opens AddThreatDialog with componentId pre-filled
         │
         ▼
4. User fills form and submits
         │
         ▼
5. useCreateThreat mutation (TanStack Query)
         │
         ├─── Optimistic update: Add to cache immediately
         │
         └─── POST /api/threat-models/{id}/threats
                    │
                    ▼
6. Server creates threat in DB
         │
         ▼
7. Mutation success:
         │
         ├─── Invalidate ['threats', modelId] query
         │
         └─── Toast notification "Threat created"
         │
         ▼
8. uiStore.clearAddThreatRequest()
```

### AI Job Polling Flow

All AI operations (suggest threats, expert analysis, document extraction, attack tree, etc.) are async — the frontend enqueues and polls:

```
1. User clicks "Suggest Threats"
         │
         ▼
2. useSuggestThreats mutation
         │
         └─── POST /api/ai/suggest-threats { modelId }
                    │
                    ▼
3. Server returns { jobId } immediately (BullMQ enqueued)
         │
         ▼
4. useAiJobPoller(jobId) — polls every 2s
         │
         ├─── GET /api/ai-jobs/:jobId
         │         status: PENDING → PROCESSING → COMPLETED | FAILED
         │
         └─── On COMPLETED: invalidate ['threats', modelId] query
                    │
                    ▼
5. TanStack Query refetches threats — new threats appear in panel
```

**Key hook:** `useAiJobPoller(jobId)` — stops polling when status is terminal. Used by AI suggestions, expert analysis, document merge, attack tree, etc.

### Real-time Collaboration Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    COLLABORATION SYNC SEQUENCE                               │
└─────────────────────────────────────────────────────────────────────────────┘

User A                                              User B
   │                                                   │
   ├── Adds component                                  │
   │        │                                          │
   │        ▼                                          │
   │   canvasStore.addComponent()                      │
   │        │                                          │
   │        ▼                                          │
   │   Y.Array('nodes').push(newNode)                  │
   │        │                                          │
   │        ▼                                          │
   │   Yjs generates update                            │
   │        │                                          │
   │        ▼                                          │
   │   WebSocket sends to server                       │
   │        │                                          │
   │        └───────────────────┬──────────────────────┘
   │                            │
   │                            ▼
   │                    Server broadcasts
   │                    to all clients
   │                            │
   │        ┌───────────────────┴──────────────────────┐
   │        │                                          │
   │        ▼                                          ▼
   │   User A receives                          User B receives
   │   (ignored - own update)                   Yjs update
   │                                                   │
   │                                                   ▼
   │                                           Y.Array observer fires
   │                                                   │
   │                                                   ▼
   │                                           canvasStore.nodes updated
   │                                                   │
   │                                                   ▼
   │                                           React re-renders canvas
   │                                           with new node
```

---

## 7. Feature Dependencies

### Dependency Graph

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         FEATURE DEPENDENCY GRAPH                             │
└─────────────────────────────────────────────────────────────────────────────┘

                              LEAF FEATURES (No Dependencies)
┌─────────────────────────────────────────────────────────────────────────────┐
│  export │ settings │ organizations │ projects │ version-history │ ai       │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
                           MID-LAYER FEATURES
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│   dashboard ────────────▶ projects                                          │
│                                                                             │
│   dfd ──────────────────▶ export (Mermaid export)                           │
│                                                                             │
│   sequence-diagrams ────▶ dfd (for tab management)                          │
│                      └──▶ export (Mermaid export)                           │
│                                                                             │
│   threat-library ───────▶ threat-catalog (CWE types)                        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
                           CORE INTEGRATION HUBS
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│   threats ─────────────▶ collaboration (useThreatsSync)                     │
│                     └──▶ integrations (Jira integration)                    │
│                     └──▶ threat-library (compliance types)                  │
│                     └──▶ proactive-ai (SeverityCalculator)                  │
│                                                                             │
│   integrations ────────▶ dfd (diagram converter types)                      │
│                     └──▶ threat-templates (STRIDE types)                    │
│                                                                             │
│   toolbar ─────────────▶ canvas-store (direct)                              │
│                     └──▶ dashboard (model status)                           │
│                     └──▶ settings (SettingsDialog)                          │
│                     └──▶ junior-success (ReadinessIndicator)                │
│                     └──▶ document-import (DocumentImportDialog)             │
│                     └──▶ integrations/diagram-import                        │
│                     └──▶ model-templates (SaveAsTemplateDialog)             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
                           INFRASTRUCTURE LAYER
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│   collaboration ───────▶ canvas-store (syncs nodes/edges via Yjs)           │
│                                                                             │
│   auto-save ───────────▶ canvas-store (persists to localStorage)            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Store Usage by Feature

| Store | Heavy Users (8+ refs) | Light Users |
|-------|----------------------|-------------|
| **canvas-store** | toolbar, threats, collaboration, auto-save, dfd, completeness, reference-links, bulk-operations, threat-checklist, search, junior-success, component-suggestions, expert-productivity, attack-paths | Most other features |
| **dfd-canvas-store** | DFDCanvas, DFDCanvasWrapper, DFDSelectionPanel | - |
| **ui-store** | ContextMenu, ThreatPanel | ThreatLibraryDialog, StrideChecklistItem |
| **diagram-store** | sequence-diagrams (DiagramTabs) | - |
| **history-store** | useUndoRedo, useCanvasWithHistory | - |
| **org-store** | OrgProvider, OrgSwitcher, Dashboard | - |

---

*For backend architecture details, see [Backend Architecture](./BACKEND_ARCHITECTURE.md).*

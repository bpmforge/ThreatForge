# ThreatForge — C3 Component Diagrams

_Derived from `docs/sdlc/C4_ARCHITECTURE.md`. Internal structure of backend and frontend._

---

## Fastify API Server — Components

```mermaid
C4Component
  title Fastify API Server — Components

  ContainerDb(postgres, "PostgreSQL", "Database")
  ContainerDb(redis, "Redis", "Queue + Collab")
  System_Ext(aiProviders, "AI Providers", "External")

  Component(router, "Route Registry", "Fastify plugins", "Registers 80+ route modules grouped by domain. Enforces auth hooks, rate limiting, CORS")
  Component(authHook, "Auth Middleware", "Fastify preHandler", "Validates Auth.js JWT cookies, injects authUser into request context")
  Component(accessControl, "Access Control", "Service", "RBAC enforcement — OWNER/ADMIN/EDITOR/VIEWER/GUEST per org and per model")

  Component(threatModelRoutes, "Threat Model Routes", "Fastify plugin", "CRUD, canvas persistence, export/import, stats, version history")
  Component(aiRoutes, "AI Routes", "Fastify plugin", "Suggestions, expert analysis, extraction, chat, attack tree, severity rescoring")
  Component(canvasSync, "Canvas Sync", "Service", "Syncs React Flow node/edge state to Component/Connection tables on save")
  Component(aiService, "AI Service", "Service", "Provider abstraction: routes requests to correct AI provider with fallback")
  Component(clientFactory, "Client Factory", "Service", "Instantiates provider-specific clients (Claude SDK, OpenAI, fetch-based)")
  Component(jobQueue, "BullMQ Worker", "Queue Worker", "Processes 10 async AI job types: SUGGEST_THREATS, SUGGEST_MITIGATIONS, EXTRACT_DOCUMENT, EXTRACT_DIAGRAM, ATTACK_TREE, CALCULATE_SEVERITY, SEQUENCE_DIAGRAM, REFINEMENT_QUESTIONS, VERIFY_CITATIONS, REFRESH_MITIGATIONS")
  Component(microPipeline, "Micro-Analysis Pipeline", "Service", "Per-component per-category analysis with confidence loops and incremental skip")
  Component(complianceService, "Compliance Service", "Service", "Maps threats/mitigations to 12 built-in frameworks (HIPAA, PCI-DSS, NIST, etc.)")
  Component(collaborationService, "Collaboration Service", "Service", "Yjs document sync via Redis pub/sub for real-time multi-user editing")
  Component(prisma, "Prisma ORM", "Data layer", "Type-safe DB access. 29 schema modules, 84 models, PostgreSQL (prod) / SQLite (dev)")
  Component(auditService, "Audit Service", "Service", "Logs all mutations (model saves, AI calls, user actions) to AuditLog table")
  Component(repositories, "Repository Layer", "Data access", "5 typed repositories: threat, mitigation, project, organization, user. All DB queries go here.")

  Rel(router, authHook, "Applies to all protected routes")
  Rel(router, threatModelRoutes, "Routes /api/threat-models/*")
  Rel(router, aiRoutes, "Routes /api/ai/*")
  Rel(threatModelRoutes, accessControl, "checkThreatModelAccess()")
  Rel(threatModelRoutes, canvasSync, "On every canvas save")
  Rel(threatModelRoutes, repositories, "CRUD via repositories")
  Rel(aiRoutes, jobQueue, "Enqueues async AI jobs")
  Rel(jobQueue, aiService, "Calls for each job type")
  Rel(aiService, clientFactory, "Gets provider client")
  Rel(aiService, microPipeline, "Runs per-component analysis")
  Rel(clientFactory, aiProviders, "HTTP calls to AI APIs")
  Rel(microPipeline, prisma, "Reads components; writes threats")
  Rel(complianceService, prisma, "Reads threats/mitigations; maps to controls")
  Rel(collaborationService, redis, "Pub/sub for Yjs updates")
  Rel(repositories, prisma, "Delegates to ORM")
  Rel(prisma, postgres, "SQL via connection pool")
  Rel(auditService, prisma, "Writes AuditLog rows")
```

---

## Next.js Frontend — Components

```mermaid
C4Component
  title Next.js Frontend — Components

  Container(backend, "Fastify API", "Backend")
  Person(user, "User")

  Component(authJs, "Auth.js", "Authentication", "Session management, OAuth callbacks, JWT cookie handling. Providers: Credentials, GitHub, Google, Microsoft, Apple, SAML")
  Component(appRouter, "App Router", "Next.js routing", "Route groups: (app)/ authenticated shell, (auth)/ login flows, admin/ super admin, models/[id]/ canvas editor")
  Component(canvasEditor, "Canvas Editor", "React component", "Full-screen React Flow canvas at /models/[id]. Drag-drop nodes, edges, trust boundaries")
  Component(canvasStore, "Canvas Store", "Zustand", "Nodes, edges, selection, boundaries, persistence. Sliced into 6 sub-slices")
  Component(historyStore, "History Store", "Zustand", "Undo/redo with time-travel. Snapshots on each significant mutation")
  Component(featureModules, "Feature Modules", "React features", "56 feature directories. Each exports from index.ts only. Covers AI, threats, mitigations, compliance, export, collaboration, etc.")
  Component(tanstackQuery, "TanStack Query", "Data fetching", "Server state — threat models, threats, mitigations, compliance, settings. Cache + optimistic updates")
  Component(apiClient, "API Client", "lib/api-client.ts", "Centralized fetch wrapper. CSRF tokens, cookie auth, automatic data unwrapping from {data:...} envelope")
  Component(apiRoutes, "Next.js API Routes", "Next.js handlers", "Proxy routes to backend. Auth callback handlers. Avoid CORS for same-origin requests")
  Component(yjsCollab, "Yjs Collaboration", "CRDT", "Real-time canvas sync across users. Broadcasts via WebSocket to backend Redis pub/sub")

  Rel(user, appRouter, "Navigates", "Browser")
  Rel(appRouter, authJs, "Protects authenticated routes")
  Rel(appRouter, canvasEditor, "Renders at /models/[id]")
  Rel(canvasEditor, canvasStore, "Reads/writes canvas state")
  Rel(canvasEditor, yjsCollab, "Syncs changes in real-time")
  Rel(canvasEditor, featureModules, "Composes panels, dialogs, AI features")
  Rel(featureModules, tanstackQuery, "Data fetching hooks")
  Rel(tanstackQuery, apiClient, "HTTP calls")
  Rel(apiClient, apiRoutes, "Same-origin API requests")
  Rel(apiRoutes, backend, "Proxy to Fastify")
  Rel(canvasStore, historyStore, "Registers mutations")
  Rel(yjsCollab, backend, "WebSocket connection")
```

---

## Micro-Analysis Pipeline — Level 4 Flow

```mermaid
flowchart TD
    A[BullMQ: SUGGEST_THREATS job] --> B[pipeline.ts: runMicroAnalysis]
    B --> C{Check skip set}
    C -->|Component unchanged| D[Skip — return cached threats]
    C -->|Component dirty / new| E[buildComponentContext]
    E --> F[category-analyzer: per category loop]
    F --> G{STRIDE / PASTA / Kill Chain / MITRE}
    G --> H[Inject reference data: CWEs, OWASP, compliance controls]
    H --> I[LLM call via clientFactory]
    I --> J{Confidence >= threshold?}
    J -->|No, retry < 3| K[Re-prompt with unused templates]
    K --> I
    J -->|Yes| L[Parse & deduplicate threats]
    L --> M[mitigation-pass: generate mitigations]
    M --> N[Persist threats as AI_SUGGESTED]
    N --> O[prisma.component.updateMany — set analyzedAt]
    O --> P[onCheckpoint callback]
    P --> Q{More components?}
    Q -->|Yes| F
    Q -->|No| R[severity-calibrator]
    R --> S[compound-analyzer: cross-component]
    S --> T[supplemental: supply chain + ML threats]
    T --> U[AiJob.status = COMPLETED]
    U --> V[Frontend polls /api/ai-jobs/:id]
```

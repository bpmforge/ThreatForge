# Data Flows Documentation

**Product:** ThreatForge
**Version:** 2.1
**Last Updated:** May 2026

---

## Table of Contents

1. [Overview](#1-overview)
2. [Canvas Data Flows](#2-canvas-data-flows)
3. [API Request/Response Flows](#3-api-requestresponse-flows)
4. [Authentication Flows](#4-authentication-flows)
5. [Real-Time Collaboration Flows](#5-real-time-collaboration-flows)
6. [AI Processing Flows](#6-ai-processing-flows)
7. [Export/Import Flows](#7-exportimport-flows)
8. [Security Data Flows](#8-security-data-flows)
9. [Webhook & Integration Flows](#9-webhook--integration-flows)

---

## 1. Overview

This document describes how data flows through the ThreatForge system, covering both synchronous (REST API) and asynchronous (WebSocket, webhooks) patterns.

### Data Flow Categories

| Category | Pattern | Primary Use Case |
|----------|---------|------------------|
| **Canvas Operations** | Zustand → API → PostgreSQL | Create, update, delete diagram elements |
| **Real-Time Sync** | Yjs CRDT → WebSocket → Redis → Peers | Multi-user collaboration |
| **AI Processing** | Frontend → API → BullMQ → AI Provider → DB → Poll | Async threat suggestions, extraction, attack tree |
| **AI Chat** | Frontend → API → AI Provider (streaming SSE) | Interactive security assistant |
| **Authentication** | NextAuth → Session → API Middleware | User identity verification |
| **Export/Import** | Canvas State → Transform → File Download/Upload | Data portability |

---

## 2. Canvas Data Flows

### 2.1 Canvas Load Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          CANVAS LOAD SEQUENCE                                │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Browser    │     │  Next.js     │     │   Fastify    │     │ PostgreSQL   │
│              │     │  Frontend    │     │   Backend    │     │              │
└──────┬───────┘     └──────┬───────┘     └──────┬───────┘     └──────┬───────┘
       │                    │                    │                    │
       │  Navigate to       │                    │                    │
       │  /models/[id]      │                    │                    │
       │ ──────────────────►│                    │                    │
       │                    │                    │                    │
       │                    │  useQuery()        │                    │
       │                    │  TanStack Query    │                    │
       │                    │  ─────────────────►│                    │
       │                    │                    │                    │
       │                    │                    │  SELECT *          │
       │                    │                    │  FROM threat_model │
       │                    │                    │  WHERE id = ?      │
       │                    │                    │ ──────────────────►│
       │                    │                    │                    │
       │                    │                    │  canvasState JSON  │
       │                    │                    │ ◄──────────────────│
       │                    │                    │                    │
       │                    │  { model, canvas } │                    │
       │                    │ ◄─────────────────│                    │
       │                    │                    │                    │
       │                    │  canvas-store      │                    │
       │                    │  loadCanvas()      │                    │
       │                    │  (nodes & edges)   │                    │
       │                    │                    │                    │
       │  React Flow        │                    │                    │
       │  Renders Canvas    │                    │                    │
       │ ◄──────────────────│                    │                    │
       │                    │                    │                    │
```

**Data Transformations:**

```typescript
// 1. API Response
{
  id: "uuid",
  name: "My Threat Model",
  canvasState: { nodes: [...], edges: [...], viewport: {...} }
}

// 2. Zustand Store (canvas-store.ts)
{
  nodes: Node[],           // React Flow nodes
  edges: Edge[],           // React Flow edges
  selectedNodes: string[], // Selection state
  viewport: Viewport       // Pan/zoom state
}

// 3. React Flow Render
<ReactFlow nodes={nodes} edges={edges} ... />
```

### 2.2 Node Creation Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         NODE CREATION SEQUENCE                               │
└─────────────────────────────────────────────────────────────────────────────┘

User Action                 Frontend                    Backend             DB
    │                          │                          │                 │
    │  Drag from palette       │                          │                 │
    │  or double-click         │                          │                 │
    │ ────────────────────────►│                          │                 │
    │                          │                          │                 │
    │                          │  canvas-store            │                 │
    │                          │  .addComponent()         │                 │
    │                          │  Generate UUID           │                 │
    │                          │  Set position            │                 │
    │                          │  Set default data        │                 │
    │                          │                          │                 │
    │                          │  history-store.push()    │                 │
    │                          │  (undo/redo snapshot)    │                 │
    │                          │                          │                 │
    │  Canvas re-renders       │                          │                 │
    │ ◄────────────────────────│                          │                 │
    │                          │                          │                 │
    │                          │  auto-save (debounced)   │                 │
    │                          │  PATCH /threat-models/id │                 │
    │                          │ ────────────────────────►│                 │
    │                          │                          │                 │
    │                          │                          │  UPDATE         │
    │                          │                          │  canvasState    │
    │                          │                          │ ───────────────►│
    │                          │                          │                 │
    │                          │                          │  canvas-sync    │
    │                          │                          │  Populate       │
    │                          │                          │  Component      │
    │                          │                          │  table          │
    │                          │                          │ ───────────────►│
    │                          │                          │                 │
```

**Node Data Structure:**

```typescript
// New node created
{
  id: "node-{uuid}",
  type: "componentNode",
  position: { x: 100, y: 200 },
  data: {
    type: "WEB_APP" | "API" | "DATABASE" | "EXTERNAL_ENTITY" | ...,
    label: "New Component",
    description: "",
    trustLevel: "INTERNAL" | "EXTERNAL" | "DMZ",
    properties: {
      technology: "",
      owner: "",
      dataClassification: "INTERNAL"
    }
  }
}
```

### 2.3 Edge (Connection) Creation Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        EDGE CREATION SEQUENCE                                │
└─────────────────────────────────────────────────────────────────────────────┘

User Action                 Frontend                    Backend
    │                          │                          │
    │  Drag from node handle   │                          │
    │  to target node          │                          │
    │ ────────────────────────►│                          │
    │                          │                          │
    │                          │  onConnect() handler     │
    │                          │  Validate connection:    │
    │                          │  - Not self-loop         │
    │                          │  - Not duplicate         │
    │                          │                          │
    │                          │  React Flow addEdge()    │
    │                          │  Default edge data:      │
    │                          │  - protocol: "HTTPS"     │
    │                          │  - authentication: null  │
    │                          │  - encrypted: true       │
    │                          │                          │
    │  Show connection dialog  │                          │
    │ ◄────────────────────────│                          │
    │                          │                          │
    │  Configure protocol,     │                          │
    │  auth method, label      │                          │
    │ ────────────────────────►│                          │
    │                          │                          │
    │                          │  updateEdge()            │
    │                          │  auto-save               │
    │                          │ ────────────────────────►│
    │                          │                          │
```

**Edge Data Structure:**

```typescript
{
  id: "edge-{uuid}",
  source: "node-{sourceId}",
  target: "node-{targetId}",
  sourceHandle: "right" | "left" | "top" | "bottom",
  targetHandle: "left" | "right" | "top" | "bottom",
  type: "dataFlowEdge",
  data: {
    label: "API Request",
    protocol: "HTTPS" | "HTTP" | "gRPC" | "WebSocket" | "TCP" | "AMQP" | ...,
    authentication: "JWT" | "OAuth2" | "API_KEY" | "mTLS" | null,
    encrypted: boolean,
    dataClassification: "PUBLIC" | "INTERNAL" | "CONFIDENTIAL" | "RESTRICTED"
  }
}
```

### 2.4 Canvas State Synchronization

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     CANVAS ↔ DATABASE SYNC                                   │
└─────────────────────────────────────────────────────────────────────────────┘

         ┌─────────────────────────────────────────────────────────┐
         │                    CANVAS STATE (JSON)                   │
         │                                                          │
         │  {                                                       │
         │    nodes: [...],    ◄────── Source of Truth             │
         │    edges: [...],                                         │
         │    viewport: {...}                                       │
         │  }                                                       │
         └──────────────────────────┬──────────────────────────────┘
                                    │
                                    │  canvas-sync service
                                    │  (on save)
                                    │
         ┌──────────────────────────┼──────────────────────────────┐
         │                          ▼                               │
         │  ┌────────────┐  ┌────────────┐  ┌────────────┐        │
         │  │ Component  │  │ Connection │  │  Boundary  │        │
         │  │   Table    │  │   Table    │  │   Table    │        │
         │  │            │  │            │  │            │        │
         │  │ Denormal-  │  │ Denormal-  │  │ Denormal-  │        │
         │  │ ized for   │  │ ized for   │  │ ized for   │        │
         │  │ queries    │  │ queries    │  │ queries    │        │
         │  └────────────┘  └────────────┘  └────────────┘        │
         │                                                          │
         │                   NORMALIZED TABLES                      │
         │              (for querying, reporting)                   │
         └──────────────────────────────────────────────────────────┘

Sync Strategy:
1. Canvas JSON is authoritative
2. On save: Extract nodes/edges → Upsert to tables
3. On query: Read from normalized tables (faster)
4. On load: Read canvas JSON (complete state)
```

---

## 3. API Request/Response Flows

### 3.1 Standard CRUD Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         REST API REQUEST FLOW                                │
└─────────────────────────────────────────────────────────────────────────────┘

Frontend                    Fastify Server                     Database
    │                             │                               │
    │  fetch('/api/threats', {    │                               │
    │    method: 'POST',          │                               │
    │    headers: { Auth },       │                               │
    │    body: JSON.stringify()   │                               │
    │  })                         │                               │
    │ ───────────────────────────►│                               │
    │                             │                               │
    │                             │  ┌────────────────────────┐   │
    │                             │  │ MIDDLEWARE PIPELINE    │   │
    │                             │  │                        │   │
    │                             │  │ 1. CORS validation     │   │
    │                             │  │ 2. Rate limit check    │   │
    │                             │  │ 3. Auth extraction     │   │
    │                             │  │ 4. Session validation  │   │
    │                             │  │ 5. RBAC permission     │   │
    │                             │  │ 6. Request logging     │   │
    │                             │  └────────────────────────┘   │
    │                             │                               │
    │                             │  ┌────────────────────────┐   │
    │                             │  │ ROUTE HANDLER          │   │
    │                             │  │                        │   │
    │                             │  │ - Validate body (Zod)  │   │
    │                             │  │ - Business logic       │   │
    │                             │  │ - Prisma query         │   │
    │                             │  └──────────┬─────────────┘   │
    │                             │             │                 │
    │                             │             │  prisma.threat  │
    │                             │             │  .create()      │
    │                             │             │ ───────────────►│
    │                             │             │                 │
    │                             │             │  Threat record  │
    │                             │             │ ◄───────────────│
    │                             │                               │
    │                             │  ┌────────────────────────┐   │
    │                             │  │ POST-PROCESSING        │   │
    │                             │  │                        │   │
    │                             │  │ - Audit log            │   │
    │                             │  │ - Webhook dispatch     │   │
    │                             │  │ - Cache invalidation   │   │
    │                             │  └────────────────────────┘   │
    │                             │                               │
    │  { status: 201,             │                               │
    │    data: { id, ... } }      │                               │
    │ ◄───────────────────────────│                               │
    │                             │                               │
```

### 3.2 TanStack Query Cache Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      TANSTACK QUERY CACHE FLOW                               │
└─────────────────────────────────────────────────────────────────────────────┘

Component                 TanStack Query                    API
    │                          │                             │
    │  useQuery({              │                             │
    │    queryKey: ['threats', │                             │
    │                modelId], │                             │
    │    queryFn: fetchThreats │                             │
    │  })                      │                             │
    │ ────────────────────────►│                             │
    │                          │                             │
    │                          │  Check cache                │
    │                          │  ┌───────────────────┐      │
    │                          │  │ Cache Hit?        │      │
    │                          │  │                   │      │
    │                          │  │ YES → Return data │      │
    │                          │  │ NO  → Fetch       │      │
    │                          │  └───────────────────┘      │
    │                          │                             │
    │                          │  (if stale or miss)        │
    │                          │ ───────────────────────────►│
    │                          │                             │
    │                          │  JSON response             │
    │                          │ ◄───────────────────────────│
    │                          │                             │
    │                          │  Update cache               │
    │                          │  Notify subscribers         │
    │                          │                             │
    │  { data, isLoading,      │                             │
    │    error }               │                             │
    │ ◄────────────────────────│                             │
    │                          │                             │

Mutation Flow:

    │  useMutation({           │                             │
    │    mutationFn: addThreat │                             │
    │  })                      │                             │
    │ ────────────────────────►│                             │
    │                          │                             │
    │                          │  POST /threats              │
    │                          │ ───────────────────────────►│
    │                          │                             │
    │                          │  onSuccess:                 │
    │                          │  queryClient.invalidate-    │
    │                          │    Queries(['threats'])     │
    │                          │                             │
    │  Re-render with          │                             │
    │  new data                │                             │
    │ ◄────────────────────────│                             │
```

### 3.3 Error Handling Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         ERROR HANDLING FLOW                                  │
└─────────────────────────────────────────────────────────────────────────────┘

                        ┌────────────────────────┐
                        │    Error Occurs        │
                        └───────────┬────────────┘
                                    │
            ┌───────────────────────┼───────────────────────┐
            │                       │                       │
            ▼                       ▼                       ▼
    ┌───────────────┐      ┌───────────────┐      ┌───────────────┐
    │ ValidationErr │      │ NotFoundError │      │ UnauthorizedE │
    │  (400)        │      │  (404)        │      │  (401/403)    │
    └───────┬───────┘      └───────┬───────┘      └───────┬───────┘
            │                       │                       │
            └───────────────────────┼───────────────────────┘
                                    │
                                    ▼
                        ┌────────────────────────┐
                        │  Fastify Error Handler │
                        │                        │
                        │  - Log error           │
                        │  - Sanitize message    │
                        │  - Format response     │
                        └───────────┬────────────┘
                                    │
                                    ▼
                        ┌────────────────────────┐
                        │  HTTP Response         │
                        │                        │
                        │  {                     │
                        │    error: "Not Found", │
                        │    message: "...",     │
                        │    statusCode: 404     │
                        │  }                     │
                        └───────────┬────────────┘
                                    │
                                    ▼
                        ┌────────────────────────┐
                        │  Frontend Handler      │
                        │                        │
                        │  TanStack Query        │
                        │  onError callback      │
                        │  → Toast notification  │
                        └────────────────────────┘
```

---

## 4. Authentication Flows

### 4.1 Session Authentication (Web Browser)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      SESSION AUTH FLOW (WEB)                                 │
└─────────────────────────────────────────────────────────────────────────────┘

Browser                 NextAuth                    Backend               DB
    │                      │                          │                   │
    │  POST /api/auth/     │                          │                   │
    │  signin              │                          │                   │
    │ ────────────────────►│                          │                   │
    │                      │                          │                   │
    │                      │  Validate credentials    │                   │
    │                      │  or OAuth callback       │                   │
    │                      │ ──────────────────────────────────────────► │
    │                      │                          │                   │
    │                      │  Create session          │                   │
    │                      │ ──────────────────────────────────────────► │
    │                      │                          │                   │
    │  Set-Cookie:         │                          │                   │
    │  next-auth.session   │                          │                   │
    │ ◄────────────────────│                          │                   │
    │                      │                          │                   │
    │  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ (Later API Request) ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─│
    │                      │                          │                   │
    │  GET /api/threats    │                          │                   │
    │  Cookie: session     │                          │                   │
    │ ────────────────────────────────────────────────►                   │
    │                      │                          │                   │
    │                      │                          │  Validate token   │
    │                      │                          │ ─────────────────►│
    │                      │                          │                   │
    │                      │                          │  User + session   │
    │                      │                          │ ◄─────────────────│
    │                      │                          │                   │
    │                      │                          │  req.user = {...} │
    │                      │                          │  Continue to      │
    │                      │                          │  route handler    │
    │                      │                          │                   │
```

### 4.2 API Token Authentication (CI/CD)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      API TOKEN AUTH FLOW (CI/CD)                             │
└─────────────────────────────────────────────────────────────────────────────┘

CI Agent                      Backend                          DB
    │                            │                              │
    │  POST /api/ci/scan         │                              │
    │  Authorization:            │                              │
    │    Bearer ftm_xxxx         │                              │
    │ ──────────────────────────►│                              │
    │                            │                              │
    │                            │  Extract token               │
    │                            │  Check prefix: "ftm_"        │
    │                            │                              │
    │                            │  Hash token                  │
    │                            │  (SHA-256)                   │
    │                            │                              │
    │                            │  SELECT * FROM               │
    │                            │  CIApiKey WHERE              │
    │                            │  tokenHash = ?               │
    │                            │ ─────────────────────────────►│
    │                            │                              │
    │                            │  Validate:                   │
    │                            │  - Token exists              │
    │                            │  - Token enabled             │
    │                            │  - Expiry not passed         │
    │                            │  - Project access            │
    │                            │                              │
    │                            │  Update lastUsedAt           │
    │                            │ ─────────────────────────────►│
    │                            │                              │
    │                            │  Continue with               │
    │                            │  req.ciApiKey context        │
    │                            │                              │
    │  Scan results             │                              │
    │ ◄──────────────────────────│                              │
    │                            │                              │
```

### 4.3 Guest Access Token Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        GUEST ACCESS FLOW                                     │
└─────────────────────────────────────────────────────────────────────────────┘

Guest User                    Backend                          DB
    │                            │                              │
    │  Access shared link:       │                              │
    │  /models/xyz?token=abc     │                              │
    │ ──────────────────────────►│                              │
    │                            │                              │
    │                            │  Extract token from          │
    │                            │  query or header             │
    │                            │                              │
    │                            │  Validate token:             │
    │                            │  - Exists in DB              │
    │                            │  - Not expired               │
    │                            │  - Model matches             │
    │                            │  - Uses remaining            │
    │                            │                              │
    │                            │  Set context:                │
    │                            │  - guestAccess: true         │
    │                            │  - permission: VIEW/EDIT     │
    │                            │  - threatModelId: xyz        │
    │                            │                              │
    │                            │  Increment useCount          │
    │                            │ ─────────────────────────────►│
    │                            │                              │
    │  View-only or editable     │                              │
    │  canvas based on perm      │                              │
    │ ◄──────────────────────────│                              │
    │                            │                              │
```

---

## 5. Real-Time Collaboration Flows

### 5.1 Yjs WebSocket Sync Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      YJS COLLABORATION FLOW                                  │
└─────────────────────────────────────────────────────────────────────────────┘

User A                     WebSocket                    User B
Browser                    Server                       Browser
    │                         │                            │
    │  Connect to             │                            │
    │  ws://server/ws/        │                            │
    │  model-{id}             │                            │
    │ ───────────────────────►│                            │
    │                         │                            │
    │                         │  Create/join Yjs room      │
    │                         │  for model-{id}            │
    │                         │                            │
    │  Initial sync:          │                            │
    │  Y.Doc state vector     │                            │
    │ ◄───────────────────────│                            │
    │                         │                            │
    │  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ (User B Joins) ─ ─ ─ ─ ─ ─ ─│
    │                         │                            │
    │                         │◄───────────────────────────│
    │                         │  Connect ws://server/ws/   │
    │                         │  model-{id}                │
    │                         │                            │
    │                         │  Sync existing state       │
    │                         │  to User B                 │
    │                         │───────────────────────────►│
    │                         │                            │
    │  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ (User A Makes Edit) ─ ─ ─ ─ ─ ─│
    │                         │                            │
    │  Move node              │                            │
    │  → Y.Map.set()          │                            │
    │  → Generate update      │                            │
    │ ───────────────────────►│                            │
    │                         │                            │
    │                         │  Broadcast update          │
    │                         │  to all peers              │
    │                         │───────────────────────────►│
    │                         │                            │
    │                         │                            │  Apply update
    │                         │                            │  → canvas-store
    │                         │                            │  → React Flow
    │                         │                            │
    │                         │  Persist to Redis          │
    │                         │  (for server recovery)     │
    │                         │                            │
```

### 5.2 Awareness (Cursor Presence) Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       AWARENESS (CURSOR) FLOW                                │
└─────────────────────────────────────────────────────────────────────────────┘

User A                     Server                       User B
    │                         │                            │
    │  Mouse move on canvas   │                            │
    │  → awareness.setLocal-  │                            │
    │     State({             │                            │
    │       cursor: {x,y},    │                            │
    │       user: {...},      │                            │
    │       color: "#abc"     │                            │
    │     })                  │                            │
    │ ───────────────────────►│                            │
    │                         │                            │
    │                         │  Broadcast awareness       │
    │                         │───────────────────────────►│
    │                         │                            │
    │                         │                            │  Render cursor
    │                         │                            │  with user name
    │                         │                            │  and color
    │                         │                            │
    │  ◄─────────────────────────────────────────────────  │
    │                         │                            │  (User B moves)
    │  Render User B's        │                            │
    │  cursor position        │                            │
    │                         │                            │
```

### 5.3 Redis Horizontal Scaling Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     REDIS PUBSUB SCALING FLOW                                │
└─────────────────────────────────────────────────────────────────────────────┘

User A                   Server 1                  Redis              Server 2                  User B
(connected)              (Node 1)                  (Pub/Sub)          (Node 2)                  (connected)
    │                       │                         │                  │                         │
    │  Edit node            │                         │                  │                         │
    │ ─────────────────────►│                         │                  │                         │
    │                       │                         │                  │                         │
    │                       │  PUBLISH                │                  │                         │
    │                       │  model:{id}:update      │                  │                         │
    │                       │ ───────────────────────►│                  │                         │
    │                       │                         │                  │                         │
    │                       │                         │  SUBSCRIBE       │                         │
    │                       │                         │  model:{id}:*    │                         │
    │                       │                         │ ────────────────►│                         │
    │                       │                         │                  │                         │
    │                       │                         │                  │  Forward to            │
    │                       │                         │                  │  local clients         │
    │                       │                         │                  │ ───────────────────────►│
    │                       │                         │                  │                         │
    │                       │                         │                  │                         │  Canvas
    │                       │                         │                  │                         │  updates
    │                       │                         │                  │                         │

Redis Keys Used:
- model:{id}:state      - Yjs document state (for recovery)
- model:{id}:awareness  - Cursor positions
- model:{id}:lock       - Distributed lock for version save
```

---

## 6. AI Processing Flows

### 6.1 Threat Suggestion Flow (Async via BullMQ)

All AI operations except chat are async — the request enqueues a job and returns immediately. The frontend polls until complete.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│              AI THREAT SUGGESTION FLOW (ASYNC / BULLMQ)                      │
└─────────────────────────────────────────────────────────────────────────────┘

Frontend                  Fastify Backend               BullMQ / Worker         AI Provider            DB
    │                          │                              │                       │                  │
    │  POST /api/ai/           │                              │                       │                  │
    │  suggest-threats         │                              │                       │                  │
    │  { modelId }             │                              │                       │                  │
    │ ────────────────────────►│                              │                       │                  │
    │                          │                              │                       │                  │
    │                          │  Validate auth + model       │                       │                  │
    │                          │  access                      │                       │                  │
    │                          │                              │                       │                  │
    │                          │  Check per-model job         │                       │                  │
    │                          │  mutex (Redis lock)          │                       │                  │
    │                          │                              │                       │                  │
    │                          │  enqueueAiJob({              │                       │                  │
    │                          │    type: 'SUGGEST_THREATS',  │                       │                  │
    │                          │    modelId, sessionId        │                       │                  │
    │                          │  })                          │                       │                  │
    │                          │ ────────────────────────────►│                       │                  │
    │                          │                              │                       │                  │
    │  { jobId: "abc123" }     │                              │                       │                  │
    │ ◄────────────────────────│   (returns immediately)      │                       │                  │
    │                          │                              │                       │                  │
    │  ── polling every 2s ──  │                              │                       │                  │
    │  GET /api/ai-jobs/abc123 │                              │                       │                  │
    │ ────────────────────────►│                              │                       │                  │
    │  { status: PENDING }     │                              │                       │                  │
    │ ◄────────────────────────│                              │                       │                  │
    │                          │                              │                       │                  │
    │                          │             (worker picks job from queue)            │                  │
    │                          │                              │                       │                  │
    │                          │                              │  runMicroAnalysis()   │                  │
    │                          │                              │  Per-component        │                  │
    │                          │                              │  per-category         │                  │
    │                          │                              │                       │                  │
    │                          │                              │  Build prompt:        │                  │
    │                          │                              │  - component names    │                  │
    │                          │                              │    (not CUIDs)        │                  │
    │                          │                              │  - CWE refs           │                  │
    │                          │                              │  - compliance reqs    │                  │
    │                          │                              │ ─────────────────────►│                  │
    │                          │                              │                       │                  │
    │                          │                              │  AI response          │                  │
    │                          │                              │ ◄─────────────────────│                  │
    │                          │                              │                       │                  │
    │                          │                              │  Dedup check          │                  │
    │                          │                              │  (normalizedName)     │                  │
    │                          │                              │                       │                  │
    │                          │                              │  prisma.threat        │                  │
    │                          │                              │  .createMany()        │                  │
    │                          │                              │  ON CONFLICT          │                  │
    │                          │                              │  → 409, skip          │                  │
    │                          │                              │ ──────────────────────────────────────► │
    │                          │                              │                       │                  │
    │  GET /api/ai-jobs/abc123 │                              │                       │                  │
    │ ────────────────────────►│                              │                       │                  │
    │  { status: COMPLETED }   │                              │                       │                  │
    │ ◄────────────────────────│                              │                       │                  │
    │                          │                              │                       │                  │
    │  Invalidate ['threats',  │                              │                       │                  │
    │  modelId] TQ query       │                              │                       │                  │
    │  → Threats panel updates │                              │                       │                  │
    │                          │                              │                       │                  │
```

**Job types that follow this same pattern:** SUGGEST_MITIGATIONS, EXTRACT_DOCUMENT, EXTRACT_DIAGRAM, ATTACK_TREE, CALCULATE_SEVERITY, SEQUENCE_DIAGRAM, REFINEMENT_QUESTIONS, VERIFY_CITATIONS, REFRESH_MITIGATIONS.

### 6.2 AI Chat Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          AI CHAT FLOW                                        │
└─────────────────────────────────────────────────────────────────────────────┘

Frontend                     Backend                      AI Provider
    │                           │                              │
    │  Open AI panel            │                              │
    │  Previous messages        │                              │
    │  loaded from state        │                              │
    │                           │                              │
    │  User types:              │                              │
    │  "What threats apply      │                              │
    │   to an API gateway?"     │                              │
    │                           │                              │
    │  POST /api/ai/chat        │                              │
    │  { messages: [...],       │                              │
    │    context: {model} }     │                              │
    │ ─────────────────────────►│                              │
    │                           │                              │
    │                           │  Enrich context:             │
    │                           │  - Canvas components         │
    │                           │  - Existing threats          │
    │                           │  - Trust boundaries          │
    │                           │                              │
    │                           │  Stream request              │
    │                           │ ────────────────────────────►│
    │                           │                              │
    │  SSE: data chunks         │  SSE: response chunks        │
    │ ◄─────────────────────────│ ◄────────────────────────────│
    │                           │                              │
    │  Render incrementally     │                              │
    │  as chunks arrive         │                              │
    │                           │                              │
    │  SSE: [DONE]              │  SSE: [DONE]                 │
    │ ◄─────────────────────────│ ◄────────────────────────────│
    │                           │                              │
    │  Store in local state     │                              │
    │  for chat history         │                              │
    │                           │                              │
```

### 6.3 Document Intelligence Flow (Smart Import + Merge Review)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│              SMART DOCUMENT IMPORT FLOW (ASYNC + MERGE REVIEW)               │
└─────────────────────────────────────────────────────────────────────────────┘

Frontend                     Backend                     BullMQ / Worker
    │                           │                              │
    │  Upload document          │                              │
    │  (PDF/DOCX/OpenAPI/       │                              │
    │   Terraform/code)         │                              │
    │  POST /api/documents/     │                              │
    │  import                   │                              │
    │ ─────────────────────────►│                              │
    │                           │                              │
    │                           │  Store document + text       │
    │                           │  in Document table           │
    │                           │                              │
    │                           │  Pass existing component     │
    │                           │  summary to reduce upstream  │
    │                           │  duplicates in AI prompt     │
    │                           │                              │
    │                           │  enqueueAiJob({              │
    │                           │    type: 'EXTRACT_DOCUMENT', │
    │                           │    docId, modelId            │
    │                           │  })                          │
    │                           │ ────────────────────────────►│
    │                           │                              │
    │  { jobId }                │                              │
    │ ◄─────────────────────────│                              │
    │                           │                              │
    │  Poll GET /api/ai-jobs/   │                              │
    │  :jobId                   │                              │
    │                           │                              │  AI extract:
    │                           │                              │  { components,
    │                           │                              │    connections,
    │                           │                              │    boundaries,
    │                           │                              │    requirements }
    │                           │                              │
    │                           │                              │  Fuzzy-merge engine
    │                           │                              │  classifies each as:
    │                           │                              │  ADD / UPDATE / SKIP
    │                           │                              │  with confidence score
    │                           │                              │
    │  COMPLETED + merge result │                              │
    │ ◄─────────────────────────│                              │
    │                           │                              │
    │  MergeReviewDialog        │                              │
    │  shows add/update/skip    │                              │
    │  with match reasons       │                              │
    │                           │                              │
    │  User confirms            │                              │
    │  POST /api/documents/     │                              │
    │  :id/apply-merge          │                              │
    │ ─────────────────────────►│                              │
    │                           │                              │
    │                           │  Apply approved changes      │
    │                           │  to canvas + Component table │
    │                           │  Store extracted requirements│
    │                           │  in canvas store             │
    │                           │                              │
    │  Canvas updates           │                              │
    │ ◄─────────────────────────│                              │
```

---

## 7. Export/Import Flows

### 7.1 Export Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          EXPORT FLOW                                         │
└─────────────────────────────────────────────────────────────────────────────┘

Frontend                              Backend                    File System
    │                                    │                           │
    │  Click Export → PDF                │                           │
    │ ──────────────────────────────────►│                           │
    │                                    │                           │
    │                                    │  Load threat model        │
    │                                    │  + all threats            │
    │                                    │  + all mitigations        │
    │                                    │                           │
    │                                    │  ┌─────────────────────┐  │
    │                                    │  │ Format Selection    │  │
    │                                    │  │                     │  │
    │                                    │  │ PDF  → Browser Print │  │
    │                                    │  │ JSON → serialize    │  │
    │                                    │  │ YAML → yaml.dump    │  │
    │                                    │  │ PNG  → canvas snap  │  │
    │                                    │  │ SVG  → canvas SVG   │  │
    │                                    │  │ Mermaid → transform │  │
    │                                    │  │ DrawIO → XML        │  │
    │                                    │  └─────────────────────┘  │
    │                                    │                           │
    │                                    │  Generate file buffer     │
    │                                    │                           │
    │  Content-Disposition:              │                           │
    │  attachment; filename=             │                           │
    │  "model-name.pdf"                  │                           │
    │  Binary content                    │                           │
    │ ◄──────────────────────────────────│                           │
    │                                    │                           │
    │  Browser download                  │                           │
    │  dialog                            │                           │
    │                                    │                           │

Export Formats:

┌────────────┬─────────────────────────────────────────────────────────────┐
│ Format     │ Content                                                      │
├────────────┼─────────────────────────────────────────────────────────────┤
│ PDF        │ Canvas image + threat table + mitigation list               │
│ JSON       │ Full model data (canvasState + threats + mitigations)       │
│ YAML       │ Same as JSON in YAML format                                 │
│ PNG/SVG    │ Canvas visual only                                          │
│ Mermaid    │ Diagram as Mermaid flowchart syntax                         │
│ Draw.io    │ XML format compatible with diagrams.net                     │
└────────────┴─────────────────────────────────────────────────────────────┘
```

### 7.2 Import Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          IMPORT FLOW                                         │
└─────────────────────────────────────────────────────────────────────────────┘

Frontend                              Backend
    │                                    │
    │  File upload (JSON/YAML/          │
    │  Mermaid/Draw.io/Lucidchart)      │
    │ ──────────────────────────────────►│
    │                                    │
    │                                    │  ┌─────────────────────┐
    │                                    │  │ Parser Selection    │
    │                                    │  │                     │
    │                                    │  │ .json → JSON.parse  │
    │                                    │  │ .yaml → yaml.parse  │
    │                                    │  │ .mmd  → mermaid-    │
    │                                    │  │         parser      │
    │                                    │  │ .drawio → drawio-   │
    │                                    │  │           parser    │
    │                                    │  │ .csv    → lucid-    │
    │                                    │  │           parser    │
    │                                    │  └─────────────────────┘
    │                                    │
    │                                    │  Validate structure:
    │                                    │  - Required fields
    │                                    │  - Node/edge references
    │                                    │  - Type compatibility
    │                                    │
    │                                    │  Transform to internal
    │                                    │  canvas format
    │                                    │
    │  Preview with detected             │
    │  components highlighted            │
    │ ◄──────────────────────────────────│
    │                                    │
    │  User confirms import              │
    │ ──────────────────────────────────►│
    │                                    │
    │                                    │  Create new ThreatModel
    │                                    │  with imported canvas
    │                                    │
    │  Redirect to canvas                │
    │ ◄──────────────────────────────────│
    │                                    │
```

---

## 8. Security Data Flows

### 8.1 Encryption Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       ENCRYPTION DATA FLOW                                   │
└─────────────────────────────────────────────────────────────────────────────┘

API Request                 Encryption Service              Database
    │                              │                            │
    │  Save AI API key:            │                            │
    │  { apiKey: "sk-xxx" }        │                            │
    │ ────────────────────────────►│                            │
    │                              │                            │
    │                              │  Get encryption key:       │
    │                              │  1. Check org BYOK         │
    │                              │  2. Fall back to system    │
    │                              │                            │
    │                              │  AES-256-GCM encrypt:      │
    │                              │  - Generate IV (12 bytes)  │
    │                              │  - Encrypt plaintext       │
    │                              │  - Generate auth tag       │
    │                              │                            │
    │                              │  Format: {version}:{iv}:   │
    │                              │          {ciphertext}:     │
    │                              │          {authTag}         │
    │                              │                            │
    │                              │  Store encrypted           │
    │                              │ ────────────────────────────►│
    │                              │                            │
    │  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ (Later: Read) ─ ─ ─ ─ ─ ─ ─ ─ ─ │
    │                              │                            │
    │  Use AI provider             │                            │
    │ ────────────────────────────►│                            │
    │                              │                            │
    │                              │  Fetch encrypted           │
    │                              │ ◄────────────────────────────│
    │                              │                            │
    │                              │  Decrypt:                  │
    │                              │  - Parse format            │
    │                              │  - Get key (BYOK/system)   │
    │                              │  - Verify auth tag         │
    │                              │  - Decrypt ciphertext      │
    │                              │                            │
    │  Use decrypted key           │                            │
    │  for AI API call             │                            │
    │ ◄────────────────────────────│                            │
    │                              │                            │

Encrypted Fields:
- AIProvider.apiKey
- Integration.credentials
- Webhook.secret
- SSOConfig.clientSecret
- TwoFactorAuth.secret
- EmailProvider.apiKey
```

### 8.2 Audit Logging Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        AUDIT LOGGING FLOW                                    │
└─────────────────────────────────────────────────────────────────────────────┘

API Route                  Audit Service                  Database
    │                           │                             │
    │  Successful action:       │                             │
    │  threat.create            │                             │
    │ ─────────────────────────►│                             │
    │                           │                             │
    │                           │  Build audit entry:         │
    │                           │  {                          │
    │                           │    action: 'threat.create', │
    │                           │    entityType: 'THREAT',    │
    │                           │    entityId: '...',         │
    │                           │    userId: '...',           │
    │                           │    organizationId: '...',   │
    │                           │    ipAddress: '...',        │
    │                           │    userAgent: '...',        │
    │                           │    metadata: {...},         │
    │                           │    timestamp: Date.now()    │
    │                           │  }                          │
    │                           │                             │
    │                           │  INSERT INTO AuditLog       │
    │                           │ ────────────────────────────►│
    │                           │                             │

Audited Actions:
┌─────────────────────────────────────────────────────────────┐
│ Category      │ Actions                                      │
├───────────────┼──────────────────────────────────────────────┤
│ Auth          │ login, logout, failed_login, 2fa_enabled    │
│ Models        │ create, update, delete, export, share       │
│ Threats       │ create, update, delete, status_change       │
│ Mitigations   │ create, update, delete, status_change       │
│ Members       │ invite, join, role_change, remove           │
│ Settings      │ update, api_key_rotate, sso_configure       │
│ Admin         │ user_ban, org_suspend, config_change        │
└───────────────┴──────────────────────────────────────────────┘
```

---

## 9. Webhook & Integration Flows

### 9.1 Webhook Dispatch Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       WEBHOOK DISPATCH FLOW                                  │
└─────────────────────────────────────────────────────────────────────────────┘

Event Trigger              Webhook Service             External System
    │                           │                            │
    │  threat.created           │                            │
    │ ─────────────────────────►│                            │
    │                           │                            │
    │                           │  Find webhooks:            │
    │                           │  SELECT * FROM Webhook     │
    │                           │  WHERE orgId = ?           │
    │                           │  AND events @> 'threat.*'  │
    │                           │  AND enabled = true        │
    │                           │                            │
    │                           │  For each webhook:         │
    │                           │                            │
    │                           │  ┌────────────────────────┐│
    │                           │  │ Build payload:         ││
    │                           │  │ {                      ││
    │                           │  │   event: 'threat.      ││
    │                           │  │           created',    ││
    │                           │  │   timestamp: '...',    ││
    │                           │  │   data: {...}          ││
    │                           │  │ }                      ││
    │                           │  └────────────────────────┘│
    │                           │                            │
    │                           │  Sign with HMAC-SHA256     │
    │                           │  X-Webhook-Signature header │
    │                           │                            │
    │                           │  POST {webhook.url}        │
    │                           │ ──────────────────────────►│
    │                           │                            │
    │                           │  Log delivery attempt      │
    │                           │  (success/failure)         │
    │                           │                            │
    │                           │  If failed: queue retry    │
    │                           │  (exponential backoff)     │
    │                           │                            │
```

### 9.2 Issue Tracker Sync Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    ISSUE TRACKER SYNC FLOW                                   │
└─────────────────────────────────────────────────────────────────────────────┘

ThreatForge Backend                Integration Service           Jira/GitHub/etc
    │                           │                             │
    │  Mitigation status        │                             │
    │  changed to               │                             │
    │  IMPLEMENTED              │                             │
    │ ─────────────────────────►│                             │
    │                           │                             │
    │                           │  Check integration config   │
    │                           │  - Type: JIRA               │
    │                           │  - Enabled: true            │
    │                           │  - Bidirectional: true      │
    │                           │                             │
    │                           │  Find linked issue:         │
    │                           │  IntegrationMapping         │
    │                           │  WHERE entityType =         │
    │                           │    'MITIGATION'             │
    │                           │  AND entityId = ?           │
    │                           │                             │
    │                           │  Transform status:          │
    │                           │  IMPLEMENTED → "Done"       │
    │                           │                             │
    │                           │  PUT /rest/api/3/issue/     │
    │                           │      {issueKey}/transitions │
    │                           │ ────────────────────────────►│
    │                           │                             │
    │                           │  200 OK                     │
    │                           │ ◄────────────────────────────│
    │                           │                             │
    │                           │  Update sync log:           │
    │                           │  lastSyncAt, status         │
    │                           │                             │

Integration Mappings:
┌─────────────────────────────────────────────────────────────────────────────┐
│ ThreatForge Entity│ Jira             │ GitHub           │ Azure DevOps     │
├───────────────────┼──────────────────┼──────────────────┼──────────────────┤
│ Threat            │ Security Bug     │ Issue (security) │ Work Item (Bug)  │
│ Mitigation        │ Task/Sub-task    │ Issue (task)     │ Work Item (Task) │
│ OPEN              │ Open             │ open             │ New              │
│ IN_PROGRESS       │ In Progress      │ open             │ Active           │
│ IMPLEMENTED       │ Done             │ closed           │ Resolved         │
│ ACCEPTED          │ Won't Fix        │ closed           │ Closed           │
└───────────────────┴──────────────────┴──────────────────┴──────────────────┘
```

---

## Related Documents

| Document | Description |
|----------|-------------|
| [SADD](./SADD.md) | System architecture overview |
| [Frontend Architecture](./FRONTEND_ARCHITECTURE.md) | Frontend component details |
| [Backend Architecture](./BACKEND_ARCHITECTURE.md) | Backend service details |
| [API Reference](../API_REFERENCE.md) | REST API endpoints |
| [Data Models](../DATA_MODELS.md) | Database schema |

---

*This document describes data flow patterns as implemented in the codebase. Update when significant flow changes are made.*

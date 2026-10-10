# Backend Architecture

**Last Updated:** May 2026

---

## Table of Contents

1. [Directory Structure](#1-directory-structure)
2. [API Layer](#2-api-layer)
3. [Service Layer](#3-service-layer)
4. [Data Layer](#4-data-layer)
5. [Authentication & Authorization](#5-authentication--authorization)
6. [Real-time Collaboration](#6-real-time-collaboration)
7. [External Integrations](#7-external-integrations)

---

## 1. Directory Structure

```
server/src/
├── api/                        # Route handlers (79 modules — files + subdirs)
│   ├── threat-models/          # Threat model CRUD + canvas + export (subdir)
│   ├── threats.ts              # Threat management
│   ├── mitigations.ts          # Mitigation management
│   ├── organizations/          # Organization CRUD (subdir)
│   ├── projects/               # Project CRUD (subdir)
│   ├── members.ts              # Membership management
│   ├── invitations/            # Invitation handling (subdir)
│   ├── guest-access.ts         # External sharing
│   ├── ai.ts                   # AI routes (enqueue BullMQ jobs)
│   ├── ai-jobs.ts              # Poll AI job status
│   ├── ai-providers/           # AI provider config UI (subdir)
│   ├── versions.ts             # Version history
│   ├── sequence-diagrams/      # Sequence diagrams (subdir)
│   ├── dfd/                    # Data flow diagrams (subdir)
│   ├── users.ts                # User profile
│   ├── settings/               # AI settings (subdir)
│   ├── admin/                  # System admin (subdir)
│   ├── audit/                  # Audit logging (subdir)
│   ├── ci/                     # CI/CD integration (subdir)
│   ├── webhooks/               # Webhook management (subdir)
│   ├── api-tokens.ts           # Personal tokens
│   ├── uploads.ts              # File uploads
│   ├── compliance.ts           # Compliance analysis
│   ├── compliance-evidence.ts  # Evidence links
│   ├── reporting.ts            # Dashboard reports
│   ├── auth-public/            # Public auth endpoints (subdir)
│   ├── custom-roles/           # Custom role management (subdir)
│   ├── pipelines/              # AI prompt pipelines (subdir)
│   ├── prompts/                # Prompt library (subdir)
│   ├── scanners/               # Security scanners (subdir)
│   ├── setup/                  # First-time setup (subdir)
│   ├── attack-surface.ts       # Attack surface analysis
│   ├── bulk.ts                 # Bulk operations
│   ├── cache.ts                # Cache management
│   ├── citations.ts            # Citation verification
│   ├── supply-chain.ts         # Supply chain threats
│   ├── threat-library/         # Threat library (subdir)
│   ├── observability.ts        # Health + metrics
│   └── v1/                     # Stable public API (Bearer token)
│
├── jobs/                       # BullMQ async AI jobs
│   ├── ai-queue.ts             # Queue + 10 job type definitions
│   ├── ai-worker.ts            # Worker: processes all AI job types
│   └── create-suggest-threats-job.ts
│
├── services/                   # Business logic (41+ directories)
│   ├── ai/                     # AI provider abstraction
│   │   ├── ai-service.ts       # Main orchestrator
│   │   ├── provider-manager.ts # Health & fallback
│   │   ├── ai-metrics.ts       # Usage tracking
│   │   ├── streaming-handler.ts
│   │   └── providers/          # Provider implementations
│   │       ├── anthropic-provider.ts
│   │       ├── openai-provider.ts
│   │       ├── google-provider.ts
│   │       ├── ollama-provider.ts
│   │       └── lmstudio-provider.ts
│   │
│   ├── access-control/         # Authorization
│   │   └── access-control-service.ts
│   │
│   ├── encryption/             # Encryption & BYOK
│   │   ├── encryption-service.ts
│   │   └── key-manager.ts
│   │
│   ├── guest-access/           # Guest sharing
│   │   └── guest-access-service.ts
│   │
│   ├── membership/             # Member management
│   │   └── membership-service.ts
│   │
│   ├── invitation/             # Invitation workflow
│   │   └── invitation-service.ts
│   │
│   ├── webhooks/               # Webhook dispatching
│   │   └── webhook-dispatcher.ts
│   │
│   ├── collaboration.ts        # Yjs collaboration
│   ├── collaboration-persistence.ts
│   ├── redis-collaboration.ts  # Redis scaling
│   ├── canvas-sync.ts          # JSON → DB sync
│   ├── two-factor.ts           # TOTP 2FA
│   ├── password-validation.ts  # Password policy enforcement
│   ├── audit.ts                # Audit logging
│   └── cache/                  # Caching
│       └── cache-service.ts
│
├── middleware/                 # Fastify middleware
│   ├── auth.ts                 # Authentication
│   ├── rate-limit.ts           # Rate limiting
│   ├── ai-rate-limit.ts        # AI-specific rate limits
│   ├── csrf.ts                 # CSRF protection
│   ├── ip-allowlist.ts         # IP allowlist filtering
│   └── error-handler.ts        # Error formatting
│
├── repositories/               # Data access layer
│   └── threat.repository.ts
│
├── prisma/                     # Database
│   └── schema/                 # 29 modular .prisma files, 84 models (source of truth)
│
├── utils/                      # Utilities
│   └── api-response.ts         # Response formatting & validation
│
└── index.ts                    # Server entry point
```

---

## 2. API Layer

### Route Registration

All routes are registered in `index.ts` with the following pattern:

```typescript
// Public routes (no auth)
fastify.register(authPublicRoutes, { prefix: '/api/auth' });
fastify.register(setupRoutes, { prefix: '/api/setup' });

// Protected routes (require auth)
fastify.register(async (protectedRoutes) => {
  // Apply auth middleware to all routes in this scope
  protectedRoutes.addHook('preHandler', authenticate);

  // Register route modules
  protectedRoutes.register(threatModelRoutes, { prefix: '/api/threat-models' });
  protectedRoutes.register(threatRoutes, { prefix: '/api/threat-models' });
  protectedRoutes.register(organizationRoutes, { prefix: '/api/organizations' });
  // ... more routes
});
```

### Core API Endpoints

#### Threat Models

| Method | Endpoint | Purpose | Auth |
|--------|----------|---------|------|
| GET | `/api/threat-models` | List models (paginated) | Required |
| GET | `/api/threat-models/:id` | Get single model with canvas | Required |
| POST | `/api/threat-models` | Create new model | Required |
| PUT | `/api/threat-models/:id` | Update model | Required |
| DELETE | `/api/threat-models/:id` | Delete model | Required |

#### Threats

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/threat-models/:modelId/threats` | List threats |
| GET | `/api/threat-models/:modelId/threats/:id` | Get threat |
| POST | `/api/threat-models/:modelId/threats` | Create threat |
| PUT | `/api/threat-models/:modelId/threats/:id` | Update threat |
| DELETE | `/api/threat-models/:modelId/threats/:id` | Delete threat |

#### Organizations

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/organizations` | List user's orgs |
| GET | `/api/organizations/:id` | Get org details |
| POST | `/api/organizations` | Create org |
| PUT | `/api/organizations/:id` | Update org |
| DELETE | `/api/organizations/:id` | Delete org |
| GET | `/api/organizations/:id/members` | List members |
| POST | `/api/organizations/:id/invitations` | Send invite |

#### AI (all heavy operations are async via BullMQ)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/ai/suggest-threats` | Enqueue SUGGEST_THREATS job → returns `{ jobId }` |
| POST | `/api/threat-models/:id/ai/expert-analysis` | Enqueue SUGGEST_THREATS with expert flag |
| POST | `/api/threat-models/:id/ai/agentic-analysis` | Enqueue micro-analysis pipeline job |
| POST | `/api/threat-models/:id/ai/attack-tree` | Enqueue ATTACK_TREE job |
| POST | `/api/threat-models/:id/ai/suggest-mitigations` | Enqueue SUGGEST_MITIGATIONS job |
| POST | `/api/threat-models/:id/ai/sequence-diagram` | Enqueue SEQUENCE_DIAGRAM job |
| POST | `/api/ai/chat` | AI chat (streaming) |
| GET | `/api/ai-jobs/:id` | Poll job status (PENDING/PROCESSING/COMPLETED/FAILED) |
| GET | `/api/ai/health` | Provider health check |
| GET | `/api/ai/providers` | List configured providers |

#### Admin (Super Admin Only)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/admin/stats` | System statistics |
| GET | `/api/admin/health` | Service health check |
| GET | `/api/admin/users` | List all users (with lastLoginAt) |
| PATCH | `/api/admin/users/:id` | Update user (promote/demote) |
| DELETE | `/api/admin/users/:id` | Delete user |
| POST | `/api/admin/users/bulk-invite` | Bulk import users via CSV |
| GET | `/api/admin/organizations` | List all organizations |
| DELETE | `/api/admin/organizations/:id` | Delete organization |
| GET | `/api/admin/audit` | System audit logs |
| POST | `/api/admin/audit/purge` | Purge old audit logs |
| GET | `/api/admin/settings` | Get system settings |
| PUT | `/api/admin/settings` | Update system settings |

**System Settings include:**
- General: signups, email verification, default role
- Security: session timeout, lockout, password policy, MFA enforcement
- AI: enable/disable, provider selection
- SSO: SAML configuration
- IP Allowlist: enable/configure allowed IPs
- Email: provider and configuration
- OAuth: dynamic provider management

### Response Format

```typescript
// Success response
{
  "data": { ... },
  "meta": { }  // optional
}

// List response with pagination
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 100,
    "totalPages": 2,
    "hasNext": true,
    "hasPrev": false
  }
}

// Error response
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": { }  // optional
}
```

---

## 3. Service Layer

### AI Service Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           AI SERVICE LAYER                                   │
└─────────────────────────────────────────────────────────────────────────────┘

                         ┌────────────────────┐
                         │    AI Service      │
                         │   (Orchestrator)   │
                         └─────────┬──────────┘
                                   │
              ┌────────────────────┼────────────────────┐
              │                    │                    │
              ▼                    ▼                    ▼
┌─────────────────────┐ ┌─────────────────────┐ ┌─────────────────────┐
│  Provider Manager   │ │   AI Metrics        │ │ Streaming Handler   │
│                     │ │                     │ │                     │
│  - Health checking  │ │  - Token counting   │ │  - SSE responses    │
│  - Fallback logic   │ │  - Cost tracking    │ │  - Long-running     │
│  - Priority routing │ │  - Latency metrics  │ │    requests         │
└─────────────────────┘ └─────────────────────┘ └─────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         PROVIDER IMPLEMENTATIONS                             │
│                                                                             │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐       │
│  │   Claude     │ │   OpenAI     │ │   Gemini     │ │   Ollama     │       │
│  │  (Anthropic) │ │              │ │   (Google)   │ │   (Local)    │       │
│  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘       │
│  ┌──────────────┐ ┌──────────────┐                                         │
│  │  Vertex AI   │ │  LM Studio   │                                         │
│  │   (GCP)      │ │   (Local)    │                                         │
│  └──────────────┘ └──────────────┘                                         │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Key Methods:**

| Method | Purpose |
|--------|---------|
| `suggestThreats(context)` | Analyze model and suggest STRIDE threats |
| `suggestMitigations(threat)` | Generate mitigation strategies |
| `chat(message, history)` | Interactive security assistant |
| `isAvailable()` | Health check provider |

### BullMQ Async Job Pipeline

All AI-heavy operations are enqueued and polled — never synchronous in request handlers.

```
POST /api/ai/suggest-threats
         │
         ▼
  enqueueAiJob({ type: 'SUGGEST_THREATS', ... })
         │
         ▼ (returns immediately)
  { jobId: "cuid..." }   → client polls GET /api/ai-jobs/:id
         │
         ▼ (worker picks up from Redis queue)
  ai-worker.ts → runMicroAnalysis() → per-component per-category
         │
         ▼
  DB: AiJob.status = COMPLETED, results written to Threat table
```

**10 job types** (defined in `server/src/jobs/ai-queue.ts`):

| Job Type | Purpose |
|----------|---------|
| `SUGGEST_THREATS` | Full model micro-analysis pipeline (also handles expert mode) |
| `SUGGEST_MITIGATIONS` | Generate mitigations for existing threats |
| `EXTRACT_DOCUMENT` | AI extraction from uploaded/imported document |
| `EXTRACT_DIAGRAM` | Diagram-to-components AI extraction |
| `ATTACK_TREE` | Generate attack tree for a specific threat |
| `CALCULATE_SEVERITY` | Recalculate severity scores across model |
| `SEQUENCE_DIAGRAM` | AI-generate sequence diagram from canvas context |
| `REFINEMENT_QUESTIONS` | Generate clarification questions for model |
| `VERIFY_CITATIONS` | Verify evidence links and citation accuracy |
| `REFRESH_MITIGATIONS` | Refresh mitigation suggestions for changed threats |

**Dedup invariants (ADR-006):** DB unique constraint on `(threatModelId, targetKey, normalizedName)`. Per-model job mutex prevents concurrent runs. Session tagging enables rollback-on-failure. P2002 collisions return 409.

### Access Control Service

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       ACCESS CONTROL SERVICE                                 │
└─────────────────────────────────────────────────────────────────────────────┘

                    ┌──────────────────────────┐
                    │   Access Control Check   │
                    └────────────┬─────────────┘
                                 │
         ┌───────────────────────┼───────────────────────┐
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Organization   │    │     Project     │    │   Guest Access  │
│   Membership    │    │   Membership    │    │     (Model)     │
│                 │    │                 │    │                 │
│ OWNER > ADMIN   │    │ OWNER > EDITOR  │    │ EDITOR >        │
│ > EDITOR >      │    │ > VIEWER        │    │ COMMENTER >     │
│ VIEWER          │    │                 │    │ VIEWER          │
└─────────────────┘    └─────────────────┘    └─────────────────┘

Permission Matrix:

| Permission | OWNER | ADMIN | EDITOR | VIEWER | GUEST_EDITOR | GUEST_VIEWER |
|------------|-------|-------|--------|--------|--------------|--------------|
| view       |   ✓   |   ✓   |   ✓    |   ✓    |      ✓       |      ✓       |
| comment    |   ✓   |   ✓   |   ✓    |   ✗    |      ✓       |      ✗       |
| edit       |   ✓   |   ✓   |   ✓    |   ✗    |      ✓       |      ✗       |
| delete     |   ✓   |   ✓   |   ✗    |   ✗    |      ✗       |      ✗       |
| manage     |   ✓   |   ✓   |   ✗    |   ✗    |      ✗       |      ✗       |
| admin      |   ✓   |   ✗   |   ✗    |   ✗    |      ✗       |      ✗       |
| export     |   ✓   |   ✓   |   ✓    |   ✗    |   (config)   |      ✗       |
```

### Encryption Service

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        ENCRYPTION SERVICE                                    │
└─────────────────────────────────────────────────────────────────────────────┘

                    ┌──────────────────────────┐
                    │    Encryption Request    │
                    └────────────┬─────────────┘
                                 │
                                 ▼
                    ┌──────────────────────────┐
                    │     Key Resolution       │
                    │                          │
                    │  1. Check BYOK (org)     │
                    │  2. Fall back to system  │
                    │  3. Dev key (non-prod)   │
                    └────────────┬─────────────┘
                                 │
                                 ▼
                    ┌──────────────────────────┐
                    │    AES-256-GCM           │
                    │                          │
                    │  - 96-bit IV (NIST)      │
                    │  - 128-bit auth tag      │
                    │  - Authenticated encr.   │
                    └────────────┬─────────────┘
                                 │
                                 ▼
                    ┌──────────────────────────┐
                    │    Stored Format         │
                    │                          │
                    │  {                       │
                    │    ciphertext: base64,   │
                    │    iv: base64,           │
                    │    authTag: base64,      │
                    │    algorithm: string,    │
                    │    keyVersion: number    │
                    │  }                       │
                    └──────────────────────────┘

BYOK (Bring Your Own Key):
- Customer provides key at runtime
- Only hash stored in database
- Key rotation with version tracking
- Fallback to system key optional
```

### Audit Service

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           AUDIT SERVICE                                      │
└─────────────────────────────────────────────────────────────────────────────┘

Audit Entry Structure:

┌─────────────────────────────────────────────────────────────────────────────┐
│  scope        │ SYSTEM, ORGANIZATION, MODEL                                 │
├───────────────┼─────────────────────────────────────────────────────────────┤
│  action       │ CREATE, UPDATE, DELETE, VIEW, EXPORT, SHARE, LOGIN,        │
│               │ LOGOUT, INVITE, AI_QUERY, WEBHOOK_*, SSO_*                  │
├───────────────┼─────────────────────────────────────────────────────────────┤
│  resourceType │ THREAT_MODEL, PROJECT, ORGANIZATION, THREAT,               │
│               │ MITIGATION, USER, DFD, SEQUENCE_DIAGRAM                    │
├───────────────┼─────────────────────────────────────────────────────────────┤
│  resourceId   │ Resource identifier                                         │
├───────────────┼─────────────────────────────────────────────────────────────┤
│  changes      │ { field: { old: value, new: value } }                       │
├───────────────┼─────────────────────────────────────────────────────────────┤
│  metadata     │ { ipAddress, userAgent, ... }                               │
├───────────────┼─────────────────────────────────────────────────────────────┤
│  AI fields    │ aiProviderId, aiModel, aiInputTokens, aiOutputTokens,      │
│               │ aiLatencyMs, aiEstimatedCost                                │
└───────────────┴─────────────────────────────────────────────────────────────┘

Usage:

  logAudit({ scope, action, resourceType, resourceId, userId, ... })
  logModelAction({ modelId, action, resourceType, resourceId, ... })
  logAIUsage({ providerId, model, tokens, cost, latency, ... })
```

---

## 4. Data Layer

### Prisma Schema Overview

**84 Database Models** across 29 schema files:

| Section | Models | Purpose |
|---------|--------|---------|
| **User Management** | User, Account, Session, UserSession, ApiToken | Authentication & sessions |
| **Organization** | Organization, Membership, CustomRole, Webhook, AIProvider | Multi-tenancy |
| **Projects** | Project, ProjectMember | Project organization |
| **Threat Models** | ThreatModel, ThreatModelVersion, ModelAccess | Core models |
| **Components** | Component, ComponentInterface, Connection, Boundary | Architecture elements |
| **Threats** | Threat, Mitigation, ThreatRiskScore | Threat data |
| **Libraries** | ThreatLibrary, ThreatTemplate, MitigationLibrary | Reusable templates |
| **Diagrams** | DataFlowDiagram, DFD*, SequenceDiagram, Sequence* | Multi-diagram support |
| **Integrations** | Integration, IntegrationMapping, CIScan, CIApiKey | External systems |
| **Compliance** | RiskFramework, CustomComplianceFramework | Risk & compliance |
| **Audit** | AuditLog, ReviewRequest, Review*, Notification | Workflow & audit |

### Key Entity Relationships

```
User ─────────────────────────────────────────────────────────────────────────┐
  │                                                                            │
  ├── Membership ────────── Organization                                       │
  │                              │                                             │
  │                              ├── Project ────── ThreatModel                │
  │                              │                       │                     │
  │                              │                       ├── Component         │
  │                              │                       │      └── Interface  │
  │                              │                       ├── Connection        │
  │                              │                       ├── Boundary          │
  │                              │                       ├── Threat            │
  │                              │                       │      └── Mitigation │
  │                              │                       ├── DFD               │
  │                              │                       └── SequenceDiagram   │
  │                              │                                             │
  │                              ├── ThreatLibrary ── ThreatTemplate           │
  │                              ├── AIProvider                                │
  │                              ├── Webhook                                   │
  │                              └── Integration                               │
  │                                                                            │
  └── ApiToken, UserSession                                                    │
                                                                               │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Canvas State Storage

The threat model canvas is stored as JSON:

```typescript
// ThreatModel.canvasState (JSON string)
{
  "nodes": [
    {
      "id": "node-1",
      "type": "componentNode",
      "position": { "x": 100, "y": 200 },
      "data": {
        "type": "WEB_APP",
        "label": "Frontend",
        "trustLevel": "EXTERNAL",
        "properties": { ... }
      }
    }
  ],
  "edges": [
    {
      "id": "edge-1",
      "source": "node-1",
      "target": "node-2",
      "data": {
        "protocol": "HTTPS",
        "authentication": "JWT",
        "encrypted": true
      }
    }
  ],
  "viewport": { "x": 0, "y": 0, "zoom": 1 }
}
```

**Canvas Sync Service:**
- JSON is the source of truth
- Normalized tables (Component, Connection, Boundary) populated on-demand
- Triggered when API queries need the data
- Transaction-safe operations

---

## 5. Authentication & Authorization

### Authentication Methods

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       AUTHENTICATION FLOW                                    │
└─────────────────────────────────────────────────────────────────────────────┘

Request arrives at API
         │
         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         AUTH MIDDLEWARE                                      │
│                                                                             │
│  Check authentication methods in order:                                     │
│                                                                             │
│  1. NextAuth Session Token (Cookie)                                         │
│     └── Verify via /api/auth/session                                        │
│                                                                             │
│  2. Bearer JWT Token (Authorization header)                                 │
│     └── Verify JWT signature with JWT_SECRET                                │
│                                                                             │
│  3. CI API Key (Authorization: Bearer ftm_xxx)                              │
│     └── Hash and lookup in CIApiKey table                                   │
│                                                                             │
│  4. Guest Access Token (Query: ?token=xxx)                                  │
│     └── Validate expiry, IP whitelist, permissions                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        AUTHORIZATION CHECK                                   │
│                                                                             │
│  Access Control Service:                                                    │
│                                                                             │
│  checkOrganizationAccess(userId, orgId)                                     │
│  checkProjectAccess(userId, projectId)                                      │
│  checkThreatModelAccess(userId, modelId)                                    │
│  hasPermission(userId, modelId, 'edit')                                     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### OAuth Providers

| Provider | Type | Configuration |
|----------|------|---------------|
| GitHub | OAuth 2.0 | GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET |
| Google | OAuth 2.0 | GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET |
| Azure AD | OIDC | AZURE_AD_*, BoxyHQ SAML |
| Okta | OIDC | Via BoxyHQ SAML |
| Custom SAML | SAML 2.0 | BoxyHQ Jackson |

### Two-Factor Authentication

```typescript
// TOTP Configuration
- Digits: 6
- Window: 30 seconds
- Algorithm: SHA1
- Backup codes: 10 per setup

// Stored encrypted:
- twoFactorSecret (AES-256-GCM)
- twoFactorBackupCodes (hashed)
```

**MFA Enforcement:**
- Admin can require MFA for all users via `mfaRequired` setting
- Users without 2FA are redirected to profile to set up
- `requiresMfaSetup` flag stored in JWT token
- Frontend layout checks and enforces redirect

### Password Policy

```typescript
// Configurable via SystemSettings
passwordMinLength: number;        // default: 12
passwordRequireUppercase: boolean; // default: true
passwordRequireLowercase: boolean; // default: true
passwordRequireNumbers: boolean;   // default: true
passwordRequireSpecialChars: boolean; // default: false

// Validation service with 1-minute cache
// Location: server/src/services/password-validation.ts
validatePassword(password) -> { valid: boolean, errors: string[] }
```

### Account Lockout

```typescript
// Configurable via SystemSettings
maxLoginAttempts: number;      // default: 5
lockoutDurationMinutes: number; // default: 15

// Status tracking on User model
failedLoginAttempts: number;
lockedUntil: DateTime?;
status: 'ACTIVE' | 'LOCKED' | 'SUSPENDED';
```

---

## 6. Real-time Collaboration

### Yjs Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     COLLABORATION ARCHITECTURE                               │
└─────────────────────────────────────────────────────────────────────────────┘

Client A                    Server                    Client B
    │                          │                          │
    │    WebSocket Connect     │                          │
    │  (/ws/{modelId}?token)   │                          │
    ├─────────────────────────▶│                          │
    │                          │                          │
    │                          │    WebSocket Connect     │
    │                          │◀─────────────────────────┤
    │                          │                          │
    │    Y.Doc Instance        │    Y.Doc Instance        │
    │    ┌──────────────┐      │    ┌──────────────┐      │
    │    │ Y.Array      │      │    │ Y.Array      │      │
    │    │  ('nodes')   │◀────▶│◀──▶│  ('nodes')   │      │
    │    │ Y.Array      │      │    │ Y.Array      │      │
    │    │  ('edges')   │◀────▶│◀──▶│  ('edges')   │      │
    │    │ Y.Map        │      │    │ Y.Map        │      │
    │    │  ('threats') │◀────▶│◀──▶│  ('threats') │      │
    │    └──────────────┘      │    └──────────────┘      │
    │                          │                          │
    │         SYNC             │         SYNC             │
    │◀────────────────────────▶│◀────────────────────────▶│
    │                          │                          │
    │      AWARENESS           │      AWARENESS           │
    │  (cursors, presence)     │  (cursors, presence)     │
    │◀────────────────────────▶│◀────────────────────────▶│
    │                          │                          │


WebSocket Message Types:
- SYNC (0): Yjs document sync
- AWARENESS (1): User presence updates
- PING (2): Keep-alive
- PONG (3): Keep-alive response

Connection Timeout: 2 minutes
Heartbeat Interval: 30 seconds
```

### Redis Scaling

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      REDIS COLLABORATION SCALING                             │
└─────────────────────────────────────────────────────────────────────────────┘

                              Load Balancer
                                   │
              ┌────────────────────┼────────────────────┐
              │                    │                    │
              ▼                    ▼                    ▼
        ┌──────────┐         ┌──────────┐         ┌──────────┐
        │ Server 1 │         │ Server 2 │         │ Server 3 │
        │          │         │          │         │          │
        │ ┌──────┐ │         │ ┌──────┐ │         │ ┌──────┐ │
        │ │Y.Doc │ │         │ │Y.Doc │ │         │ │Y.Doc │ │
        │ │  A   │ │         │ │  B   │ │         │ │  C   │ │
        │ └──┬───┘ │         │ └──┬───┘ │         │ └──┬───┘ │
        └────┼─────┘         └────┼─────┘         └────┼─────┘
             │                    │                    │
             └────────────────────┼────────────────────┘
                                  │
                                  ▼
                    ┌──────────────────────────┐
                    │          REDIS           │
                    │                          │
                    │  Keys:                   │
                    │  - collab:doc:{modelId}  │
                    │  - collab:sessions:{id}  │
                    │  - collab:lock:{id}      │
                    │                          │
                    │  Pub/Sub:                │
                    │  - collab:updates:{id}   │
                    │                          │
                    └──────────────────────────┘

Cross-Server Sync:
1. Client makes change on Server 1
2. Server 1 broadcasts to Redis pub/sub
3. Server 2 & 3 receive update
4. Each server applies to their Y.Doc
5. Connected clients on all servers sync
```

---

## 7. External Integrations

### AI Providers

| Provider | Base URL | Auth | Local |
|----------|----------|------|-------|
| **Claude** | api.anthropic.com | x-api-key | No |
| **OpenAI** | api.openai.com | Bearer | No |
| **Gemini** | Google Cloud | API key | No |
| **Vertex AI** | Google Cloud | GCP creds | No |
| **Ollama** | localhost:11434 | None | Yes |
| **LM Studio** | localhost:1234 | None | Yes |

### Issue Trackers

| Integration | Features | Sync Direction | Status |
|-------------|----------|----------------|--------|
| **Jira** | Create issues from threats, sync status | Bidirectional | Implemented |
| **GitHub Issues** | Create issues, link PRs | Push-only | Implemented |
| **Azure DevOps** | Work items from threats | Bidirectional | *Planned* |
| **Linear** | Issues from threats | Push-only | *Planned* |
| **Asana** | Tasks from mitigations | Push-only | *Planned* |

### Webhook Events

```typescript
// Available webhook events
type WebhookEvent =
  | 'threat.created' | 'threat.updated' | 'threat.deleted'
  | 'mitigation.created' | 'mitigation.updated' | 'mitigation.deleted'
  | 'model.created' | 'model.updated' | 'model.deleted' | 'model.exported'
  | 'member.invited' | 'member.joined' | 'member.removed'
  | 'project.created' | 'project.deleted';

// Webhook payload
{
  "event": "threat.created",
  "timestamp": "2025-12-30T12:00:00Z",
  "data": { ... },
  "organizationId": "...",
  "modelId": "..."
}

// Signature header
X-Webhook-Signature: sha256=...
```

### CI/CD Integration

```yaml
# GitHub Actions example: validate an exported model with the ftm CLI
# (see docs/FTM_CLI.md; there is no published GitHub Action)
- name: Validate threat model
  run: |
    (cd cli && npm ci && npm run build)
    node cli/dist/cli.js validate threatforge.yaml --fail-on HIGH
```

**API Endpoints:**

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/ci/scans` | Create scan |
| GET | `/api/ci/scans/:id` | Get scan results |
| POST | `/api/ci/api-keys` | Generate API key |
| GET | `/api/ci/api-keys` | List API keys |
| DELETE | `/api/ci/api-keys/:id` | Revoke API key |

---

*For frontend architecture details, see [Frontend Architecture](./FRONTEND_ARCHITECTURE.md).*

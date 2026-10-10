# Software Architecture Design Document (SADD)

**Product:** ThreatForge
**Version:** 2.1
**Last Updated:** May 2026

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Architecture Zones](#2-architecture-zones)
3. [Technology Stack](#3-technology-stack)
4. [High-Level Component Diagram](#4-high-level-component-diagram)
5. [Security Architecture](#5-security-architecture)
6. [Data Architecture](#6-data-architecture)
7. [Integration Points](#7-integration-points)
8. [Deployment Architecture](#8-deployment-architecture)
9. [Related Documents](#9-related-documents)

---

## 1. System Overview

ThreatForge is a visual threat modeling platform that enables security teams to create, analyze, and document security threats using the STRIDE methodology with AI-enhanced threat identification.

### Core Capabilities

| Capability | Description |
|------------|-------------|
| **Visual Modeling** | React Flow canvas with Lucid-Lines suite (protocol pills, edge styles, arrowhead picker, label drag) |
| **Multi-Methodology** | STRIDE, PASTA, Kill Chain, MITRE ATT&CK — select per model |
| **Async AI Pipeline** | BullMQ-backed AI jobs: 10 types (suggest threats, mitigations, extract doc, attack tree, etc.) |
| **Micro-Analysis** | Per-component per-category analysis with confidence loops and ADR-006 dedup invariants |
| **Real-time Collaboration** | Yjs CRDT-based concurrent editing over WebSocket + Redis pub/sub |
| **Multi-Diagram Support** | Architecture canvas, DFD, and Sequence diagrams |
| **Compliance Mapping** | 12 frameworks: HIPAA, PCI-DSS 4.0, NIST 800-53, FDA, SOC2, ISO 27001, NIST CSF, OWASP ASVS, CMMC, NIST 800-171, ISO 27701, CCPA (669 controls) |
| **CI/CD Integration** | Threat model scanning in pipelines via public API v1 (9 scopes, Bearer token) |
| **Evidence Traceability** | Mitigations → test criteria → evidence links → SRS/SAD requirement traceability |
| **Smart Document Import** | AI extraction + fuzzy-merge review dialog for SRS/SAD/OpenAPI/Terraform/code |
| **Enterprise Features** | SSO/SAML, RBAC, audit logging, BYOK encryption, SCIM 2.0, custom roles |

---

## 2. Architecture Zones

```mermaid
graph TB
    subgraph Public["PUBLIC ZONE"]
        Browser[Web Browser<br/>React SPA]
        CICD[CI/CD Agent<br/>API Client]
        Mobile[Mobile Client<br/>Future]
    end

    subgraph DMZ["DMZ ZONE"]
        LB[Load Balancer / CDN<br/>SSL Termination, WAF]
    end

    subgraph App["APPLICATION ZONE"]
        subgraph Frontend["Frontend - Next.js 16"]
            AppRouter[App Router]
            Zustand[Zustand Stores]
            TanStack[TanStack Query]
            ReactFlow[React Flow Canvas]
            Yjs[Yjs CRDT]
            Features[56 Feature Modules]
        end

        subgraph Backend["Backend - Fastify 5"]
            API[API Routes<br/>79 modules]
            Services[Services<br/>41 dirs]
            Middleware[Middleware<br/>Auth, CORS, Rate Limit]
            Prisma[Prisma ORM<br/>29 files · 84 models]
            BullMQ[BullMQ<br/>10 AI job types]
            Collab[Collaboration<br/>Yjs + WebSocket]
            AIService[AI Service<br/>7 Providers]
        end
    end

    subgraph Data["DATA ZONE"]
        PostgreSQL[(PostgreSQL<br/>84 Models)]
        Redis[(Redis<br/>Collab Sync)]
        Storage[(File Storage<br/>Avatars)]
    end

    subgraph External["EXTERNAL ZONE"]
        AIProviders[AI Providers<br/>Claude, OpenAI, Gemini<br/>Ollama, LM Studio]
        OAuth[OAuth/SSO<br/>GitHub, Google<br/>Azure AD, SAML]
        Trackers[Issue Trackers<br/>Jira, GitHub]
    end

    Browser -->|HTTPS| LB
    CICD -->|HTTPS/JWT| LB
    Mobile -->|HTTPS| LB

    LB --> Frontend
    Frontend -->|REST API| Backend
    Frontend -->|WebSocket| Backend

    Backend --> PostgreSQL
    Backend --> Redis
    Backend --> Storage
    Backend -->|API Calls| AIProviders
    Backend -->|Webhooks| Trackers
    Frontend -->|OAuth| OAuth
```

### Zone Definitions

| Zone | Purpose | Trust Level | Network Access |
|------|---------|-------------|----------------|
| **Public** | End-user clients, CI/CD agents | Untrusted | Internet |
| **DMZ** | Edge services, SSL termination | Low | Internet ↔ Internal |
| **Application** | Frontend and backend services | Medium | Internal only |
| **Data** | Databases, caches, storage | High | Application zone only |
| **External** | Third-party APIs | Low | Outbound only |

---

## 3. Technology Stack

### Frontend Stack

| Layer | Technology | Version | Purpose |
|-------|------------|---------|---------|
| Framework | Next.js | 16.x | React meta-framework with App Router |
| UI Library | React | 19.x | Component-based UI |
| Language | TypeScript | 5.x | Type safety |
| Diagramming | @xyflow/react | 12.x | Node-based canvas (React Flow) |
| State (Client) | Zustand | 5.x | Lightweight client state |
| State (Server) | TanStack Query | 5.x | Server state & caching |
| Collaboration | Yjs | 13.x | CRDT-based real-time sync |
| Styling | Tailwind CSS | 4.x | Utility-first CSS |
| Components | shadcn/ui | - | Accessible component library |

### Backend Stack

| Layer | Technology | Version | Purpose |
|-------|------------|---------|---------|
| Runtime | Node.js | 22.x | JavaScript runtime |
| Framework | Fastify | 5.x | High-performance web framework |
| Language | TypeScript | 5.x | Type safety |
| ORM | Prisma | 7.x | Database abstraction |
| Auth | Auth.js | 5.x | Authentication (NextAuth) |
| AI | Custom Provider | - | Multi-provider AI abstraction (Claude, OpenAI, Gemini, Ollama, LM Studio, Vertex AI) |

### Data Layer

| Component | Technology | Purpose |
|-----------|------------|---------|
| Primary DB | PostgreSQL 17 | Relational data storage |
| Desktop DB | SQLite | Local-first desktop mode |
| Cache/Sync | Redis | Collaboration state, pub/sub |
| Encryption | AES-256-GCM | Field-level encryption |

### Infrastructure

| Component | Technology | Purpose |
|-----------|------------|---------|
| Container | Docker | Containerization (6 containers: nginx, frontend, server, db, redis, backup) |
| Job Queue | BullMQ + Redis | Async AI job processing |
| CI/CD | Your own deploy script or pipeline (optional) | Rebuilds the Compose stack on push |
| Proxy | nginx | SSL termination, static asset serving, API routing |

---

## 4. High-Level Component Diagram

```mermaid
graph TB
    subgraph FE["FRONTEND LAYER"]
        subgraph Shell["App Shell"]
            Dashboard[Dashboard<br/>Projects, Settings]
            Auth[Auth<br/>Login, Register, SSO]
            Admin[Admin Console<br/>Users, Audit]
            Canvas[Canvas Editor<br/>Full-Screen]
        end

        subgraph FeatureMods["Feature Modules - 56"]
            threats[threats]
            dashboard[dashboard]
            ai[ai]
            collab[collaboration]
            export[export]
            dfd[dfd]
            sequence[sequence]
            toolbar[toolbar]
            settings[settings]
            projects[projects]
        end

        subgraph State["State Management - Zustand"]
            canvasStore[canvas-store<br/>Nodes, Edges]
            uiStore[ui-store<br/>Panels]
            historyStore[history-store<br/>Undo/Redo]
            diagramStore[diagram-store<br/>Tabs]
        end
    end

    subgraph QueryLayer["API Layer"]
        TQ[TanStack Query Cache]
        REST[REST API]
        WS[WebSocket]
    end

    subgraph BE["BACKEND LAYER"]
        subgraph Routes["API Routes - 79 modules"]
            tmRoutes[threat-models]
            threatRoutes[threats]
            mitigRoutes[mitigations]
            orgRoutes[organizations]
            projRoutes[projects]
            aiRoutes[ai]
            authRoutes[auth]
            adminRoutes[admin]
        end

        subgraph Svc["Services - 41+"]
            AISvc[AI Service<br/>Multi-Provider]
            MicroPipe[Micro-Analysis<br/>Pipeline]
            BullMQSvc[BullMQ Jobs<br/>10 AI types]
            CollabSvc[Collaboration<br/>Yjs + WS]
            AccessSvc[Access Control<br/>RBAC]
            EncryptSvc[Encryption<br/>AES-256]
            AuditSvc[Audit Logging]
        end

        subgraph MW["Middleware"]
            AuthMW[Auth]
            CORS[CORS]
            RateLimit[Rate Limit]
            CSRF[CSRF]
        end
    end

    subgraph DL["DATA LAYER"]
        PrismaORM[Prisma ORM]
        subgraph DB["84 Database Models"]
            UserMgmt[User, Membership, Session]
            OrgMgmt[Organization, Project]
            ThreatMgmt[ThreatModel, Threat, Mitigation]
            DiagramMgmt[DFD, Sequence, DataFlow]
        end
        PG[(PostgreSQL)]
        RD[(Redis)]
        FS[(File Storage)]
    end

    Shell --> FeatureMods
    FeatureMods --> State
    State --> TQ
    TQ --> REST
    TQ --> WS

    REST --> Routes
    WS --> CollabSvc
    Routes --> MW
    MW --> Svc
    Svc --> PrismaORM
    PrismaORM --> DB
    DB --> PG
    CollabSvc --> RD
```

---

## 5. Security Architecture

### Authentication Flow

```mermaid
graph TB
    subgraph Clients["Client Authentication Methods"]
        WebBrowser[Web Browser<br/>NextAuth Session Cookie]
        APIClient[API Client<br/>Bearer JWT Token]
        CIAgent[CI/CD Agent<br/>ftm_ API Key]
    end

    subgraph AuthMW["Auth Middleware"]
        Check1[1. Check NextAuth Session Token]
        Check2[2. Check Bearer JWT Token]
        Check3[3. Check CI API Key - ftm_ prefix]
        Check4[4. Validate & Extract User Context]
    end

    subgraph RBAC["Authorization - RBAC"]
        OrgRoles[Organization Roles<br/>OWNER > ADMIN > EDITOR > VIEWER]
        ProjRoles[Project Roles<br/>OWNER > EDITOR > VIEWER]
        GuestRoles[Guest Access<br/>EDITOR > COMMENTER > VIEWER]
        SuperAdmin[System: isSuperAdmin flag]
    end

    subgraph Checks["Permission Checks"]
        checkOrg[checkOrganizationAccess]
        checkProj[checkProjectAccess]
        checkModel[checkThreatModelAccess]
        hasPerm[hasPermission]
    end

    WebBrowser --> Check1
    APIClient --> Check2
    CIAgent --> Check3
    Check1 --> Check4
    Check2 --> Check4
    Check3 --> Check4

    Check4 --> RBAC
    RBAC --> Checks
```

### Encryption Architecture

```mermaid
graph TB
    subgraph Transport["Transport Encryption"]
        TLS[TLS 1.3<br/>All HTTP/WebSocket traffic]
        Certs[Certificate Management<br/>At Load Balancer]
    end

    subgraph Field["Field-Level Encryption - AES-256-GCM"]
        APIKeys[API Keys<br/>AI providers, integrations]
        OAuthCreds[OAuth Credentials]
        WebhookSecrets[Webhook Secrets]
        SSOConfig[SSO Configuration]
        TwoFA[Two-Factor Secrets]
        EmailConfig[Email Provider Config]
    end

    subgraph KeyMgmt["Key Management"]
        SystemKey[System Key<br/>ENCRYPTION_KEY env var]
        BYOK[BYOK<br/>Customer keys per org]
        Rotation[Key Rotation<br/>Version tracking]
    end

    subgraph DBEncrypt["Database Encryption"]
        TDE[PostgreSQL TDE<br/>Optional]
        SSL[Connection SSL<br/>Required in production]
    end

    Transport --> Field
    Field --> KeyMgmt
    KeyMgmt --> DBEncrypt
```

### User Security Controls

| Control | Description | Configurable |
|---------|-------------|--------------|
| **Two-Factor Auth (TOTP)** | Time-based OTP with backup codes | Per user |
| **MFA Enforcement** | Require 2FA for all users | System setting |
| **Password Policy** | Min length, complexity requirements | System setting |
| **Account Lockout** | Auto-lock after failed attempts | System setting |
| **Session Timeout** | Configurable session duration | System setting |
| **User Suspension** | Admin can suspend user accounts | Per user |
| **API Tokens** | Personal access tokens with scopes | Per user |

### Admin Security Features

| Feature | Location | Description |
|---------|----------|-------------|
| **System Settings** | `/admin/settings` | 7 tabs of security configuration |
| **User Management** | `/admin/users` | View, promote, suspend, bulk import |
| **Audit Logs** | `/admin/audit` | Full activity tracking with export |
| **IP Allowlist** | System settings | Restrict access by IP/CIDR |
| **OAuth Management** | System settings | Dynamic provider configuration |

### Custom Role Permissions

Fine-grained permissions beyond default roles (OWNER/ADMIN/EDITOR/VIEWER):

```typescript
// Permission types
models:read, models:create, models:update, models:delete
threats:read, threats:create, threats:update, threats:delete
members:read, members:invite, members:manage
settings:read, settings:update
projects:read, projects:create, projects:update, projects:delete

// Access control service
hasCustomPermission(userId, orgId, permission)
hasAllPermissions(userId, orgId, permissions[])
hasAnyPermission(userId, orgId, permissions[])
```

---

## 6. Data Architecture

### Entity Relationship Overview

```mermaid
erDiagram
    User ||--o{ Membership : has
    User ||--o{ ApiToken : owns
    User ||--o{ UserSession : has

    Membership }o--|| Organization : belongs_to
    Organization ||--o{ Project : contains
    Organization ||--o{ Webhook : configures
    Organization ||--o{ AIProvider : configures
    Organization ||--o{ CustomRole : defines
    Organization ||--o{ Integration : connects

    Project ||--o{ ThreatModel : contains
    Project ||--o{ ProjectMember : has

    ThreatModel ||--o{ Threat : identifies
    ThreatModel ||--o{ Version : snapshots
    ThreatModel ||--|| CanvasState : stores
    ThreatModel ||--o{ Component : contains
    ThreatModel ||--o{ Connection : contains
    ThreatModel ||--o{ Boundary : contains

    Threat ||--o{ Mitigation : addressed_by
    Threat }o--o| Component : targets

    User {
        string id PK
        string email
        string name
        boolean twoFactorEnabled
    }

    Organization {
        string id PK
        string name
        string slug
        enum type
    }

    ThreatModel {
        string id PK
        string name
        json canvasState
        enum status
        int version
    }

    Threat {
        string id PK
        enum category
        string title
        enum severity
        enum status
    }

    Mitigation {
        string id PK
        string strategy
        enum status
        enum priority
    }
```

### Canvas State Storage

The threat model canvas is stored as a JSON blob containing React Flow state:

```json
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
        "properties": {}
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
  "viewport": {
    "x": 0,
    "y": 0,
    "zoom": 1
  }
}
```

**Sync Strategy:** Canvas JSON is authoritative; normalized tables (Component, Connection, Boundary) are populated on-demand via `canvas-sync` service.

---

## 7. Integration Points

### External System Integrations

```mermaid
graph TB
    subgraph AI["AI Providers"]
        Claude[Claude<br/>Cloud]
        OpenAI[OpenAI<br/>Cloud]
        Gemini[Gemini<br/>Cloud]
        Ollama[Ollama<br/>Local]
        LMStudio[LM Studio<br/>Local]
    end

    subgraph AILayer["AI Service Layer"]
        ProviderMgr[Provider Manager<br/>Health & Fallback]
    end

    subgraph Trackers["Issue Trackers"]
        Jira[Jira]
        GitHub[GitHub Issues]
    end

    subgraph TrackersFuture["Issue Trackers (Planned)"]
        Azure[Azure DevOps]
        Linear[Linear]
        Asana[Asana]
    end

    subgraph IntegLayer["Integration Service"]
        IntegSvc[Integration Service<br/>+ Mappings]
    end

    subgraph AuthProviders["Authentication Providers"]
        GitHubOAuth[GitHub OAuth]
        GoogleOAuth[Google OAuth]
        AzureAD[Azure AD OIDC]
        Okta[Okta OIDC]
        SAML[SAML<br/>BoxyHQ]
    end

    subgraph AuthLayer["Auth Layer"]
        AuthJS[Auth.js<br/>NextAuth]
    end

    Claude --> ProviderMgr
    OpenAI --> ProviderMgr
    Gemini --> ProviderMgr
    Ollama --> ProviderMgr
    LMStudio --> ProviderMgr

    Jira --> IntegSvc
    GitHub --> IntegSvc
    Azure -.-> IntegSvc
    Linear -.-> IntegSvc
    Asana -.-> IntegSvc

    GitHubOAuth --> AuthJS
    GoogleOAuth --> AuthJS
    AzureAD --> AuthJS
    Okta --> AuthJS
    SAML --> AuthJS
```

### Webhook Events

| Event Category | Events |
|----------------|--------|
| **Threats** | threat.created, threat.updated, threat.deleted |
| **Mitigations** | mitigation.created, mitigation.updated, mitigation.deleted |
| **Models** | model.created, model.updated, model.deleted, model.exported |
| **Members** | member.invited, member.joined, member.removed |
| **Projects** | project.created, project.deleted |

---

## 8. Deployment Architecture

### Docker Compose Deployment

```mermaid
graph TB
    Internet((Internet))

    subgraph Edge["Edge Layer"]
        CF[CloudFlare CDN<br/>WAF, DDoS Protection]
    end

    subgraph Host["Docker host"]
        Nginx[nginx<br/>:80/:443<br/>SSL termination]
        FE[frontend<br/>Next.js :3000]
        BE[server<br/>Fastify :3001]
        Worker[BullMQ Worker<br/>embedded in server]
        PG[(db<br/>PostgreSQL :5432)]
        RD[(redis<br/>:6379)]
        Backup[backup<br/>pg_dump cron]
    end

    Internet --> CF
    CF --> Nginx
    Nginx -->|/api/*| BE
    Nginx -->|/*| FE
    BE --> PG
    BE --> RD
    Worker --> PG
    Worker --> RD
    Backup --> PG
```

**Deploy flow (optional):** a deploy script or pipeline on the host rebuilds the images, runs `prisma db push` and restarts the containers. See [DEPLOYMENT.md](../DEPLOYMENT.md) for the manual path.

In the diagram, the CDN/WAF layer is optional; nginx can face the internet directly.

### Desktop Deployment (Electron) - Planned

> **Note:** Desktop/Electron deployment is a planned feature, not yet implemented.

```mermaid
graph TB
    subgraph Electron["Electron Shell"]
        subgraph Main["Main Process"]
            WindowMgr[Window Manager]
            IPCMain[IPC Handler]
            SQLite[(SQLite Local DB)]
        end

        subgraph Renderer["Renderer Process"]
            NextApp[Next.js App<br/>Same Codebase]
            LocalAPI[Embedded Fastify<br/>localhost]
        end
    end

    subgraph LocalAI["Local AI - Optional"]
        OllamaLocal[Ollama]
        LMStudioLocal[LM Studio]
    end

    WindowMgr --> Renderer
    IPCMain --> SQLite
    NextApp --> LocalAPI
    LocalAPI --> SQLite
    LocalAPI --> LocalAI
```

**Desktop Mode:**
- Database: SQLite (local file: `~/.threatforge/data.db`)
- AI: Ollama/LM Studio (local) or Cloud APIs (if configured)
- Collaboration: Local only (single user)

---

## 9. Related Documents

| Document | Description |
|----------|-------------|
| [Frontend Architecture](./FRONTEND_ARCHITECTURE.md) | Detailed frontend component architecture |
| [Backend Architecture](./BACKEND_ARCHITECTURE.md) | Detailed backend service architecture |
| [Data Flows](./DATA_FLOWS.md) | Request/response data flow documentation |
| [Diagrams](./DIAGRAMS.md) | Mermaid visual diagrams (components, sequences) |
| [AI Architecture](./AI_ARCHITECTURE.md) | AI implementation status & roadmap |
| [Features Guide](../FEATURES.md) | Feature module documentation |
| [API Reference](../API_REFERENCE.md) | REST API endpoint reference |
| [Data Models](../DATA_MODELS.md) | Database schema documentation |

---

*This document is maintained as the authoritative source for system architecture decisions.*

# Data Architecture — ThreatForge

**Version:** 1.0  
**Last Updated:** 2026-05-05  
**Audience:** Engineers, DevOps, enterprise IT

---

## 1. Overview

ThreatForge is a multi-tenant SaaS platform. Every piece of application data belongs to an **Organization** — the tenant boundary. This document covers how data is structured, how the frontend and backend share database access, and what changes are required for each deployment topology.

---

## 2. Tenant Data Hierarchy

All user-generated data lives in a strict ownership chain rooted at Organization:

```
Platform (single instance)
└── Organization (tenant boundary)
    ├── Members (Users × Roles)
    ├── Projects
    │   └── ThreatModels
    │       ├── Components / Connections / Boundaries  (canvas)
    │       ├── Threats / Mitigations
    │       ├── Sequences / DFDs
    │       ├── Versions (snapshots)
    │       ├── Documents (imported PDFs, code, IaC)
    │       ├── Requirements / Citations
    │       └── AiJobs
    ├── CustomRoles / CustomThreatCategories
    ├── AIProviders (per-org LLM credentials)
    ├── Webhooks / CIApiKeys
    ├── PromptTemplates / Pipelines
    └── ComplianceEvidence
```

**Tenant isolation mechanism:** Every sensitive table carries an `organizationId` column. All Prisma queries from the application layer include an `organizationId` filter. There is no database-level row security (Postgres RLS) today — isolation is enforced in the application service layer.

**Platform-level tables** (shared across all tenants): `users`, `sessions`, `audit_logs`, `system_settings`. These do not carry `organizationId`; access is controlled by `isSystemAdmin`.

---

## 3. Storage Layers

### 3.1 Primary Database (PostgreSQL / SQLite)

| Environment | Provider | Notes |
|-------------|----------|-------|
| Local dev | SQLite (`file:../server/prisma/dev.db`) | Zero setup; auto-detected from `DATABASE_URL` scheme |
| Self-hosted prod | PostgreSQL 17 (Docker container) | See §6.1 |
| GCP | Cloud SQL (PostgreSQL 17) | See §6.2 |
| AWS | RDS Aurora (PostgreSQL-compatible) | See §6.3 |

**Schema:** 29 modular `.prisma` files in `server/prisma/schema/`. PostgreSQL and SQLite are both supported via Prisma's provider auto-detection. The dev schema uses `sqlite`; the prod schema uses `postgresql`. Both share the same model definitions — Prisma handles dialect differences.

**Key tables and size characteristics:**

| Table | Tenant-scoped | Growth pattern |
|-------|--------------|----------------|
| `threat_models` | Yes | ~50 rows/org/year for active teams |
| `threats` | Yes | 10–200 per model |
| `mitigations` | Yes | 2–4 per threat |
| `documents` | Yes | Bulk: text content stored as `String` (up to 500KB/doc) |
| `ai_jobs` | Yes | High write rate during analysis; old jobs can be purged |
| `audit_logs` | Platform | High volume; append-only; needs retention policy |
| `canvas_state` | Yes | JSON blob in `ThreatModel.canvasState` (avg 50–200KB) |

> **File storage gap (current):** Document text is stored directly in the `documents.extractedText` column (up to 500KB). For cloud deployments with large files, this should be replaced with object storage (GCS/S3) with a URL reference in the DB. Tracked as future work.

### 3.2 Redis

Used for two independent workloads:

| Workload | Keys | TTL |
|----------|------|-----|
| BullMQ job queue | `bull:ai-jobs:*` | Job TTL (completed: 7 days, failed: 30 days) |
| Yjs collaboration presence | `yjs:*` | Session-scoped (auto-expiry) |
| Auth session cache | Optional (depends on Auth.js adapter) | Session TTL |

Redis is **required** for the BullMQ async AI job pipeline. Without it, async analysis falls back to synchronous execution, which hits proxy timeouts on models with more than 3-4 components.

### 3.3 In-Memory / Local State

| Layer | What | Notes |
|-------|------|-------|
| Frontend Zustand stores | Canvas nodes, edges, selection, undo history | Not persisted to DB automatically; auto-save hook flushes to API |
| TanStack Query cache | API response cache | Stale-while-revalidate; AI job poller intervals |
| BullMQ worker | Job executor in-process | Stateless workers; job state in Redis |

---

## 4. Frontend vs. Backend Database Access

This is the most important architectural decision to understand for cloud deployment.

### 4.1 Why Frontend Has Direct DB Access

**Auth.js (NextAuth) v5** is the session management library in the Next.js frontend. Auth.js requires direct database access to:
- Create and validate sessions
- Store OAuth account links
- Persist verification tokens (email verification, password reset)

This means **two application services connect to the same PostgreSQL database**:

```
                    ┌─────────────────────┐
                    │   PostgreSQL 17      │
                    └────────┬────────────┘
                             │
              ┌──────────────┴──────────────┐
              │                             │
   ┌──────────▼──────────┐    ┌─────────────▼──────────┐
   │  Next.js Frontend   │    │   Fastify Backend       │
   │  (Auth.js sessions) │    │   (all application data)│
   └─────────────────────┘    └────────────────────────┘
```

**What frontend reads/writes:**
- `sessions` table (Auth.js session tokens)
- `accounts` table (OAuth provider links)
- `verification_tokens` table (email verification)
- `users` table (read for session hydration)

**What backend reads/writes:**
- Everything else (threat models, threats, orgs, AI jobs, etc.)
- Also `users` (for profile management, admin operations)

**Implication for cloud deployments:** Both the frontend container and the backend container need a database connection string. They can share the same database and credentials, or use separate read-replica endpoints if the cloud provider supports it.

### 4.2 Session Validation Flow

```
Browser Request
      │
      ▼
  Next.js (frontend)
      │  Auth.js validates session cookie against sessions table
      │  Attaches userId + orgId to forwarded API call
      ▼
  Fastify (backend)
      │  Receives request with AUTH_URL internal validation
      │  Verifies session via GET http://frontend:3000/api/auth/session
      │  Uses userId + orgId for all DB queries
      ▼
  PostgreSQL
```

The backend does NOT read the sessions table directly. It calls back to the frontend's Auth.js session endpoint (`AUTH_URL`) for validation. This means:
- Internal Docker networking must allow backend → frontend HTTP calls
- Cloud deployments must ensure this internal URL resolves (VPC service mesh, internal load balancer, or direct container-to-container routing)

### 4.3 Connection Pooling

**Current state:** Both frontend and backend use direct Prisma connections to PostgreSQL. At high concurrency (50+ simultaneous users), this can exhaust the PostgreSQL connection limit (default: 100).

**Recommended for cloud:** Add PgBouncer in transaction pooling mode between the application containers and the database. This reduces real DB connections from O(n_containers × pool_size) to O(workers).

For managed cloud databases (Cloud SQL, RDS), the provider may include built-in connection pooling (Cloud SQL Proxy, RDS Proxy).

---

## 5. Multi-Tenancy Isolation Model

### 5.1 Application-Layer Isolation

Every Prisma query from the application layer includes an `organizationId` predicate. The pattern is enforced in service methods, not at the database level:

```typescript
// Every service method scopes by orgId
async getProjects(orgId: string) {
  return this.prisma.project.findMany({
    where: { organizationId: orgId, deletedAt: null }
  });
}
```

**Risk:** A developer who bypasses the service layer and queries Prisma directly can access cross-tenant data. Mitigations: code review, the route authorization enforcer and cross-tenant test suite, no raw SQL.

### 5.2 Data Classification

| Tier | Data | Isolation Level |
|------|------|----------------|
| **Highly Sensitive** | Threat model content, component configs, AI provider credentials (API keys) | Org-scoped; API keys encrypted at rest (A16, planned) |
| **Sensitive** | Audit logs, user identities, session tokens | Platform-scoped but access-controlled |
| **Semi-public** | Org name, project names, model names | Org-scoped; visible to all org members |
| **Public** | Compliance framework definitions, built-in threat libraries | Platform-wide; read-only for all users |

### 5.3 Quotas

Per-org quotas are configured on the `Organization` model:
- `maxMembers` — max active memberships
- `maxProjects` — max projects per org
- `maxModelsPerProject` — max threat models per project

Quotas are enforced in API route handlers. Quota management UI is in admin settings.

---

## 6. Deployment Topologies

### 6.1 Self-Hosted (Current — Docker Compose on VPS)

```
Internet ──► Cloudflare CDN ──► nginx (SSL termination, port 80/443)
                                      │
                         ┌────────────┴────────────┐
                         │                         │
                  ┌──────▼──────┐          ┌───────▼──────┐
                  │  Frontend   │          │   Backend     │
                  │  Next.js    │          │   Fastify     │
                  │  :3000      │          │   :3001       │
                  └──────┬──────┘          └───────┬───────┘
                         │                         │
                         └──────────┬──────────────┘
                                    │
                           ┌────────▼────────┐
                           │   PostgreSQL 17  │
                           │   (Docker vol)   │
                           └─────────────────┘
                                    │
                           ┌────────▼────────┐
                           │    Redis 7       │
                           │    (Docker vol)  │
                           └─────────────────┘
                                    │
                           ┌────────▼────────┐
                           │  Backup sidecar  │
                           │  pg_dump cron    │
                           └─────────────────┘
```

**Files:** `docker-compose.yml` (dev), `docker-compose.prod.yml` (prod), `nginx/nginx.conf`  
**Tested:** Docker Compose on a single 4GB RAM VPS  
**Limitations:** Single node; no HA; backup to local volume only

---

### 6.2 GCP Reference Architecture

```
Internet ──► Cloud Armor (WAF/DDoS) ──► Global HTTP(S) LB ──► Cloud CDN
                                                │
                              ┌─────────────────┴─────────────────┐
                              │           Cloud Run Services        │
                              │                                     │
                    ┌─────────▼──────────┐   ┌────────────▼──────┐
                    │  Frontend service  │   │  Backend service   │
                    │  (Next.js)         │   │  (Fastify)         │
                    │  min: 1, max: 10   │   │  min: 1, max: 20   │
                    └─────────┬──────────┘   └────────────┬──────┘
                              │                            │
                              └────────────┬───────────────┘
                                           │  Cloud SQL Proxy (auth)
                                  ┌────────▼─────────┐
                                  │  Cloud SQL        │
                                  │  PostgreSQL 17    │
                                  │  (private IP)     │
                                  └──────────────────┘
                                           │
                                  ┌────────▼─────────┐
                                  │  Memorystore      │
                                  │  Redis 7          │
                                  └──────────────────┘
                                           │
                                  ┌────────▼─────────┐
                                  │  Cloud Storage    │
                                  │  (document files, │
                                  │   backups)        │
                                  └──────────────────┘
```

**GCP-specific considerations:**

| Component | GCP Service | Notes |
|-----------|-------------|-------|
| Frontend | Cloud Run | Stateless; auto-scales to 0; set `--min-instances=1` to avoid cold start |
| Backend | Cloud Run | Worker pool; `REDIS_URL` points to Memorystore via VPC connector |
| Database | Cloud SQL (PostgreSQL 17) | Private IP inside VPC; Cloud SQL Auth Proxy for connection |
| Redis | Memorystore for Redis | Standard tier for HA; Basic tier for dev |
| File storage | Cloud Storage (GCS) | Replace in-DB document text for large files (future migration) |
| Secrets | Secret Manager | `DATABASE_URL`, `JWT_SECRET`, `AUTH_SECRET`, AI provider keys |
| Networking | VPC + Serverless VPC Access Connector | Required for Cloud Run → Cloud SQL (private IP) and Memorystore |
| SSL | Google-managed certificate on LB | Automatic renewal |
| Backups | Cloud SQL automated backups | Daily + PITR (point-in-time recovery) |

**Environment variables for GCP:**
```bash
DATABASE_URL=postgresql://user:pass@/dbname?host=/cloudsql/project:region:instance
REDIS_URL=redis://10.x.x.x:6379          # Memorystore private IP
AUTH_URL=https://your-domain.com
AUTH_SECRET=<secret-manager-value>
```

**Required infra changes:**
1. Add Serverless VPC Access connector to both Cloud Run services
2. Replace `sqlite` provider in `00-config.prisma` with `postgresql` (already done for prod)
3. Set `AUTH_URL` to the public domain (not `http://frontend:3000`)
4. Add Cloud Storage bucket + SDK for document file storage (future)
5. Frontend and backend Cloud Run services need `--vpc-connector` flag

---

### 6.3 AWS Reference Architecture

```
Internet ──► CloudFront (CDN) ──► ALB (Application Load Balancer)
                                          │
                         ┌────────────────┴────────────────┐
                         │            ECS Fargate            │
                         │                                   │
               ┌─────────▼──────────┐   ┌──────────▼──────┐
               │  Frontend task     │   │  Backend task    │
               │  (Next.js)         │   │  (Fastify)       │
               │  desired: 1-5      │   │  desired: 1-10   │
               └─────────┬──────────┘   └──────────┬───────┘
                         │                          │
                         └──────────┬───────────────┘
                                    │  (private subnet)
                           ┌────────▼────────┐
                           │  RDS Aurora     │
                           │  PostgreSQL 17  │
                           │  (Multi-AZ)     │
                           └─────────────────┘
                                    │
                           ┌────────▼────────┐
                           │  ElastiCache    │
                           │  Redis 7        │
                           └─────────────────┘
                                    │
                           ┌────────▼────────┐
                           │  S3 Bucket      │
                           │  (documents,    │
                           │   backups)      │
                           └─────────────────┘
```

**AWS-specific considerations:**

| Component | AWS Service | Notes |
|-----------|-------------|-------|
| Frontend | ECS Fargate (or App Runner) | Stateless; attach to ALB target group |
| Backend | ECS Fargate | Worker service; can scale independently |
| Database | RDS Aurora PostgreSQL (Serverless v2 for dev) | Multi-AZ for prod; read replicas optional |
| Redis | ElastiCache for Redis (cluster mode off) | Single shard sufficient; cluster mode for HA |
| File storage | S3 | Document text migration (future); backup dumps |
| Secrets | AWS Secrets Manager + SSM Parameter Store | Database credentials, JWT secrets, API keys |
| Networking | VPC, private subnets, security groups | Frontend and backend in private subnets; ALB in public |
| SSL | ACM certificate on ALB | Automatic renewal |
| Backups | RDS automated backup + S3 lifecycle | 7-day retention, PITR |

**Environment variables for AWS:**
```bash
DATABASE_URL=postgresql://user:pass@rds-endpoint:5432/flowthreat
REDIS_URL=redis://elasticache-endpoint:6379
AUTH_URL=https://your-domain.com
AUTH_SECRET=<secrets-manager-value>
```

---

### 6.4 Kubernetes (GKE / EKS)

Kubernetes deployment uses Helm charts targeting either GKE or EKS. The topology mirrors the cloud-provider architectures above but with k8s primitives.

**Helm chart values (planned — `deploy/helm/`):**

```yaml
frontend:
  image: ghcr.io/bpmforge/threatforge-frontend
  replicas: 2
  resources:
    requests: { cpu: 250m, memory: 512Mi }
    limits: { memory: 1Gi }

backend:
  image: ghcr.io/bpmforge/threatforge-backend
  replicas: 3
  resources:
    requests: { cpu: 500m, memory: 512Mi }
    limits: { memory: 1Gi }

postgresql:
  enabled: false          # Use external managed DB in prod
  externalUrl: ""         # Set to managed DB URL

redis:
  enabled: true           # Embedded for dev; use managed for prod
  externalUrl: ""

ingress:
  enabled: true
  className: nginx
  host: threatforge.example.com
  tls: true
```

**Status:** Helm chart is planned for Q3 2026. Current k8s directory is a stub.

---

## 7. Database Migration Strategy

### 7.1 Dev → Prod Schema Sync

```bash
# Backend: run migrations
cd server && npx prisma migrate deploy

# Frontend: sync generated schema from backend
cd frontend && npm run schema:sync && npm run schema:generate
```

**Rule:** `server/prisma/schema/*.prisma` is the source of truth. Never edit `frontend/prisma/schema.prisma` directly.

### 7.2 Zero-Downtime Migrations

The current migration strategy (Prisma Migrate) may lock tables during schema changes. For production systems with concurrent users:
- Prefer additive migrations (new columns with defaults) over destructive ones
- Use `@default` and `?` (nullable) on new fields to avoid full-table rewrites
- For large table renames or column drops, use a two-phase migration: (1) add new, (2) backfill, (3) drop old in next release

---

## 8. Multi-Tenancy Gaps and Improvements

### 8.1 Current Gaps

| Gap | Impact | Plan |
|-----|--------|------|
| No Postgres RLS | Cross-tenant data exposure if service layer bypassed | Add RLS as defense-in-depth in Q4 2026 |
| No per-tenant data encryption | FedRAMP/HIPAA requires encryption at rest | **A16 — Encryption at Rest (Q3 2026, P0)** |
| Document text in DB | Large documents bloat the DB; no CDN offload | Migrate to GCS/S3 storage backend (Q3/Q4 2026) |
| No SCIM | Enterprise IT can't automate user provisioning | **A19 — SCIM (Q4 2026, P2)** |
| No connection pooling | OOM risk at >30 concurrent users on shared PG | Add PgBouncer or Prisma Accelerate (Q3 2026) |
| Frontend DB access | Complicates cloud networking; security surface | Long-term: move Auth.js to edge/JWT sessions |

### 8.2 Connection Pooling Plan

For self-hosted: add PgBouncer sidecar to `docker-compose.prod.yml`.  
For GCP: use Cloud SQL Proxy with built-in connection pooling.  
For AWS: use RDS Proxy.  
For both: cap Prisma's `connection_limit` in `DATABASE_URL` query param.

```
DATABASE_URL=postgresql://user:pass@host:5432/db?connection_limit=10&pool_timeout=20
```

---

## 9. Data Residency

ThreatForge threat model content (architecture diagrams, threats, component descriptions) may constitute sensitive technical information. Regulated customers require:

- **Data stays in region:** Deploy the full stack (DB + Redis + app) in the customer's required region. No cross-region data replication in current architecture.
- **AI data boundary:** When the configured AI provider is cloud-based (Claude, OpenAI, Gemini), architectural data is sent to that provider for analysis. This must be disclosed. The AI data residency warning (gap A17) surfaces this in the UI.
- **Local LLM option:** Ollama and LM Studio providers keep data fully on-premises. Recommended for HIPAA/FedRAMP deployments.

---

## 10. Backup and Recovery

| Target | Strategy | Current Status |
|--------|----------|----------------|
| Self-hosted | `pg_dump` cron daily via backup container; 7-day rotation | ✅ Live |
| GCP | Cloud SQL automated backup (daily + PITR 7 days) | Documented; not yet deployed |
| AWS | RDS automated backup (daily + PITR 35 days) | Documented; not yet deployed |
| Redis | Redis AOFP persistence; Memorystore snapshots | Configured in Docker; managed on cloud |
| Application data | YAML export per model (git-diffable) | ✅ Live |

**Recovery targets (aspirational):**
- RTO (Recovery Time Objective): < 4 hours for self-hosted; < 1 hour for cloud-managed
- RPO (Recovery Point Objective): < 24 hours self-hosted; < 1 hour cloud-managed (PITR)

---

*Data Architecture v1.0 — 2026-05-05. Update when cloud deployment is implemented.*

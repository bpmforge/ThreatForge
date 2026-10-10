# ThreatForge — C2 Container Diagram

_Derived from `docs/sdlc/C4_ARCHITECTURE.md`. All six runtime containers._

---

```mermaid
C4Container
  title ThreatForge — Containers

  Person(user, "User", "Browser on desktop / mobile")

  Container(nginx, "Nginx", "Reverse Proxy", "Terminates TLS, routes /api/* → backend, /api/collaboration/* → backend WS, everything else → frontend. Config at nginx/nginx.conf")
  Container(frontend, "Next.js App", "Next.js 16 / React 19 / TypeScript", "Server-side rendering, Auth.js session management, canvas editor, API proxy routes. Port 3000")
  Container(backend, "Fastify API + BullMQ Worker", "Node.js 22 / Fastify 5 / TypeScript", "REST API, WebSocket server (Yjs collaboration), BullMQ workers (AI jobs), business logic. Port 3001")
  ContainerDb(postgres, "PostgreSQL 17", "Relational Database", "All persistent data — models, threats, mitigations, compliance, audit logs. Primary store. Port 5432")
  ContainerDb(redis, "Redis 7", "In-Memory Store", "BullMQ job queues (AI jobs, sync jobs), Yjs real-time collaboration pub/sub, session cache. Port 6379")
  Container(backup, "Backup Service", "Shell + pg_dump", "Daily automated PostgreSQL backup with 7-day retention. Runs as a separate container on a cron schedule.")

  Rel(user, nginx, "All traffic", "HTTPS :443")
  Rel(nginx, frontend, "Page requests, auth callbacks", "HTTP :3000")
  Rel(nginx, backend, "/api/* REST + /api/collaboration/* WebSocket", "HTTP/WS :3001")
  Rel(frontend, backend, "Internal API calls (SSR) via internalBackendUrl()", "HTTP :3001")
  Rel(backend, postgres, "Reads & writes via Prisma 7", "TCP :5432")
  Rel(backend, redis, "Job queues + Yjs collaboration pub/sub", "TCP :6379")
  Rel(frontend, redis, "Session store (Auth.js)", "TCP :6379")
  Rel(backup, postgres, "pg_dump daily snapshot", "TCP :5432")
```

---

## Container Responsibilities

| Container | Owns | Does NOT own |
|-----------|------|--------------|
| **Nginx** | TLS termination, routing, WebSocket upgrade, static file caching | Business logic, auth |
| **Next.js** | UI rendering, Auth.js sessions, server actions, API proxy | AI processing, DB writes |
| **Fastify** | All business logic, AI jobs, WebSocket server (Yjs), data persistence | UI rendering, session cookies |
| **PostgreSQL** | Durable state for all domain objects | Ephemeral state, queues |
| **Redis** | Job queues (BullMQ), Yjs pub/sub, session cache | Durable business data |
| **Backup** | Scheduled pg_dump, 7-day retention, stored on host volume | Serving requests |

---

## External Systems

```mermaid
C4Context
  title ThreatForge — External Dependencies

  System(tf, "ThreatForge", "Visual threat modelling platform")

  System_Ext(aiProviders, "AI Providers", "Claude (Anthropic), OpenAI, Azure OpenAI, Google Vertex AI, Ollama, LM Studio, OpenRouter")
  System_Ext(idp, "Identity Providers", "Azure Entra ID, Okta, Google, GitHub OAuth, Apple, BoxyHQ SAML")
  System_Ext(vcs, "Version Control", "GitHub, GitLab, Bitbucket — repo scanning and PR comments")
  System_Ext(issueTracker, "Issue Trackers", "Jira — two-way mitigation/ticket sync")
  System_Ext(secScanners, "Security Scanners", "Snyk, SonarQube, OWASP ZAP — imported findings")
  System_Ext(messaging, "Messaging", "Slack, Microsoft Teams — threat notifications")
  System_Ext(email, "Email Provider", "SMTP — invitations, review requests, alerts")

  Rel(tf, aiProviders, "Sends component context; receives threat suggestions", "HTTPS/REST")
  Rel(tf, idp, "Delegates authentication (SSO/SAML/OIDC)", "HTTPS/OAuth2/SAML")
  Rel(tf, vcs, "Scans repos for components; posts PR comments", "HTTPS/REST")
  Rel(tf, issueTracker, "Creates/syncs Jira tickets from mitigations", "HTTPS/REST")
  Rel(tf, secScanners, "Pulls vulnerability findings into canvas", "HTTPS/REST")
  Rel(tf, messaging, "Posts threat alerts and review requests", "HTTPS/Webhooks")
  Rel(tf, email, "Sends invitations and notifications", "SMTP")
```

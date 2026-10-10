# ThreatForge

A visual threat modeling tool built with React Flow for security architects and development teams. Create, analyze, and document security threats using STRIDE methodology with AI-enhanced threat identification.

## Features

- Visual drag-and-drop threat model canvas
- Trust boundaries and component grouping
- STRIDE-based threat identification with AI suggestions
- Mitigation tracking and assignment
- Real-time collaboration (Yjs-based)
- Export to PDF, JSON, YAML, PNG, SVG
- Sequence diagrams linked to threat models
- Multi-user support with SSO

## Quick Start

### Clone

```bash
git clone https://github.com/bpmforge/ThreatForge.git
cd ThreatForge
```

### Local Demo (Docker)

```bash
./scripts/demo.sh
```

Open http://localhost:3000

### Development

Runs the frontend and backend directly against a local SQLite database — no
Docker or Postgres required. The provider is auto-detected from the
`DATABASE_URL` scheme (`file:` → SQLite).

```bash
# 1. Backend: install, configure, generate the Prisma client, create the schema
cd server
npm install
cp .env.example .env
npx prisma generate

# Required vars in server/.env (see the file for the full list with comments):
#   DATABASE_URL       file:./prisma/dev.db   (default in .env.example)
#   ENCRYPTION_KEY      openssl rand -base64 32   (a random key is generated per
#                        process if left blank in dev, but encrypted data
#                        becomes unreadable across restarts — set it)
#   JWT_SECRET           openssl rand -base64 32
#   CORS_ORIGIN          http://localhost:3000
# Optional: AI_EMBEDDING_BASE_URL / AI_EMBEDDING_MODEL (citation verifier;
# defaults to a local LM Studio endpoint and can be left as-is if unused).

npm run db:push          # create the SQLite schema (no migrations folder for SQLite)
INITIAL_SYSTEM_ADMIN_EMAIL="admin@example.com" \
INITIAL_SYSTEM_ADMIN_PASSWORD="ChangeMe123x" \
  npm run admin:bootstrap  # create/promote the first system admin
npm run seed:pipelines    # seed the AI threat-analysis prompt pipeline
npm run db:seed           # seed built-in model templates

npm run dev               # backend on :3001
```

```bash
# 2. Frontend (separate terminal): install, configure, generate, run
cd frontend
npm install
cp .env.example .env
npx prisma generate

# Required vars in frontend/.env:
#   AUTH_SECRET          openssl rand -base64 32
#   AUTH_URL             http://localhost:3000
#   DATABASE_URL          must point at the SAME SQLite file as the backend
#                         and be an ABSOLUTE path (NextAuth's Prisma adapter
#                         resolves relative paths differently from the
#                         backend) — e.g. file:/absolute/path/to/server/prisma/dev.db
#   NEXT_PUBLIC_API_URL   http://localhost:3001

npm run dev                # frontend on :3000
```

Open http://localhost:3000/login and sign in with the admin credentials
created by `admin:bootstrap` above.

## Deployment Options

### Option 1: Docker Compose (Simplest)

For demos and small teams:

```bash
cp .env.example .env
# Set JWT_SECRET and AUTH_SECRET (each: openssl rand -base64 32) and the
# INITIAL_SYSTEM_ADMIN_* credentials in .env; compose refuses to start without
# the two secrets
docker compose up --build -d
# open http://localhost:3000/login  (admin credentials: INITIAL_SYSTEM_ADMIN_* in .env)
```

A one-shot `init` service pushes the schema, seeds, and bootstraps the admin
before the API starts. See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

### Option 2: Production with SSL

For production deployments:

```bash
# 1. Configure environment
cp .env.prod.example .env.prod
# Edit .env.prod with your domain and secrets (JWT_SECRET, AUTH_SECRET and
# ENCRYPTION_KEY are required; generate each with: openssl rand -base64 32)

# 2. Add SSL certificates
mkdir -p nginx/certs
# Copy fullchain.pem and privkey.pem to nginx/certs/
# Or use Let's Encrypt: certbot certonly --standalone -d your-domain.com

# 3. Deploy
./scripts/deploy-prod.sh
```

On a fresh production install the setup wizard asks for a setup token. Set
`SETUP_TOKEN` in `.env.prod`, or read the generated one from the server log
(`docker compose -f docker-compose.prod.yml logs server | grep "Setup token"`).

### Option 3: Kubernetes

See [Cloud Deployment](./docs/DEPLOYMENT_CLOUD.md) and the Helm chart and manifests under [`deploy/`](./deploy/).

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Nginx                                │
│                    (SSL termination)                         │
└──────────────────────┬──────────────────────────────────────┘
                       │
        ┌──────────────┴──────────────┐
        │                             │
        ▼                             ▼
┌───────────────┐           ┌─────────────────┐
│   Frontend    │           │     Backend     │
│  (Next.js)    │◄─────────►│   (Fastify)     │
│   Port 3000   │           │   Port 3001     │
└───────────────┘           └────────┬────────┘
                                     │
                                     ▼
                            ┌─────────────────┐
                            │   PostgreSQL    │
                            │   Port 5432     │
                            └─────────────────┘
```

The server also uses Redis (BullMQ job queue for AI jobs); see `docker-compose.yml`.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 16, React 19, TypeScript |
| Diagramming | React Flow (@xyflow/react 12) |
| State | Zustand, TanStack Query |
| Collaboration | Yjs (CRDT) |
| Styling | Tailwind CSS 4, shadcn/ui |
| Backend | Node.js 22, Fastify 5 |
| Database | PostgreSQL 17, Prisma |
| Auth | Auth.js (NextAuth) 5 |
| AI | Provider adapters for Claude, OpenAI, Gemini, Vertex AI, Ollama and LM Studio |

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `POSTGRES_USER` | Database username | Yes |
| `POSTGRES_PASSWORD` | Database password | Yes |
| `POSTGRES_DB` | Database name | Yes |
| `JWT_SECRET` | JWT signing secret | Yes |
| `AUTH_SECRET` | NextAuth secret | Yes |
| `ENCRYPTION_KEY` | Key for field-level encryption at rest (`openssl rand -base64 32`). Required in production, where `ENCRYPT_AT_REST` defaults to `true`; optional in the dev compose stack, where it defaults to `false`. Keep it: encrypted data cannot be read without it. | Prod |
| `SETUP_TOKEN` | Token for the first-run setup wizard. If unset, the server generates one and logs `Setup token: ...` | Optional |
| `TRUST_PROXY` | Which proxies may set the client IP via `X-Forwarded-For`: `false`, or a comma-separated list of proxy addresses/CIDRs. Default: `loopback,linklocal,uniquelocal` | Optional |
| `DOMAIN` | Production domain | Prod only |
| `ANTHROPIC_API_KEY` | Claude API key | Optional |
| `OPENAI_API_KEY` | OpenAI API key | Optional |

## Commands

```bash
# Development
./scripts/demo.sh              # Start demo environment
docker compose logs -f          # View logs
docker compose down             # Stop services
docker compose down -v          # Stop and remove data

# Production
./scripts/deploy-prod.sh        # Deploy with SSL
docker compose -f docker-compose.prod.yml ps      # Status
docker compose -f docker-compose.prod.yml logs -f # Logs
```

## CLI

`ftm validate model.yaml [--fail-on CRITICAL] [--json]` validates a threat-model YAML and exits non-zero on unmitigated threats (CI gate). See [FTM CLI](./docs/FTM_CLI.md).

## Documentation

- [Documentation index](./docs/README.md)
- [User Guide](./docs/USER_GUIDE.md)
- [Deployment](./docs/DEPLOYMENT.md) and [Admin Runbook](./docs/ADMIN_RUNBOOK.md)
- [API Reference](./docs/API_REFERENCE.md)
- [Architecture (SADD)](./docs/architecture/SADD.md)
- [Contributing](./CONTRIBUTING.md)

## License

ThreatForge is **source-available** under the [Functional Source License,
Version 1.1 (FSL-1.1-ALv2)](./LICENSE) — **not** an OSI open-source license.

In plain terms:

- **Allowed:** free to read, modify, self-host, and use internally (including at a
  for-profit company), plus non-commercial education and research.
- **Not permitted:** offering ThreatForge to others as a competing
  commercial product or hosted/managed service.
- Each released version converts to **Apache 2.0** two years after release.

Want to host or resell ThreatForge commercially? See
[COMMERCIAL.md](./COMMERCIAL.md) for a commercial license.

Copyright © 2026 Bradford Matthews (bpmforge).

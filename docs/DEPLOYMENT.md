# Deployment Guide

This guide covers deploying ThreatForge to production environments.

## Quick Start: Docker Compose (Recommended)

For a 4GB RAM Linux server, use Docker Compose:

```bash
# 1. On your production server, run the setup script
curl -fsSL your-server/deploy/setup-server.sh | sudo bash

# 2. Clone the repository
cd /opt/threatforge
sudo -u deploy git clone <your-repo-url> .

# 3. Configure environment
cp .env.prod.example .env.prod
nano .env.prod  # Set DOMAIN, POSTGRES_PASSWORD, JWT_SECRET, AUTH_SECRET

# 4. Setup SSL (Let's Encrypt)
sudo ./deploy/setup-letsencrypt.sh your-domain.com admin@example.com

# 5. Deploy
./deploy/deploy.sh --build
```

Production compose specifics (`docker-compose.prod.yml`):

- `ENCRYPT_AT_REST` defaults to **true** and `ENCRYPTION_KEY` is **required** -
  compose refuses to start without it (`openssl rand -base64 32`). Key backup,
  backfill and rotation: [ADMIN_RUNBOOK.md section 3](ADMIN_RUNBOOK.md#3-encryption-at-rest).
- A one-shot `init` service runs `db:push`, `seed:pipelines`, `db:seed` and
  `admin:bootstrap` before the API starts. Set `INITIAL_SYSTEM_ADMIN_EMAIL` and
  `INITIAL_SYSTEM_ADMIN_PASSWORD` in `.env.prod` (required).

See [deploy/](../deploy/) for scripts:
- `setup-server.sh` - Prepare a fresh Linux server
- `deploy.sh` - Deploy or update the application
- `backup.sh` - Database backup and restore
- `generate-self-signed-cert.sh` - Self-signed SSL for testing
- `setup-letsencrypt.sh` - Let's Encrypt SSL for production

For a single-host install without the server setup above, `make deploy`
(`scripts/deploy-prod.sh`) brings the production compose stack up with a
self-signed certificate, and `make db-backup` (`scripts/backup-db.sh`) dumps
the database.

---

## Fresh clone: `docker compose up`

Demo stack (Compose >= 2.24; Docker or Podman):

```bash
# clone the repository, then:
cp .env.example .env
# set JWT_SECRET and AUTH_SECRET (each: openssl rand -base64 32); compose
# refuses to start without them
docker compose up --build -d
# init (db:push, seeds, admin bootstrap) runs first, then server, then frontend
open http://localhost:3000/login   # admin@example.com / ChangeMe123x (see .env)
curl -s http://localhost:3001/health
```

`docker-compose.override.yml` is auto-loaded here: it publishes ports 3000/3001
and replaces the external frontend network that the production Compose file expects with a local one. Passing
`-f docker-compose.yml` explicitly skips it.
Change the default admin credentials in `.env` before exposing the stack.

## SAML SSO (BoxyHQ Jackson)

Jackson is an optional service defined in `docker-compose.saml.yml`, layered on
top of the main compose file. `JACKSON_EXTERNAL_URL`, `JACKSON_NEXTAUTH_SECRET`
and `JACKSON_API_KEYS` are required when it is enabled.

```bash
# .env / .env.prod
JACKSON_EXTERNAL_URL=https://jackson.example.com   # browser/IdP-reachable URL
JACKSON_NEXTAUTH_SECRET=$(openssl rand -base64 32)
JACKSON_API_KEYS=$(openssl rand -hex 32)
AUTH_BOXYHQ_SAML_ISSUER=https://jackson.example.com
AUTH_BOXYHQ_SAML_ID='tenant=<tenant>&product=<product>'   # tenant+product of the Jackson connection
AUTH_BOXYHQ_SAML_SECRET=dummy                              # or the connection's clientSecret / CLIENT_SECRET_VERIFIER

docker compose -f docker-compose.yml -f docker-compose.saml.yml up -d        # dev stack (port 5225)
docker compose -f docker-compose.prod.yml -f docker-compose.saml.yml up -d   # prod
```

Jackson stores its state in the same PostgreSQL database (its own tables). The
server's `/auth-public/providers` endpoint lists the "SSO" provider when
**both** `AUTH_BOXYHQ_SAML_ISSUER` is set and SAML is enabled in Admin >
Settings. In production, proxy Jackson on its own HTTPS hostname (nginx ->
`jackson:5225`); the IdP and browsers must reach `JACKSON_EXTERNAL_URL`.
Register the IdP connection through Jackson's admin UI/API. The compose
variable `JACKSON_API_KEYS` is passed to the container as Jackson's `API_KEYS`
(comma-separated keys for `/api/v1/`). The Jackson port binds to
127.0.0.1 unless `JACKSON_BIND` is set.

The image is `boxyhq/jackson`, pinned to `26.2.0` (override with
`JACKSON_VERSION`); the product is now documented as Ory Polis and uses the
same image. The OAuth client id has the form `tenant=<t>&product=<p>` with the
secret `dummy`. `/api/health` returns `{"version": ...}`.

Not tested: Jackson's SQL migrations alongside the app tables in the shared
database, and whether the frontend container can reach
`AUTH_BOXYHQ_SAML_ISSUER` for the server-side token call (a public URL may need
an extra_hosts route).

---

## Prerequisites

- **Node.js 22+** - JavaScript runtime
- **npm 10+** - Package manager
- **Database** - SQLite (default) or PostgreSQL 17

## Environment Variables

### Backend (`server/.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | Database connection string |
| `JWT_SECRET` | Production | JWT signing secret (32+ chars) |
| `PORT` | No | Server port (default: 3001) |
| `CORS_ORIGIN` | No | Allowed CORS origin |
| `TRUST_PROXY` | No | Proxies whose `X-Forwarded-For` is trusted for the client IP: `false`, or a comma-separated list of proxy addresses/CIDRs. Default: `loopback,linklocal,uniquelocal` |
| `SETUP_TOKEN` | No | Token for production setup. If unset, the server generates one and logs `Setup token: ...` |
| `ENCRYPTION_KEY` | Production | Data encryption key (32+ chars) |
| `REDIS_URL` | No | Redis URL for collaboration |

### Frontend (`frontend/.env.local`)

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | Database connection string |
| `AUTH_SECRET` | Yes | Auth.js secret (32+ chars) |
| `AUTH_URL` | Yes | Frontend URL |
| `NEXT_PUBLIC_API_URL` | Yes | Backend API URL |

### AI Providers (Optional)

| Variable | Description |
|----------|-------------|
| `ANTHROPIC_API_KEY` | Claude API key |
| `OPENAI_API_KEY` | OpenAI API key |
| `GOOGLE_AI_API_KEY` | Google AI key |
| `OLLAMA_BASE_URL` | Ollama server URL |
| `LMSTUDIO_BASE_URL` | LM Studio URL |

---

## Database Configuration

### Single Source of Truth

The backend schema (`server/prisma/schema/`) is the **source of truth**. Both frontend and backend share the same database.

**Database provider is auto-detected** from the `DATABASE_URL` scheme:
- `file:` or `file:./path` → SQLite
- `postgresql://` or `postgres://` → PostgreSQL

### SQLite (Default)

Best for: Desktop deployments, small teams, development.

```env
# Backend
DATABASE_URL="file:./prisma/dev.db"

# Frontend (relative path to backend db)
DATABASE_URL="file:../server/prisma/dev.db"
```

### PostgreSQL (Production)

Best for: Cloud deployments, large teams, high availability.

```env
# Both backend and frontend use the same URL
DATABASE_URL="postgresql://user:password@host:5432/dbname"
```

### Schema Sync

After modifying the backend schema, sync to frontend:

```bash
# From project root
cd frontend
npm run schema:sync      # Syncs schema from backend
npx prisma generate      # Generates Prisma client

# Or combined
npm run schema:generate  # Both sync and generate
```

---

## Initial Setup

### Option 1: Web Setup

1. Start the servers:
   ```bash
   cd server && npm run dev
   cd frontend && npm run dev
   ```

2. Navigate to http://localhost:3000/setup

3. Create admin account and organization

### Option 2: CLI Setup (Headless)

For automated deployments without browser access:

```bash
cd server

# Check current status
npm run setup:cli -- --check

# Initialize with all options
npm run setup:cli -- \
  --admin-email admin@example.com \
  --admin-password "SecurePassword123!" \
  --admin-name "Admin User" \
  --org-name "My Company" \
  --org-slug my-company

# JSON output for CI/CD
npm run setup:cli -- \
  --admin-email admin@example.com \
  --admin-password "SecurePass123!" \
  --org-name "My Company" \
  --json
```

**Exit Codes:**
| Code | Description |
|------|-------------|
| 0 | Success |
| 1 | Already setup |
| 2 | Validation error |
| 3 | Database error |

### Setup Token (Production)

For security, require a token for production setup:

```bash
# Generate token
openssl rand -hex 32

# Set in environment
export SETUP_TOKEN=<generated-token>
```

Then provide the token when initializing:
- **Web:** Enter token in the setup form
- **CLI:** `npm run setup:cli -- --setup-token <token> ...`
- **API:** `X-Setup-Token: <token>` header

---

## Health Endpoints

Use these endpoints for monitoring and Kubernetes probes.

### Liveness Probe

```bash
curl http://localhost:3001/health/live
```

Returns `200 OK` if process is running. Use for Kubernetes `livenessProbe`.

### Readiness Probe

```bash
curl http://localhost:3001/health/ready
```

Returns `200 OK` if ready to accept traffic, `503` if dependencies unavailable.
Use for Kubernetes `readinessProbe`.

### Dependency Check

```bash
# Needs METRICS_TOKEN set on the server (404 otherwise)
curl -H "Authorization: Bearer $METRICS_TOKEN" http://localhost:3001/health/dependencies
```

Detailed startup verification. Checks:
- Database connectivity and provider type
- Redis connection (if configured)
- Encryption key (production)
- Required environment variables

Example response:
```json
{
  "ready": true,
  "checks": {
    "database": { "ok": true, "provider": "postgresql", "latencyMs": 5 },
    "redis": { "ok": true, "required": false },
    "encryption": { "ok": true },
    "envVars": { "ok": true }
  }
}
```

### Comprehensive Health

```bash
curl http://localhost:3001/health
```

Full health status including:
- Database (with latency)
- Redis
- Connection pool (PostgreSQL)
- Memory usage
- CPU usage

### Prometheus Metrics

```bash
# Needs METRICS_TOKEN set on the server (404 otherwise); give Prometheus the same bearer token
curl -H "Authorization: Bearer $METRICS_TOKEN" http://localhost:3001/metrics
```

Prometheus-format metrics for observability platforms.

---

## Docker Deployment

### Build Images

```bash
# Backend
docker build -t threatforge-server ./server

# Frontend
docker build -t threatforge-frontend ./frontend
```

### Docker Compose

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:17
    environment:
      POSTGRES_USER: flowuser
      POSTGRES_PASSWORD: flowpass
      POSTGRES_DB: flowthreat
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U flowuser"]
      interval: 10s
      timeout: 5s
      retries: 5

  server:
    build: ./server
    environment:
      DATABASE_URL: postgresql://flowuser:flowpass@postgres:5432/flowthreat
      JWT_SECRET: ${JWT_SECRET}
      ENCRYPTION_KEY: ${ENCRYPTION_KEY}
      SETUP_TOKEN: ${SETUP_TOKEN}
    ports:
      - "3001:3001"
    depends_on:
      postgres:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3001/health/ready"]
      interval: 30s
      timeout: 10s
      retries: 3

  frontend:
    build: ./frontend
    environment:
      DATABASE_URL: postgresql://flowuser:flowpass@postgres:5432/flowthreat
      AUTH_SECRET: ${AUTH_SECRET}
      AUTH_URL: http://localhost:3000
      NEXT_PUBLIC_API_URL: http://server:3001
    ports:
      - "3000:3000"
    depends_on:
      - server

volumes:
  postgres_data:
```

---

## Kubernetes Deployment

### ConfigMap

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: threatforge-config
data:
  PORT: "3001"
  CORS_ORIGIN: "https://app.example.com"
  AUTH_URL: "https://app.example.com"
  NEXT_PUBLIC_API_URL: "https://api.example.com"
```

### Secrets

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: threatforge-secrets
type: Opaque
stringData:
  DATABASE_URL: postgresql://user:pass@db:5432/flowthreat
  JWT_SECRET: <your-jwt-secret>
  AUTH_SECRET: <your-auth-secret>
  ENCRYPTION_KEY: <your-encryption-key>
  SETUP_TOKEN: <your-setup-token>
```

### Backend Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: threatforge-server
spec:
  replicas: 2
  selector:
    matchLabels:
      app: threatforge-server
  template:
    metadata:
      labels:
        app: threatforge-server
    spec:
      containers:
      - name: server
        image: threatforge-server:latest
        ports:
        - containerPort: 3001
        envFrom:
        - configMapRef:
            name: threatforge-config
        - secretRef:
            name: threatforge-secrets
        livenessProbe:
          httpGet:
            path: /health/live
            port: 3001
          initialDelaySeconds: 10
          periodSeconds: 30
        readinessProbe:
          httpGet:
            path: /health/ready
            port: 3001
          initialDelaySeconds: 5
          periodSeconds: 10
        resources:
          requests:
            memory: "256Mi"
            cpu: "100m"
          limits:
            memory: "1Gi"
            cpu: "1000m"
```

---

## Production Checklist

### Security

- [ ] Set strong `JWT_SECRET` (32+ characters)
- [ ] Set strong `AUTH_SECRET` (32+ characters)
- [ ] Set `ENCRYPTION_KEY` for data at rest (32+ characters)
- [ ] Set `SETUP_TOKEN` (or read the generated one from the server log) so only you can complete setup
- [ ] Enable HTTPS (TLS termination at load balancer)
- [ ] Configure `CORS_ORIGIN` to allowed domains only
- [ ] Enable rate limiting (built-in)

### Database

- [ ] Use PostgreSQL for production
- [ ] Configure connection pooling (max connections)
- [ ] Set up database backups
- [ ] Enable SSL for database connections

### Monitoring

- [ ] Configure Prometheus scraping on `/metrics`
- [ ] Set up alerts for health check failures
- [ ] Monitor connection pool utilization
- [ ] Set up log aggregation

### High Availability

- [ ] Run multiple backend replicas
- [ ] Configure Redis for session sharing
- [ ] Use database read replicas if needed
- [ ] Set up load balancing

---

## Startup Error Messages

The server provides clear error messages if configuration is wrong:

```
═══════════════════════════════════════════════════════════════════
  DATABASE CONNECTION FAILED
═══════════════════════════════════════════════════════════════════
  Provider:   POSTGRESQL
  Error:      Cannot connect to PostgreSQL at localhost:5432
  Suggestion: Ensure PostgreSQL is running and accessible
═══════════════════════════════════════════════════════════════════
```

Common errors and fixes:

| Error | Cause | Fix |
|-------|-------|-----|
| `ECONNREFUSED` | Database not running | Start PostgreSQL/check host |
| `ENOTFOUND` | Invalid hostname | Check DATABASE_URL hostname |
| `password authentication failed` | Wrong credentials | Check database username/password |
| `database does not exist` | Database not created | Create the database |
| `SQLITE_CANTOPEN` | File path issue | Check file path and permissions |

---

## Upgrading

### Database Migrations

```bash
cd server

# Generate migration after schema changes
npx prisma migrate dev --name <migration-name>

# Apply migrations in production
npx prisma migrate deploy
```

### Rolling Updates

1. Deploy new backend with migrations
2. Verify health checks pass
3. Deploy new frontend
4. Monitor for errors

### Rollback

```bash
# Rollback last migration
npx prisma migrate rollback

# Or restore from backup
pg_restore -d flowthreat backup.dump
```

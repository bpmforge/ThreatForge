# ThreatForge — Admin Operations Runbook

**Last Updated:** 2026-04-02

---

## 1. Deployment

### Prerequisites
- Docker + Docker Compose v2+
- 4GB+ RAM (8GB recommended)
- PostgreSQL 17 (via container)
- SSL certificates (self-signed or Let's Encrypt)

### Deploy from Scratch
```bash
cd /path/to/threatforge-deploy

# Configure environment
cp .env.prod.example .env.prod
# Edit .env.prod: set DOMAIN, POSTGRES_PASSWORD, JWT_SECRET, AUTH_SECRET

# Generate SSL certs (testing)
./deploy/generate-self-signed-cert.sh

# Start all services
docker compose -f docker-compose.prod.yml up -d

# Verify
docker compose -f docker-compose.prod.yml ps
curl -sk https://localhost/health
```

### Update Deployment
```bash
# Sync latest code
rsync -avz --delete --exclude='node_modules' --exclude='.next' --exclude='.git' \
  server/ user@server:~/threatforge-deploy/server/
rsync -avz --delete --exclude='node_modules' --exclude='.next' --exclude='.git' \
  frontend/ user@server:~/threatforge-deploy/frontend/

# Rebuild images
docker build -t threatforge/server:latest ./server
docker build -t threatforge/frontend:latest ./frontend

# Rolling restart
docker compose -f docker-compose.prod.yml up -d
```

---

## 2. Backup & Restore

### Automatic Backups
The `backup` container runs daily at 2 AM:
- Format: PostgreSQL custom (`pg_dump -Fc`)
- Retention: 7 days
- Location: `backup_data` Docker volume

### Manual Backup
```bash
docker exec threatforge-db-1 pg_dump -U flowthreat -Fc flowthreat_prod > backup_$(date +%Y%m%d).dump
```

### Restore from Backup
```bash
# Stop application (keep DB running)
docker compose -f docker-compose.prod.yml stop server frontend nginx

# Restore
docker exec -i threatforge-db-1 pg_restore -U flowthreat -d flowthreat_prod --clean < backup_YYYYMMDD.dump

# Restart
docker compose -f docker-compose.prod.yml up -d
```

### Verify Backup Integrity
```bash
docker exec threatforge-backup-1 ls -la /backups/
docker exec threatforge-db-1 psql -U flowthreat -d flowthreat_prod -c "SELECT count(*) FROM users;"
```

---

## 3. Encryption at Rest

Field-level AES-256-GCM encryption of canvas state, threat/mitigation text and
document content.

`docker-compose.prod.yml` defaults `ENCRYPT_AT_REST=true` and **refuses to start
without `ENCRYPTION_KEY`** (compose-level `:?` check). The server independently
refuses to boot if `ENCRYPT_AT_REST=true` and the key is missing or is not
base64 of exactly 32 bytes. (The dev/quickstart `docker-compose.yml` leaves
encryption off unless you set both variables.)

### Enable
```bash
# Generate a 256-bit key (must be base64 of 32 bytes; hex is rejected)
openssl rand -base64 32

# Add to .env.prod (ENCRYPT_AT_REST defaults to true in the prod compose)
ENCRYPTION_KEY=<base64-key-from-above>

# Restart server
docker compose -f docker-compose.prod.yml up -d server
```

Store the key in a secrets manager and back it up separately from database
backups: without it, encrypted rows are unrecoverable.

### Backfill existing plaintext data
New writes are encrypted immediately; rows written before encryption was enabled
stay plaintext (and readable) until backfilled. `src/scripts/backfill-encryption.ts`
is idempotent (already-encrypted values are skipped) and batched. The runtime
`server` image ships only compiled `dist/`, so run it from the `init` service
(the `migrate` build target, which has `src/`, `tsx` and devDependencies):

```bash
# Take a backup first (section 2). Dry run - counts rows, writes nothing:
docker compose -f docker-compose.prod.yml run --rm --no-deps \
  -e ENCRYPT_AT_REST=true -e ENCRYPTION_KEY="$ENCRYPTION_KEY" init \
  npx tsx src/scripts/backfill-encryption.ts --dry-run

# Real run (add --batch-size=N to tune)
docker compose -f docker-compose.prod.yml run --rm --no-deps \
  -e ENCRYPT_AT_REST=true -e ENCRYPTION_KEY="$ENCRYPTION_KEY" init \
  npx tsx src/scripts/backfill-encryption.ts
```

### Key Rotation
There is no multi-key support: a single `ENCRYPTION_KEY` is used for both reads
and writes, so rotation is an offline re-encrypt.

1. Take a backup (section 2) and stop writes
   (`docker compose -f docker-compose.prod.yml stop server frontend`).
2. Generate the new key: `openssl rand -base64 32`.
3. Re-encrypt every encrypted field: decrypt with the **old** key
   (`decryptField`), write back with the **new** key (`encryptField`).
   `backfill-encryption.ts` skips already-encrypted values, so it cannot rotate
   by itself.
4. Update `ENCRYPTION_KEY` in `.env.prod`, start `server`, verify a threat model
   opens, and keep the old key until a backup taken under the new key verifies.

> Status: a turnkey rotation script does not exist yet; step 3 is manual.

---

## 4. SCIM Provisioning

### Enable
```bash
# Generate a SCIM token
openssl rand -hex 32

# Add to .env.prod
SCIM_API_TOKEN=<token-from-above>

# Restart server
docker compose -f docker-compose.prod.yml up -d server
```

### Configure in Identity Provider

**Okta:**
1. Add SCIM 2.0 application
2. Base URL: `https://your-domain.com/scim/v2`
3. Auth: Bearer token (the `SCIM_API_TOKEN`)
4. Supported operations: Create, Update, Deactivate

**Azure AD:**
1. Enterprise Applications → Provisioning
2. Tenant URL: `https://your-domain.com/scim/v2`
3. Secret Token: `SCIM_API_TOKEN` value
4. Test Connection → Save

### Verify
```bash
curl -H "Authorization: Bearer $SCIM_API_TOKEN" https://your-domain.com/scim/v2/Users
```

---

## 5. Monitoring

### Health Endpoints
| Endpoint | Purpose | Expected |
|----------|---------|----------|
| `GET /health` | Full health check | `status: "ok"` or `"unhealthy"` |
| `GET /health/live` | Kubernetes liveness | `status: "ok"` |
| `GET /health/ready` | Kubernetes readiness | `ready: true` |
| `GET /health/dependencies` | Database, Redis, memory, CPU (`Authorization: Bearer $METRICS_TOKEN`; 404 when unset) | Per-component status |
| `GET /metrics` | Prometheus metrics: request rates and latency, AI calls, job queue, memory (`Authorization: Bearer $METRICS_TOKEN`; 404 when unset) | Prometheus text format |

`/metrics` and `/health/dependencies` are off unless `METRICS_TOKEN` is set in
the host `.env` (`openssl rand -hex 32`). Set it only if a monitoring system
(Prometheus, Grafana Agent) will scrape them, and give that system the same
token as a bearer token. `/health` also reports the running `version` and the
git `commit` the server image was built from.

### Container Health
```bash
docker compose -f docker-compose.prod.yml ps
docker stats --no-stream
```

### Logs
```bash
# All services
docker compose -f docker-compose.prod.yml logs -f

# Server only (JSON structured logs)
docker logs threatforge-server-1 --tail 100 -f

# Search for errors
docker logs threatforge-server-1 2>&1 | grep '"level":50'
```

### Memory Alerts
Server heap usage should stay below 80%. If consistently above:
```bash
# Check current usage
docker exec threatforge-server-1 wget -qO- http://localhost:3001/health | node -e "
  const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
  console.log('Heap:', d.checks.memory.details.heapUsagePercent + '%');
"
```

If high: increase `NODE_OPTIONS=--max-old-space-size=768` and container memory limit in compose.

---

## 6. Incident Response

### Application Down
1. Check containers: `docker compose ps`
2. Check logs: `docker logs threatforge-server-1 --tail 50`
3. Restart unhealthy service: `docker compose restart server`
4. If DB issue: `docker compose restart db` (data persisted in volume)

### Database Corruption
1. Stop all services: `docker compose stop`
2. Restore from latest backup (see section 2)
3. Start services: `docker compose up -d`
4. Verify: `curl https://localhost/health`

### Security Incident
1. Check audit logs: `GET /api/organizations/:orgId/audit`
2. Check for suspicious API token usage
3. Rotate secrets: JWT_SECRET, AUTH_SECRET, ENCRYPTION_KEY
4. Invalidate all sessions: restart server
5. Review SCIM provisioning logs if applicable

### Account Lockout
If a legitimate user is locked out (10 failed attempts):
- Wait 30 minutes (auto-unlock)
- Or restart server (clears in-memory lockout map)

---

## 7. Environment Variables Reference

| Variable | Required | Description |
|----------|:--------:|-------------|
| `DOMAIN` | Yes | Public hostname (e.g., `threatforge.example.com`) |
| `POSTGRES_USER` | Yes | Database username |
| `POSTGRES_PASSWORD` | Yes | Database password |
| `POSTGRES_DB` | Yes | Database name |
| `JWT_SECRET` | Yes | JWT signing secret (generate with `openssl rand -base64 32`) |
| `AUTH_SECRET` | Yes | NextAuth secret (generate with `openssl rand -base64 32`) |
| `ENCRYPT_AT_REST` | No | Set `true` to enable field-level encryption |
| `ENCRYPTION_KEY` | If encrypt | 256-bit base64 key for AES-256-GCM |
| `SCIM_API_TOKEN` | No | Bearer token for SCIM provisioning |
| `NVD_API_KEY` | No | NVD API key for CVE lookups. A key entered in Admin > Settings takes precedence. See 7c |
| `METRICS_TOKEN` | No | Bearer token that turns on `/metrics` (Prometheus); off when unset. See 5 |
| `LOG_LEVEL` | No | `info` (default), `debug`, `warn`, `error` |
| `DEMO_READONLY_USER_EMAILS` | No | Comma-separated accounts that may sign in and read but never write (the public demo). See 7a |
| `AI_PRIVATE_HOST_ALLOWLIST` | If AI on a LAN | Comma-separated hostnames, IPs, CIDRs that org AI base URLs may use on loopback/private networks. See 7b |
| `AI_ALLOW_ALL_PRIVATE_HOSTS` | No | `true` lets org AI base URLs use any private host. Single-tenant installs only; default `false` |

These are passed to the server container by `docker-compose.yml` and
`docker-compose.prod.yml`; set them in the host `.env` next to the compose file.

### 7a. Read-only demo account

Accounts listed in `DEMO_READONLY_USER_EMAILS` can sign in and see everything
their memberships allow, and nothing else: every API request other than
GET/HEAD/OPTIONS is refused with `403 {"code":"READ_ONLY_ACCOUNT"}`, including
creating an organization, and their collaboration (canvas) socket is
receive-only. The UI shows a "Demo — read-only" strip. Matching is by email,
case-insensitive. A change needs a server restart.

Public host: `DEMO_READONLY_USER_EMAILS=demo-tour@example.com`.

E2E suites that write (product tours, use-cases, api-contracts, the save-canvas
smoke) sign in as a separate writer account instead:
`E2E_WRITER_EMAIL` / `E2E_WRITER_PASSWORD` in the environment that runs
Playwright. Create that account with its own organization, not as a member of
the demo organization. Without them those specs skip on the public host.
`--project=reseed-demo` writes as the demo account itself, so it only works
while the demo is temporarily removed from the list.

### 7b. AI endpoints on private networks

Organization AI settings and AI providers may point at a public AI endpoint
freely. A base URL whose host is loopback or a private network (10/8,
172.16/12, 192.168/16, 100.64/10, IPv6 ULA, `localhost`...) is accepted only
when its host is on the AI private-host allowlist, because otherwise any user
who creates an organization could aim the server's requests at the internal
network. Link-local and cloud-metadata addresses (169.254.0.0/16, fe80::/10,
`metadata.google.internal`) are refused whatever the allowlist says.

The allowlist is the union of:
- **Admin > Settings > Security > AI Private Hosts** (platform super-admin):
  one hostname, IP or CIDR per line, plus an "allow all private hosts" switch;
- `AI_PRIVATE_HOST_ALLOWLIST` / `AI_ALLOW_ALL_PRIVATE_HOSTS` on the server,
  shown read-only on that page.

The check runs when a base URL is saved and again before every AI call, so a
URL saved before the allowlist existed is refused until its host is listed.
A refused call fails with `AI endpoint refused: ...` in the server log.

**Before deploying this change** to an install whose own organizations already
use a self-hosted model, find each private host in use and allowlist it in the
environment, so AI keeps working from the first boot:

```bash
# List the AI base URLs organizations have configured
docker compose exec db psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atc \
  "SELECT DISTINCT \"aiSettings\"::json->>'baseUrl' FROM organizations WHERE \"aiSettings\" IS NOT NULL
   UNION SELECT DISTINCT \"baseUrl\" FROM ai_providers WHERE \"baseUrl\" IS NOT NULL;"
# e.g. http://127.0.0.1:8000/v1 and http://192.0.2.20:1234/v1 -> in .env:
AI_PRIVATE_HOST_ALLOWLIST=127.0.0.1,192.0.2.20
docker compose up -d server
```

The schema change (two `system_settings` columns) is applied by `prisma db push`
during deploy; `server/prisma/migrations/add-ai-private-host-allowlist.sql` is
the equivalent SQL.

---

### 7c. NVD API key (vulnerability lookups)

Supply-chain scans and AI threat research look up known vulnerabilities
(CVEs) in NIST's National Vulnerability Database (NVD). NVD rate-limits
by API key: **5 requests per 30 seconds without a key, 50 with one.** Without
a key, scans of more than a handful of dependencies report many of them as
"UNKNOWN" (NVD answered 429) instead of listing their CVEs.

Each install uses its own free key; keys are per requester and must not be
shared between installs.

1. Request a key at <https://nvd.nist.gov/developers/request-an-api-key>
   (organisation name, email, organisation type). NVD emails a link; open it
   within 7 days to activate the key.
2. Enter it in ThreatForge, either:
   - **Admin > Settings > General > Vulnerability database (NVD)** (super
     admins). The key is stored encrypted, takes effect within a minute, and
     is never shown again; "Remove saved key" clears it. Recommended.
   - or `NVD_API_KEY=<key>` in the host `.env`, then restart the server
     (`docker compose up -d server`). Useful for automated installs. A key
     saved in Admin > Settings takes precedence over this variable.
3. The settings card shows where the key in use comes from ("Key saved
   here", "Key from NVD_API_KEY", or "No key: rate limited").

If NVD rejects the key (expired or revoked), lookups fall back to reporting
dependencies as UNKNOWN; request a new key and replace it.

## 8. Scaling Notes

### Current Limits (Single Node)
- 5 containers on 4GB RAM
- ~50 concurrent users (estimated)
- ~10,000 threat models
- Single PostgreSQL instance

### When to Scale
- Heap consistently >80%: increase memory limits
- Response times >1s: add read replica
- >100 concurrent users: add load balancer + multiple server instances
- >50GB database: consider partitioning

### Future: Kubernetes Deployment
Kubernetes manifests available at `deploy/k8s/`. Not yet validated for production.

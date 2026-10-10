# ThreatForge Cloud Deployment Guide

This guide covers deploying ThreatForge to Google Cloud Platform (Cloud Run) and AWS (ECS Fargate) using Terraform.

## Stack

| Component | Image | Port |
|-----------|-------|------|
| Backend API (Fastify) | `bpmforge/threatforge-server:TAG` | 4000 |
| Frontend (Next.js) | `bpmforge/threatforge-frontend:TAG` | 3000 |
| Database | PostgreSQL 15 (managed) | 5432 |
| Cache | Redis 7 (managed) | 6379 |

---

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) 24+
- [Terraform](https://developer.hashicorp.com/terraform/install) 1.5+
- For GCP: [gcloud CLI](https://cloud.google.com/sdk/docs/install) authenticated (`gcloud auth application-default login`)
- For AWS: [AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/install-cliv2.html) configured (`aws configure`)

---

## GCP Quick Start

Deploy ThreatForge to Cloud Run with Cloud SQL (PostgreSQL) and Memorystore (Redis).

```bash
# 1. Navigate to the GCP module
cd deploy/gcp

# 2. Create a terraform.tfvars file
cat > terraform.tfvars <<EOF
project_id            = "your-gcp-project-id"
region                = "us-central1"
domain                = "threatforge.example.com"
app_version           = "1.0.0"
secret_auth_secret    = "$(openssl rand -hex 32)"
secret_jwt_secret     = "$(openssl rand -hex 32)"
secret_encryption_key = ""   # Set only if encrypt_at_rest = true
EOF

# 3. Initialize Terraform
terraform init

# 4. Preview the plan
terraform plan

# 5. Deploy (takes ~10 minutes on first run)
terraform apply

# 6. Get outputs
terraform output
```

After apply completes:

```
frontend_url = "https://threatforge-frontend-xxxx-uc.a.run.app"
server_url   = "https://threatforge-server-xxxx-uc.a.run.app"
```

Point your DNS A/CNAME record for `threatforge.example.com` to the frontend Cloud Run URL or use the [Cloud Run custom domains](https://cloud.google.com/run/docs/mapping-custom-domains) console.

### GCP Variables Reference

| Variable | Default | Description |
|----------|---------|-------------|
| `project_id` | required | GCP project ID |
| `region` | `us-central1` | GCP region |
| `domain` | required | Your domain (used in NEXTAUTH_URL) |
| `app_version` | `latest` | Docker image tag |
| `db_tier` | `db-g1-small` | Cloud SQL machine tier |
| `db_deletion_protection` | `true` | Prevent accidental DB deletion |
| `redis_tier` | `BASIC` | Memorystore tier (`BASIC` or `STANDARD_HA`) |
| `redis_memory_gb` | `1` | Redis memory in GB |
| `server_min_instances` | `1` | Min Cloud Run instances for API |
| `server_max_instances` | `10` | Max Cloud Run instances for API |
| `frontend_min_instances` | `1` | Min Cloud Run instances for frontend |
| `frontend_max_instances` | `5` | Max Cloud Run instances for frontend |
| `encrypt_at_rest` | `false` | Enable application-level encryption |
| `secret_auth_secret` | required | Auth.js session signing secret |
| `secret_jwt_secret` | required | JWT signing secret |
| `secret_encryption_key` | `""` | Required only when `encrypt_at_rest = true` |

---

## AWS Quick Start

Deploy ThreatForge to ECS Fargate with RDS (PostgreSQL) and ElastiCache (Redis) behind an ALB.

```bash
# 1. Navigate to the AWS module
cd deploy/aws

# 2. Create a terraform.tfvars file
cat > terraform.tfvars <<EOF
aws_region     = "us-east-1"
domain         = "threatforge.example.com"
app_version    = "1.0.0"
auth_secret    = "$(openssl rand -hex 32)"
jwt_secret     = "$(openssl rand -hex 32)"
encryption_key = ""   # Set only if encrypt_at_rest = true
EOF

# 3. Initialize Terraform
terraform init

# 4. Preview the plan
terraform plan

# 5. Deploy (takes ~15 minutes on first run)
terraform apply

# 6. Get the ALB DNS name
terraform output alb_dns_name
```

Create a DNS CNAME record pointing your domain to the `alb_dns_name` output. For HTTPS, attach an ACM certificate to the ALB listener (see the AWS Console or add an `aws_acm_certificate` resource to `ecs.tf`).

### AWS Variables Reference

| Variable | Default | Description |
|----------|---------|-------------|
| `aws_region` | `us-east-1` | AWS region |
| `domain` | required | Your domain (used in NEXTAUTH_URL) |
| `app_version` | `latest` | Docker image tag |
| `vpc_cidr` | `10.0.0.0/16` | VPC CIDR block |
| `db_instance_class` | `db.t3.medium` | RDS instance class |
| `db_deletion_protection` | `true` | Prevent accidental DB deletion |
| `cache_node_type` | `cache.t3.micro` | ElastiCache node type |
| `server_desired_count` | `2` | Desired ECS tasks for API |
| `server_max_count` | `10` | Max ECS tasks for API |
| `frontend_desired_count` | `2` | Desired ECS tasks for frontend |
| `frontend_max_count` | `5` | Max ECS tasks for frontend |
| `encrypt_at_rest` | `false` | Enable application-level encryption |
| `auth_secret` | required | Auth.js session signing secret |
| `jwt_secret` | required | JWT signing secret |
| `encryption_key` | `""` | Required only when `encrypt_at_rest = true` |

---

## Kubernetes / Helm Deployment

For Kubernetes deployments (self-managed or GKE/EKS), use the Helm chart in `deploy/helm/`.

```bash
helm upgrade --install threatforge deploy/helm/ \
  --namespace threatforge \
  --create-namespace \
  --set image.tag=1.0.0 \
  --set global.domain=threatforge.example.com \
  --set secrets.authSecret="$(openssl rand -hex 32)"
```

See `deploy/helm/README.md` for full Helm values documentation.

For raw Kubernetes manifests, see `deploy/k8s/`.

---

## First-Time Setup After Deploy

ThreatForge requires an initial admin user and organization. Use the setup CLI after the containers are running:

**GCP (Cloud Run):**
```bash
# Get the server URL from Terraform outputs
SERVER_URL=$(cd deploy/gcp && terraform output -raw server_url)

# Run setup via Cloud Run Jobs or exec into a running instance
# Alternatively, use the setup API endpoint:
curl -X POST "${SERVER_URL}/api/setup/initialize" \
  -H "Content-Type: application/json" \
  -d '{
    "adminEmail": "admin@example.com",
    "adminPassword": "SecurePass123!",
    "adminName": "Admin User",
    "orgName": "My Company",
    "orgSlug": "my-company"
  }'
```

**AWS (ECS):**
```bash
# Run the setup CLI via ECS exec on a running task
CLUSTER=$(cd deploy/aws && terraform output -raw ecs_cluster_name)
TASK_ARN=$(aws ecs list-tasks --cluster "$CLUSTER" --service-name threatforge-server \
  --query 'taskArns[0]' --output text)

aws ecs execute-command \
  --cluster "$CLUSTER" \
  --task "$TASK_ARN" \
  --container threatforge-server \
  --interactive \
  --command "node dist/scripts/setup-cli.js \
    --admin-email admin@example.com \
    --admin-password 'SecurePass123!' \
    --admin-name 'Admin User' \
    --org-name 'My Company' \
    --org-slug my-company"
```

---

## Environment Variables Reference

These variables are injected into containers at runtime. Sensitive values are sourced from Secrets Manager (GCP) or AWS Secrets Manager — never hardcoded.

| Variable | Service | Description |
|----------|---------|-------------|
| `NODE_ENV` | Both | Always `production` in cloud deployments |
| `PORT` | Server | API port (4000) |
| `DATABASE_URL` | Both | PostgreSQL connection string (`postgresql://...`) |
| `AUTH_SECRET` | Both | Auth.js secret for session JWT signing |
| `JWT_SECRET` | Server | JWT secret for API bearer tokens |
| `REDIS_URL` | Server | Redis connection URL (`redis://host:6379`) |
| `NEXTAUTH_URL` | Frontend | Public URL of the application (`https://domain`) |
| `AUTH_URL` | Frontend | Same as NEXTAUTH_URL |
| `INTERNAL_API_URL` | Frontend | Internal URL for server-side API calls |
| `DATABASE_PROVIDER` | Frontend | Always `postgresql` in cloud |
| `ENCRYPT_AT_REST` | Server | `true` to enable application-level encryption |
| `ENCRYPTION_KEY` | Server | 32-byte hex key (only when `ENCRYPT_AT_REST=true`) |

### Health Endpoints

| Endpoint | Description | Used By |
|----------|-------------|---------|
| `GET /health` | Full health status (DB, Redis, memory) | Monitoring |
| `GET /health/live` | Liveness probe (process alive) | Cloud Run |
| `GET /health/ready` | Readiness probe (dependencies ready) | Cloud Run / ALB |
| `GET /health/dependencies` | Detailed dependency status | Debugging |

---

## Upgrading

To deploy a new version:

**Terraform (GCP or AWS):**
```bash
# Update app_version in terraform.tfvars or pass via -var
terraform apply -var="app_version=1.1.0"
```

Cloud Run performs zero-downtime rolling updates automatically. ECS performs rolling deployments respecting `deployment_minimum_healthy_percent = 50`.

**Helm:**
```bash
helm upgrade threatforge deploy/helm/ --set image.tag=1.1.0
```

**Schema migrations** run automatically on server startup via Prisma. Ensure the database credentials are unchanged before upgrading.

---

## Backup and Recovery

### GCP (Cloud SQL)

Automated backups are enabled at 03:00 UTC with 7-day retention and point-in-time recovery.

```bash
# List available backups
gcloud sql backups list --instance=threatforge-db

# Restore to a specific time (point-in-time recovery)
gcloud sql instances restore-backup threatforge-db-restored \
  --source-instance=threatforge-db \
  --backup-id=<backup-id>
```

### AWS (RDS)

Automated backups run daily during the 03:00–04:00 UTC window with 7-day retention.

```bash
# Create a manual snapshot
aws rds create-db-snapshot \
  --db-instance-identifier threatforge \
  --db-snapshot-identifier threatforge-manual-$(date +%Y%m%d)

# Restore from snapshot
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier threatforge-restored \
  --db-snapshot-identifier threatforge-manual-20260101
```

### Manual Database Dump

For portable backups independent of cloud provider:

```bash
# Dump (from a host with PostgreSQL client + VPN/bastion access)
pg_dump -h <db-host> -U threatforge -d threatforge -Fc > backup.dump

# Restore
pg_restore -h <db-host> -U threatforge -d threatforge backup.dump
```

---

## Destroying the Infrastructure

```bash
# GCP
cd deploy/gcp
terraform destroy

# AWS
cd deploy/aws
terraform destroy
```

Note: `db_deletion_protection = true` (default) prevents RDS/Cloud SQL from being deleted. Set it to `false` before destroying:

```bash
terraform apply -var="db_deletion_protection=false"
terraform destroy
```

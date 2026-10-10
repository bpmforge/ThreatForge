# ThreatForge Helm Chart

Production-grade Helm chart for deploying ThreatForge — a visual threat modeling platform.

## Prerequisites

- Kubernetes 1.25+
- Helm 3.10+
- [cert-manager](https://cert-manager.io/docs/installation/) (if using TLS via Let's Encrypt)
- [ingress-nginx](https://kubernetes.github.io/ingress-nginx/deploy/) controller

## Quick Start

```bash
# Add Bitnami dependency repo (for PostgreSQL and Redis subcharts)
helm repo add bitnami https://charts.bitnami.com/bitnami
helm repo update

# Download subchart dependencies
helm dependency update deploy/helm

# Install with sensible defaults (set your own secrets)
helm install threatforge deploy/helm \
  --namespace threatforge \
  --create-namespace \
  --set ingress.host=threatforge.example.com \
  --set secrets.authSecret="$(openssl rand -hex 32)" \
  --set secrets.jwtSecret="$(openssl rand -hex 32)" \
  --set secrets.encryptionKey="$(openssl rand -base64 32)" \
  --set secrets.databaseUrl="postgresql://postgres:password@localhost:5432/threatforge"
```

## Values Reference

| Key | Default | Description |
|-----|---------|-------------|
| `global.imageRegistry` | `""` | Global image registry prefix |
| `global.imagePullSecrets` | `[]` | Image pull secrets applied to all pods |
| `image.server.repository` | `bpmforge/threatforge-server` | Server image repository |
| `image.server.tag` | `1.0.0` | Server image tag |
| `image.frontend.repository` | `bpmforge/threatforge-frontend` | Frontend image repository |
| `image.frontend.tag` | `1.0.0` | Frontend image tag |
| `server.replicaCount` | `2` | Server replica count (ignored when autoscaling is enabled) |
| `server.autoscaling.enabled` | `false` | Enable HPA for server |
| `server.autoscaling.minReplicas` | `2` | HPA minimum replicas |
| `server.autoscaling.maxReplicas` | `10` | HPA maximum replicas |
| `server.autoscaling.targetCPUUtilizationPercentage` | `70` | HPA CPU target |
| `frontend.replicaCount` | `2` | Frontend replica count |
| `frontend.autoscaling.enabled` | `false` | Enable HPA for frontend |
| `ingress.enabled` | `true` | Create Ingress resource |
| `ingress.className` | `nginx` | Ingress class name |
| `ingress.host` | `threatforge.example.com` | Hostname for ingress and TLS |
| `ingress.tls.enabled` | `true` | Enable TLS termination |
| `ingress.annotations` | cert-manager + ssl-redirect + 50m body | Ingress annotations |
| `postgresql.enabled` | `true` | Deploy PostgreSQL subchart |
| `postgresql.auth.database` | `threatforge` | Database name |
| `postgresql.auth.existingSecret` | `""` | Use existing secret for postgres auth |
| `postgresql.primary.persistence.size` | `20Gi` | PostgreSQL PVC size |
| `redis.enabled` | `true` | Deploy Redis subchart |
| `redis.auth.enabled` | `false` | Enable Redis authentication |
| `config.nodeEnv` | `production` | NODE_ENV value |
| `config.port` | `4000` | Backend server port |
| `config.corsOrigin` | `""` | CORS origin (defaults to ingress host) |
| `secrets.existingSecret` | `""` | Use this existing Secret instead of creating one |
| `secrets.authSecret` | `""` | AUTH_SECRET value (plain text, Helm base64-encodes it) |
| `secrets.jwtSecret` | `""` | JWT_SECRET value |
| `secrets.encryptionKey` | `""` | ENCRYPTION_KEY value |
| `secrets.databaseUrl` | `""` | Full DATABASE_URL connection string |
| `serviceAccount.create` | `true` | Create a ServiceAccount |
| `serviceAccount.annotations` | `{}` | Annotations for the ServiceAccount |
| `nodeSelector` | `{}` | Node selector applied to all pods |
| `tolerations` | `[]` | Tolerations applied to all pods |
| `affinity` | `{}` | Affinity rules applied to all pods |
| `persistence.enabled` | `false` | Reserved for future document storage volume |

## Using an External Secret

In production, avoid passing secrets through Helm values. Instead, create your secret externally (or use the [External Secrets Operator](https://external-secrets.io/)) and reference it:

```bash
# Create the secret manually
kubectl create secret generic threatforge-prod-secret \
  --namespace threatforge \
  --from-literal=AUTH_SECRET="$(openssl rand -hex 32)" \
  --from-literal=JWT_SECRET="$(openssl rand -hex 32)" \
  --from-literal=ENCRYPTION_KEY="$(openssl rand -base64 32)" \
  --from-literal=DATABASE_URL="postgresql://user:pass@host:5432/threatforge"

# Reference it in your values
helm install threatforge deploy/helm \
  --namespace threatforge \
  --set secrets.existingSecret=threatforge-prod-secret \
  --set ingress.host=threatforge.example.com
```

The secret must contain keys: `AUTH_SECRET`, `JWT_SECRET`, `ENCRYPTION_KEY`, `DATABASE_URL`.

## Upgrade Procedure

```bash
# Pull latest chart dependencies if Chart.yaml changed
helm dependency update deploy/helm

# Upgrade (add --atomic to auto-rollback on failure)
helm upgrade threatforge deploy/helm \
  --namespace threatforge \
  --reuse-values \
  --atomic \
  --timeout 5m
```

## Uninstall

```bash
helm uninstall threatforge --namespace threatforge
# PVCs are not deleted automatically; remove manually if needed:
kubectl delete pvc --namespace threatforge -l app.kubernetes.io/instance=threatforge
```

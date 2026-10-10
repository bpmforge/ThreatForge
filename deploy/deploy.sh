#!/bin/bash
#
# ThreatForge - Deployment Script
#
# Usage:
#   ./deploy/deploy.sh              # Deploy/update application
#   ./deploy/deploy.sh --build      # Rebuild images before deploying
#   ./deploy/deploy.sh --pull       # Pull latest images (CI/CD builds)
#

set -euo pipefail

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${GREEN}[DEPLOY]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }

# Parse arguments
BUILD=false
PULL=false
for arg in "$@"; do
    case $arg in
        --build) BUILD=true ;;
        --pull) PULL=true ;;
    esac
done

# Check for .env.prod
if [[ ! -f .env.prod ]]; then
    echo "ERROR: .env.prod not found!"
    echo "Copy .env.prod.example to .env.prod and configure it first."
    exit 1
fi

# Load environment
set -a
source .env.prod
set +a

# Check required variables
REQUIRED_VARS=("DOMAIN" "POSTGRES_PASSWORD" "JWT_SECRET" "AUTH_SECRET")
for var in "${REQUIRED_VARS[@]}"; do
    if [[ -z "${!var:-}" ]] || [[ "${!var}" == *"CHANGE"* ]] || [[ "${!var}" == *"GENERATE"* ]]; then
        echo "ERROR: $var is not properly configured in .env.prod"
        exit 1
    fi
done

# Check SSL certificates
if [[ ! -f ./nginx/certs/fullchain.pem ]]; then
    warn "SSL certificates not found in ./nginx/certs/"
    echo "Run one of these first:"
    echo "  ./deploy/generate-self-signed-cert.sh  # For testing"
    echo "  ./deploy/setup-letsencrypt.sh $DOMAIN  # For production"
    exit 1
fi

log "Deploying ThreatForge to $DOMAIN..."

# Pull or build images
if [[ "$PULL" == true ]]; then
    log "Pulling latest images..."
    docker compose -f docker-compose.prod.yml pull
elif [[ "$BUILD" == true ]]; then
    log "Building images..."
    docker compose -f docker-compose.prod.yml build --no-cache
fi

# Deploy
log "Starting services..."
docker compose -f docker-compose.prod.yml up -d

# Wait for health checks
log "Waiting for services to be healthy..."
sleep 10

# Check health
log "Checking service health..."
docker compose -f docker-compose.prod.yml ps

# Show logs
log "Recent logs:"
docker compose -f docker-compose.prod.yml logs --tail=20

echo ""
log "Deployment complete!"
echo ""
echo "Application URL: https://$DOMAIN"
echo ""
echo "Useful commands:"
echo "  docker compose -f docker-compose.prod.yml logs -f     # View logs"
echo "  docker compose -f docker-compose.prod.yml ps          # Service status"
echo "  docker compose -f docker-compose.prod.yml restart     # Restart all"
echo "  docker compose -f docker-compose.prod.yml down        # Stop all"

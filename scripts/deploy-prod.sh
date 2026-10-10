#!/bin/bash
#
# Production Deployment Script
# Deploys ThreatForge with SSL via Docker Compose
#
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$ROOT_DIR"

echo "=========================================="
echo "  ThreatForge - Production Deploy"
echo "=========================================="
echo ""

# Check for required files
if [ ! -f .env.prod ]; then
    echo "Error: .env.prod not found!"
    echo "Copy .env.prod.example to .env.prod and configure it."
    exit 1
fi

# Load environment
source .env.prod

if [ -z "$DOMAIN" ]; then
    echo "Error: DOMAIN not set in .env.prod"
    exit 1
fi

# Check for SSL certs
if [ ! -f nginx/certs/fullchain.pem ] || [ ! -f nginx/certs/privkey.pem ]; then
    echo ""
    echo "SSL certificates not found in nginx/certs/"
    echo ""
    echo "Options:"
    echo "  1. Use Let's Encrypt (recommended):"
    echo "     certbot certonly --standalone -d $DOMAIN"
    echo "     cp /etc/letsencrypt/live/$DOMAIN/fullchain.pem nginx/certs/"
    echo "     cp /etc/letsencrypt/live/$DOMAIN/privkey.pem nginx/certs/"
    echo ""
    echo "  2. Generate self-signed (for testing only):"
    echo "     mkdir -p nginx/certs"
    echo "     openssl req -x509 -nodes -days 365 -newkey rsa:2048 \\"
    echo "       -keyout nginx/certs/privkey.pem \\"
    echo "       -out nginx/certs/fullchain.pem \\"
    echo "       -subj '/CN=$DOMAIN'"
    echo ""
    read -p "Generate self-signed cert for testing? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        mkdir -p nginx/certs
        openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
            -keyout nginx/certs/privkey.pem \
            -out nginx/certs/fullchain.pem \
            -subj "/CN=$DOMAIN"
        echo "Self-signed certificate generated."
    else
        exit 1
    fi
fi

echo ""
echo "Deploying to: https://$DOMAIN"
echo ""

# Pull latest images (if using registry)
if [ -n "$GITHUB_REPOSITORY" ] && [ "$1" != "--build" ]; then
    echo "Pulling latest images..."
    docker compose -f docker-compose.prod.yml --env-file .env.prod pull || true
fi

# Deploy
echo "Starting services..."
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build

echo ""
echo "Waiting for services to be healthy..."
sleep 10

# Run database migrations
echo "Running database migrations..."
docker compose -f docker-compose.prod.yml --env-file .env.prod exec -T server \
    npx prisma migrate deploy || echo "Migrations may have already been applied"

echo ""
echo "=========================================="
echo "  Deployment Complete!"
echo "=========================================="
echo ""
echo "  URL:       https://$DOMAIN"
echo "  API:       https://$DOMAIN/api"
echo "  API Docs:  https://$DOMAIN/api/docs"
echo ""
echo "Commands:"
echo "  Status:    docker compose -f docker-compose.prod.yml ps"
echo "  Logs:      docker compose -f docker-compose.prod.yml logs -f"
echo "  Stop:      docker compose -f docker-compose.prod.yml down"
echo "  Update:    ./scripts/deploy-prod.sh"
echo ""

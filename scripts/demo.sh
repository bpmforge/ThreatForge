#!/bin/bash
#
# Quick Demo Setup Script
# Starts ThreatForge with Docker Compose for local demos
#
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$ROOT_DIR"

echo "=========================================="
echo "  ThreatForge - Demo Setup"
echo "=========================================="
echo ""

# Check for Docker
if ! command -v docker &> /dev/null; then
    echo "Error: Docker is not installed. Please install Docker first."
    echo "Visit: https://docs.docker.com/get-docker/"
    exit 1
fi

# Check if Docker is running
if ! docker info &> /dev/null; then
    echo "Error: Docker is not running. Please start Docker first."
    exit 1
fi

# Create .env if it doesn't exist
if [ ! -f .env ]; then
    echo "Creating .env file from .env.example..."
    cp .env.example .env

    # Generate a random JWT secret
    JWT_SECRET=$(openssl rand -base64 32 2>/dev/null || head -c 32 /dev/urandom | base64)
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "s/change-this-to-a-secure-random-string/$JWT_SECRET/" .env
    else
        sed -i "s/change-this-to-a-secure-random-string/$JWT_SECRET/" .env
    fi
    echo "Generated random JWT secret."
fi

echo ""
echo "Starting services..."
echo ""

# Build and start
docker compose up -d --build

echo ""
echo "Waiting for services to be healthy..."

# Wait for health checks
max_attempts=30
attempt=0
while [ $attempt -lt $max_attempts ]; do
    if docker compose ps | grep -q "healthy"; then
        break
    fi
    echo -n "."
    sleep 2
    attempt=$((attempt + 1))
done
echo ""

# Check final status
if docker compose ps | grep -q "unhealthy\|Exit"; then
    echo ""
    echo "Warning: Some services may not be healthy. Check logs with:"
    echo "  docker compose logs"
    echo ""
fi

echo ""
echo "=========================================="
echo "  ThreatForge is ready!"
echo "=========================================="
echo ""
echo "  Frontend:  http://localhost:3000"
echo "  API:       http://localhost:3001"
echo "  API Docs:  http://localhost:3001/docs"
echo ""
echo "Commands:"
echo "  Stop:      docker compose down"
echo "  Logs:      docker compose logs -f"
echo "  Restart:   docker compose restart"
echo "  Reset DB:  docker compose down -v && docker compose up -d"
echo ""

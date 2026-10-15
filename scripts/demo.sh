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
fi

# Fill any empty required secret with a random value. Compose refuses to start
# while JWT_SECRET or AUTH_SECRET is empty. Base64 output can contain "/" and
# "+", so the value is written with awk rather than sed.
gen_secret() {
    openssl rand -base64 32 2>/dev/null || head -c 32 /dev/urandom | base64
}
for var in JWT_SECRET AUTH_SECRET; do
    if ! grep -qE "^${var}=.+" .env; then
        value="$(gen_secret)"
        if grep -qE "^${var}=" .env; then
            awk -v k="$var" -v v="$value" 'BEGIN{FS=OFS="="} $1==k{print k "=" v; next} {print}' .env > .env.tmp && mv .env.tmp .env
        else
            printf '%s=%s\n' "$var" "$value" >> .env
        fi
        echo "Generated a random ${var}."
    fi
done

# init refuses a placeholder admin password and the stack waits on init, so
# make sure the demo admin has a real one.
admin_password=$(grep -E '^INITIAL_SYSTEM_ADMIN_PASSWORD=' .env | cut -d= -f2-)
case "$admin_password" in
    ""|ChangeMe123x|CHANGE_THIS_STRONG_PASSWORD|SecurePassword123!)
        admin_password="Demo-$(gen_secret | tr -dc 'A-Za-z0-9' | head -c 16)"
        if grep -qE '^INITIAL_SYSTEM_ADMIN_PASSWORD=' .env; then
            awk -v v="$admin_password" 'BEGIN{FS=OFS="="} $1=="INITIAL_SYSTEM_ADMIN_PASSWORD"{print $1 "=" v; next} {print}' .env > .env.tmp && mv .env.tmp .env
        else
            printf 'INITIAL_SYSTEM_ADMIN_PASSWORD=%s\n' "$admin_password" >> .env
        fi
        grep -qE '^INITIAL_SYSTEM_ADMIN_EMAIL=.+' .env || printf 'INITIAL_SYSTEM_ADMIN_EMAIL=admin@example.com\n' >> .env
        echo "Generated a random admin password."
        ;;
esac

echo ""
echo "Starting services..."
echo ""

# Build and start
docker compose up -d --build

echo ""
echo "Waiting for ThreatForge to answer (the first build takes a few minutes)..."

# The API and the web app each report healthy once they serve requests.
max_attempts=90
attempt=0
until curl -fsS http://localhost:${SERVER_PORT:-3001}/health > /dev/null 2>&1 \
   && curl -fsS -o /dev/null http://localhost:${FRONTEND_PORT:-3000}/login 2>/dev/null; do
    attempt=$((attempt + 1))
    if [ $attempt -ge $max_attempts ]; then
        echo ""
        echo "ThreatForge did not come up in time. Check the logs with:"
        echo "  docker compose logs server frontend init"
        exit 1
    fi
    echo -n "."
    sleep 2
done
echo ""

echo ""
echo "=========================================="
echo "  ThreatForge is ready!"
echo "=========================================="
echo ""
admin_email=$(grep -E '^INITIAL_SYSTEM_ADMIN_EMAIL=' .env | cut -d= -f2-)
admin_password=$(grep -E '^INITIAL_SYSTEM_ADMIN_PASSWORD=' .env | cut -d= -f2-)
echo "  Sign in:   http://localhost:${FRONTEND_PORT:-3000}/login"
echo "  Email:     ${admin_email}"
echo "  Password:  ${admin_password}   (change it after you sign in)"
echo ""
echo "  API:       http://localhost:${SERVER_PORT:-3001}"
echo "  API Docs:  http://localhost:${SERVER_PORT:-3001}/docs"
echo ""
echo "Commands:"
echo "  Stop:      docker compose down"
echo "  Logs:      docker compose logs -f"
echo "  Restart:   docker compose restart"
echo "  Reset DB:  docker compose down -v && docker compose up -d"
echo ""

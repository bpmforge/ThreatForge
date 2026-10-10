#!/usr/bin/env bash
# =============================================================================
# ThreatForge - Local Development Setup Script
# =============================================================================
#
# This script sets up a complete local development environment using
# Podman or Docker. Inspired by n8n's deployment approach.
#
# Usage:
#   ./scripts/local-setup.sh              # Basic setup (DB, Redis, App)
#   ./scripts/local-setup.sh --ai         # Include AI services (Ollama)
#   ./scripts/local-setup.sh --full       # All services
#   ./scripts/local-setup.sh --down       # Stop all services
#   ./scripts/local-setup.sh --clean      # Stop and remove volumes
#
# =============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Configuration
COMPOSE_FILE="docker-compose.local.yml"
ENV_FILE=".env.local"
ENV_EXAMPLE=".env.local.example"

# Detect container runtime
detect_runtime() {
    if command -v podman-compose &> /dev/null; then
        COMPOSE_CMD="podman-compose"
        CONTAINER_CMD="podman"
        echo -e "${GREEN}Using Podman${NC}"
    elif command -v docker-compose &> /dev/null; then
        COMPOSE_CMD="docker-compose"
        CONTAINER_CMD="docker"
        echo -e "${GREEN}Using Docker Compose (standalone)${NC}"
    elif command -v docker &> /dev/null && docker compose version &> /dev/null; then
        COMPOSE_CMD="docker compose"
        CONTAINER_CMD="docker"
        echo -e "${GREEN}Using Docker Compose (plugin)${NC}"
    else
        echo -e "${RED}Error: Neither podman-compose nor docker-compose found${NC}"
        echo "Please install one of:"
        echo "  - Podman: https://podman.io/getting-started/installation"
        echo "  - Docker: https://docs.docker.com/get-docker/"
        exit 1
    fi
}

# Print banner
print_banner() {
    echo -e "${BLUE}"
    echo "╔═══════════════════════════════════════════════════════════════╗"
    echo "║                                                               ║"
    echo "║                 ThreatForge - Local Setup                     ║"
    echo "║                                                               ║"
    echo "╚═══════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

# Check prerequisites
check_prerequisites() {
    echo -e "${BLUE}Checking prerequisites...${NC}"

    # Check if we're in the right directory
    if [[ ! -f "$PROJECT_ROOT/$COMPOSE_FILE" ]]; then
        echo -e "${RED}Error: $COMPOSE_FILE not found in $PROJECT_ROOT${NC}"
        echo "Please run this script from the project root directory"
        exit 1
    fi

    # Check for required directories
    if [[ ! -d "$PROJECT_ROOT/server" ]] || [[ ! -d "$PROJECT_ROOT/frontend" ]]; then
        echo -e "${RED}Error: server/ or frontend/ directory not found${NC}"
        exit 1
    fi

    echo -e "${GREEN}Prerequisites OK${NC}"
}

# Setup environment file
setup_env() {
    echo -e "${BLUE}Setting up environment...${NC}"

    cd "$PROJECT_ROOT"

    if [[ ! -f "$ENV_FILE" ]]; then
        if [[ -f "$ENV_EXAMPLE" ]]; then
            cp "$ENV_EXAMPLE" "$ENV_FILE"
            echo -e "${GREEN}Created $ENV_FILE from template${NC}"

            # Generate random secrets for development
            if command -v openssl &> /dev/null; then
                JWT_SECRET=$(openssl rand -base64 32 | tr -d '\n')
                AUTH_SECRET=$(openssl rand -base64 32 | tr -d '\n')
                ENCRYPTION_KEY=$(openssl rand -base64 24 | tr -d '\n' | head -c 32)

                # Update the env file with generated secrets
                if [[ "$(uname)" == "Darwin" ]]; then
                    # macOS
                    sed -i '' "s|^JWT_SECRET=.*|JWT_SECRET=$JWT_SECRET|" "$ENV_FILE"
                    sed -i '' "s|^AUTH_SECRET=.*|AUTH_SECRET=$AUTH_SECRET|" "$ENV_FILE"
                    sed -i '' "s|^ENCRYPTION_KEY=.*|ENCRYPTION_KEY=$ENCRYPTION_KEY|" "$ENV_FILE"
                else
                    # Linux
                    sed -i "s|^JWT_SECRET=.*|JWT_SECRET=$JWT_SECRET|" "$ENV_FILE"
                    sed -i "s|^AUTH_SECRET=.*|AUTH_SECRET=$AUTH_SECRET|" "$ENV_FILE"
                    sed -i "s|^ENCRYPTION_KEY=.*|ENCRYPTION_KEY=$ENCRYPTION_KEY|" "$ENV_FILE"
                fi
                echo -e "${GREEN}Generated secure secrets${NC}"
            else
                echo -e "${YELLOW}Warning: openssl not found, using default secrets${NC}"
                echo -e "${YELLOW}Please update $ENV_FILE with secure values for production${NC}"
            fi
        else
            echo -e "${RED}Error: $ENV_EXAMPLE not found${NC}"
            exit 1
        fi
    else
        echo -e "${GREEN}Using existing $ENV_FILE${NC}"
    fi
}

# Build images
build_images() {
    echo -e "${BLUE}Building container images...${NC}"
    cd "$PROJECT_ROOT"

    $COMPOSE_CMD -f "$COMPOSE_FILE" build
    echo -e "${GREEN}Images built successfully${NC}"
}

# Start services
start_services() {
    local profile="$1"
    echo -e "${BLUE}Starting services...${NC}"
    cd "$PROJECT_ROOT"

    if [[ -n "$profile" ]]; then
        echo -e "${YELLOW}Starting with profile: $profile${NC}"
        $COMPOSE_CMD -f "$COMPOSE_FILE" --profile "$profile" up -d
    else
        $COMPOSE_CMD -f "$COMPOSE_FILE" up -d
    fi

    echo -e "${GREEN}Services started${NC}"
}

# Stop services
stop_services() {
    echo -e "${BLUE}Stopping services...${NC}"
    cd "$PROJECT_ROOT"

    $COMPOSE_CMD -f "$COMPOSE_FILE" --profile full down
    echo -e "${GREEN}Services stopped${NC}"
}

# Clean up volumes
clean_volumes() {
    echo -e "${YELLOW}Warning: This will delete all data!${NC}"
    read -p "Are you sure? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${BLUE}Cleaning up volumes...${NC}"
        cd "$PROJECT_ROOT"

        $COMPOSE_CMD -f "$COMPOSE_FILE" --profile full down -v
        echo -e "${GREEN}Volumes removed${NC}"
    else
        echo -e "${YELLOW}Cleanup cancelled${NC}"
    fi
}

# Wait for services to be healthy
wait_for_services() {
    echo -e "${BLUE}Waiting for services to be healthy...${NC}"

    local max_attempts=60
    local attempt=1

    while [[ $attempt -le $max_attempts ]]; do
        if $CONTAINER_CMD ps --filter "name=ftm-" --filter "health=healthy" | grep -q "ftm-server"; then
            echo -e "${GREEN}All services are healthy!${NC}"
            return 0
        fi

        echo -n "."
        sleep 2
        ((attempt++))
    done

    echo -e "${RED}Timeout waiting for services${NC}"
    echo "Checking logs..."
    $COMPOSE_CMD -f "$COMPOSE_FILE" logs --tail=50
    return 1
}

# Run database migrations
run_migrations() {
    echo -e "${BLUE}Running database migrations...${NC}"
    cd "$PROJECT_ROOT"

    # Wait for database to be ready
    sleep 5

    # Run migrations via the server container
    $CONTAINER_CMD exec ftm-server npx prisma migrate deploy 2>/dev/null || {
        echo -e "${YELLOW}Note: Migrations may already be applied or schema is fresh${NC}"
    }

    echo -e "${GREEN}Database ready${NC}"
}

# Pull Ollama model
setup_ollama() {
    echo -e "${BLUE}Setting up Ollama with default model...${NC}"

    # Wait for Ollama to start
    sleep 10

    local model="${OLLAMA_MODEL:-llama3.2}"
    echo -e "${YELLOW}Pulling model: $model (this may take a few minutes)${NC}"

    $CONTAINER_CMD exec ftm-ollama ollama pull "$model" 2>/dev/null || {
        echo -e "${YELLOW}Note: Could not pull model. You can do this manually:${NC}"
        echo "  $CONTAINER_CMD exec ftm-ollama ollama pull $model"
    }
}

# Print status and URLs
print_status() {
    echo -e "${BLUE}"
    echo "═══════════════════════════════════════════════════════════════"
    echo "                    Setup Complete!"
    echo "═══════════════════════════════════════════════════════════════"
    echo -e "${NC}"
    echo -e "${GREEN}Services:${NC}"
    echo "  Frontend:   http://localhost:3000"
    echo "  API:        http://localhost:3001"
    echo "  API Docs:   http://localhost:3001/docs"
    echo ""
    echo -e "${GREEN}Infrastructure:${NC}"
    echo "  PostgreSQL: localhost:5432"
    echo "  Redis:      localhost:6379"

    if $CONTAINER_CMD ps | grep -q "ftm-ollama"; then
        echo "  Ollama:     http://localhost:11434"
    fi

    echo ""
    echo -e "${GREEN}Useful commands:${NC}"
    echo "  View logs:      $COMPOSE_CMD -f $COMPOSE_FILE logs -f"
    echo "  Stop services:  $COMPOSE_CMD -f $COMPOSE_FILE down"
    echo "  Shell into DB:  $CONTAINER_CMD exec -it ftm-db psql -U flowthreat"
    echo ""
    echo -e "${YELLOW}First time? Register at http://localhost:3000/register${NC}"
    echo ""
}

# Main function
main() {
    print_banner
    detect_runtime

    case "${1:-}" in
        --down)
            stop_services
            exit 0
            ;;
        --clean)
            stop_services
            clean_volumes
            exit 0
            ;;
        --help|-h)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --ai      Include AI services (Ollama)"
            echo "  --full    Start all services"
            echo "  --down    Stop all services"
            echo "  --clean   Stop services and remove volumes"
            echo "  --help    Show this help message"
            exit 0
            ;;
    esac

    check_prerequisites
    setup_env
    build_images

    local profile=""
    case "${1:-}" in
        --ai)
            profile="ai"
            ;;
        --full)
            profile="full"
            ;;
    esac

    start_services "$profile"
    wait_for_services
    run_migrations

    if [[ "$profile" == "ai" ]] || [[ "$profile" == "full" ]]; then
        setup_ollama
    fi

    print_status
}

# Run main
main "$@"

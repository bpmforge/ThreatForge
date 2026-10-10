# ThreatForge - Makefile
# Simple commands for common operations

.PHONY: help demo dev stop logs clean build deploy test

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-15s\033[0m %s\n", $$1, $$2}'

# Development
demo: ## Start demo environment (Docker)
	./scripts/demo.sh

dev: ## Start development servers (requires npm install first)
	@echo "Starting frontend on http://localhost:3000"
	@echo "Starting backend on http://localhost:3001"
	@cd frontend && npm run dev & cd server && npm run dev

stop: ## Stop all Docker services
	docker compose down
	docker compose -f docker-compose.prod.yml down 2>/dev/null || true

logs: ## View Docker logs
	docker compose logs -f

clean: ## Stop services and remove all data
	docker compose down -v
	docker compose -f docker-compose.prod.yml down -v 2>/dev/null || true

# Build
build: ## Build Docker images
	docker compose build

build-prod: ## Build production Docker images
	docker compose -f docker-compose.prod.yml build

# Production
deploy: ## Deploy to production
	./scripts/deploy-prod.sh

deploy-ssl: ## Generate self-signed SSL cert and deploy
	mkdir -p nginx/certs
	openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
		-keyout nginx/certs/privkey.pem \
		-out nginx/certs/fullchain.pem \
		-subj "/CN=localhost"
	./scripts/deploy-prod.sh

# Testing
test: ## Run all tests
	cd frontend && npm test
	cd server && npm test

test-e2e: ## Run E2E tests
	cd frontend && npm run test:e2e

lint: ## Run linters
	cd frontend && npm run lint
	cd server && npm run lint

# Database
db-migrate: ## Run database migrations
	cd server && npx prisma migrate deploy

db-studio: ## Open Prisma Studio
	cd server && npx prisma studio

db-reset: ## Reset database (WARNING: destroys data)
	docker compose down -v
	docker compose up -d db
	sleep 5
	cd server && npx prisma migrate deploy

db-backup: ## Create database backup
	./scripts/backup-db.sh

db-backup-s3: ## Create database backup and upload to S3
	./scripts/backup-db.sh --upload s3

db-backup-gcs: ## Create database backup and upload to GCS
	./scripts/backup-db.sh --upload gcs

# Utilities
ps: ## Show running containers
	docker compose ps
	docker compose -f docker-compose.prod.yml ps 2>/dev/null || true

shell-frontend: ## Shell into frontend container
	docker compose exec frontend sh

shell-server: ## Shell into server container
	docker compose exec server sh

shell-db: ## Shell into database container
	docker compose exec db psql -U flowuser -d flowthreat

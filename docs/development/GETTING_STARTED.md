# Getting Started with Development

This guide helps you set up a local development environment for ThreatForge.

## Prerequisites

- **Node.js 22+** - JavaScript runtime
- **npm 10+** - Package manager
- **Git** - Version control

Optional:
- **Docker** - For containerized development
- **PostgreSQL 17** - For production-like database (SQLite used by default)

## Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/bpmforge/ThreatForge.git
cd ThreatForge
```

### 2. Install Dependencies

There is no root package; install each workspace separately.

```bash
# Frontend dependencies
cd frontend
npm install

# Backend dependencies
cd ../server
npm install
```

### 3. Set Up Environment Variables

```bash
# Frontend (copy and edit)
cp frontend/.env.example frontend/.env.local

# Backend (copy and edit)
cp server/.env.example server/.env
```

Edit the `.env` files with your configuration:

**Frontend (`frontend/.env.local`):**
```env
# Auth.js configuration
AUTH_SECRET=your-secret-key-here  # Generate with: openssl rand -base64 32
AUTH_URL=http://localhost:3000

# Shared database (relative path to server's dev.db)
DATABASE_URL=file:../server/prisma/dev.db

# Backend API URL
NEXT_PUBLIC_API_URL=http://localhost:3001
```

**Backend (`server/.env`):**
```env
# Database (auto-detects provider from URL scheme)
DATABASE_URL="file:./prisma/dev.db"

# Authentication
JWT_SECRET=your-jwt-secret-here  # Generate with: openssl rand -base64 32

# Server
PORT=3001
CORS_ORIGIN=http://localhost:3000
```

### 4. Set Up the Database

Both frontend and backend share the same database. The **backend schema is the source of truth**.

```bash
# Generate backend Prisma client
cd server
npx prisma generate
npx prisma db push  # Creates tables

# Sync frontend schema from backend (important!)
cd ../frontend
npm run schema:sync     # Syncs schema from backend
npx prisma generate     # Generates frontend Prisma client
```

> **Note:** Run `npm run schema:sync` in frontend whenever the backend schema changes.

### 5. Start Development Servers

**Terminal 1 - Backend:**
```bash
cd server
npm run dev
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

### 6. Access the Application

- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:3001
- **API Docs:** http://localhost:3001/documentation

### 7. Create Your First Account

A fresh database has no users. Create the first (admin) account one of two ways:

- **Setup wizard:** open http://localhost:3000/setup — available until the first
  admin exists — and fill in the form.
- **CLI:** `cd server && npm run admin:bootstrap` and follow the prompts.

Then sign in at http://localhost:3000/login.

---

## Project Structure

```
threatforge/
├── frontend/                 # Next.js frontend application
│   ├── src/
│   │   ├── app/              # Next.js App Router pages
│   │   ├── components/       # Shared React components
│   │   ├── features/         # Feature modules
│   │   ├── stores/           # Zustand state stores
│   │   ├── types/            # TypeScript types
│   │   └── lib/              # Utilities
│   ├── public/               # Static assets
│   ├── prisma/               # Frontend Prisma schema (auth)
│   └── e2e/                  # Playwright E2E tests
│
├── server/                   # Fastify backend API
│   ├── src/
│   │   ├── api/              # Route handlers
│   │   ├── services/         # Business logic
│   │   ├── repositories/     # Data access
│   │   └── index.ts          # Server entry point
│   └── prisma/               # Backend Prisma schema
│
├── docs/                     # Documentation
└── tools/                    # Development tools
```

---

## Development Commands

### Frontend

```bash
cd frontend

# Development server
npm run dev

# Production build
npm run build

# Start production server
npm start

# Type checking
npm run typecheck

# Linting
npm run lint

# Unit tests
npm test

# E2E tests
npm run test:e2e

# E2E tests with UI
npm run test:e2e:ui
```

### Backend

```bash
cd server

# Development server (with hot reload)
npm run dev

# Production build
npm run build

# Start production server
npm start

# Type checking
npm run typecheck

# Linting
npm run lint

# Unit tests
npm test

# Generate Prisma client
npx prisma generate

# Push schema changes
npx prisma db push

# Open Prisma Studio (database GUI)
npx prisma studio
```

---

## Database Management

### Shared Database Architecture

Both frontend and backend connect to the **same database**. The database provider is auto-detected from the `DATABASE_URL` scheme:
- `file:` → SQLite
- `postgresql://` or `postgres://` → PostgreSQL

### Schema Management

The **backend schema is the single source of truth**:

```
server/prisma/schema/          # Modular schema files (23 files)
  ├── 00-config.prisma
  ├── 01-user-auth.prisma
  └── ...

frontend/prisma/schema.prisma  # Auto-generated from backend
```

**Sync workflow:**
```bash
# After changing backend schema, regenerate frontend
cd frontend
npm run schema:sync      # Syncs from backend
npm run schema:generate  # Syncs + generates Prisma client
```

### SQLite (Default)

Development uses SQLite by default. The database file is at `server/prisma/dev.db`.

```bash
# Reset database
rm server/prisma/dev.db
cd server && npx prisma db push

# Re-sync frontend
cd ../frontend && npm run schema:generate
```

### PostgreSQL (Production)

For production-like development:

```bash
# Start PostgreSQL with Docker
docker run -d \
  --name postgres \
  -e POSTGRES_USER=flowuser \
  -e POSTGRES_PASSWORD=flowpass \
  -e POSTGRES_DB=flowthreat \
  -p 5432:5432 \
  postgres:17

# Update both .env files
# server/.env
DATABASE_URL="postgresql://flowuser:flowpass@localhost:5432/flowthreat"

# frontend/.env.local (same URL for PostgreSQL)
DATABASE_URL="postgresql://flowuser:flowpass@localhost:5432/flowthreat"

# Push schema
cd server && npx prisma db push
```

### Prisma Studio

Visual database editor:

```bash
cd server
npx prisma studio
```

Opens at http://localhost:5555

### Health Checks

Verify database connectivity:

```bash
# Check server health
curl http://localhost:3001/health

# Detailed dependency check
curl http://localhost:3001/health/dependencies
```

---

## Testing

### Unit Tests

```bash
# Frontend
cd frontend && npm test

# Backend
cd server && npm test

# Watch mode
npm test -- --watch

# Coverage
npm test -- --coverage
```

### E2E Tests

```bash
cd frontend

# Install browsers (first time)
npx playwright install

# Run all E2E tests
npm run test:e2e

# Run specific test file
npx playwright test auth.spec.ts

# Run with UI mode
npx playwright test --ui

# Run headed (see browser)
npx playwright test --headed

# Debug mode
npx playwright test --debug
```

### Test Environment

E2E tests require both servers running:

```bash
# Terminal 1
cd server && npm run dev

# Terminal 2
cd frontend && npm run dev

# Terminal 3
cd frontend && npm run test:e2e
```

Or use the combined command if configured:

```bash
npm run test:e2e  # Starts servers and runs tests
```

---

## Code Style

### Formatting

Prettier is used for code formatting:

```bash
# Format all files
npm run format

# Check formatting
npm run format:check
```

### Linting

ESLint enforces code quality:

```bash
# Run linting
npm run lint

# Fix auto-fixable issues
npm run lint:fix
```

### Editor Setup

**VS Code Extensions:**
- ESLint
- Prettier
- Tailwind CSS IntelliSense
- Prisma

**Settings (`.vscode/settings.json`):**
```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  }
}
```

---

## Environment Variables

### Frontend

| Variable | Description | Default |
|----------|-------------|---------|
| `AUTH_SECRET` | Auth.js secret key | (required) |
| `AUTH_URL` | Frontend URL for Auth.js | `http://localhost:3000` |
| `DATABASE_URL` | Database connection | `file:../server/prisma/dev.db` |
| `NEXT_PUBLIC_API_URL` | Backend API URL | `http://localhost:3001` |

### Backend

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | Database connection string | `file:./prisma/dev.db` |
| `JWT_SECRET` | JWT signing secret | (required in prod) |
| `PORT` | Server port | `3001` |
| `CORS_ORIGIN` | Allowed CORS origin | `http://localhost:3000` |
| `ENCRYPTION_KEY` | Secrets-at-rest key. **Required in production.** Unset in dev → a random per-process key, so encrypted data is lost on restart. `openssl rand -hex 32` |
| `SETUP_TOKEN` | Token for production setup | (optional) |

### AI Providers

Cloud AI providers (Claude, OpenAI, Gemini, Vertex, …) are **bring-your-own-key,
configured per-organization inside the app** (Settings → AI), not via environment
variables — there is no `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` to set here, and
nothing reads them. Without a key configured, AI features simply stay inert (no
calls, no cost). The only AI endpoints read from the environment are the local
self-hosted ones:

| Variable | Description |
|----------|-------------|
| `OLLAMA_BASE_URL` | Ollama server URL (default: `http://localhost:11434`) |
| `LMSTUDIO_BASE_URL` | LM Studio server URL (default: `http://localhost:1234/v1`) |

---

## Troubleshooting

### Port Already in Use

```bash
# Find process using port
lsof -i :3000
lsof -i :3001

# Kill process
kill -9 <PID>
```

### Database Issues

```bash
# Reset database completely
cd server
rm -rf prisma/dev.db
npx prisma db push

# Sync frontend schema
cd ../frontend && npm run schema:generate
```

### Database Connection Failed on Startup

The server now shows clear error messages:
```
═══════════════════════════════════════════════════════════════════
  DATABASE CONNECTION FAILED
═══════════════════════════════════════════════════════════════════
  Provider:   SQLITE
  Error:      Cannot open SQLite database file
  Suggestion: Check the file path in DATABASE_URL...
═══════════════════════════════════════════════════════════════════
```

**Common fixes:**
- Ensure `DATABASE_URL` is set correctly
- For SQLite, ensure the directory exists
- Run `npx prisma db push` to create the database

### Prisma Client Out of Sync

```bash
# Backend
cd server
npx prisma generate

# Frontend (also syncs schema from backend)
cd ../frontend
npm run schema:generate
```

### Frontend/Backend Schema Mismatch

If you see errors about missing tables or columns:
```bash
# Regenerate frontend schema from backend
cd frontend
npm run schema:sync
npx prisma generate
```

### Node Modules Issues

```bash
# Clear and reinstall
rm -rf node_modules
rm -rf frontend/node_modules
rm -rf server/node_modules
npm install
cd frontend && npm install
cd ../server && npm install
```

### TypeScript Errors

```bash
# Check types
npm run typecheck

# Clear TypeScript cache
rm -rf frontend/.next
rm -rf server/dist
```

---

## Next Steps

1. **Explore the codebase** - Read through `frontend/src/features/` to understand feature organization
2. **Run the tests** - Ensure everything passes before making changes
3. **Read the architecture docs** - Understand the system design
4. **Pick an issue** - Find a good first issue to work on
5. **Make a contribution** - Submit a PR with your changes

# Frontend Dockerfile
FROM node:22-alpine AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Toolchain for native modules. `better-sqlite3` is a prod dependency (the SQLite
# Prisma adapter used for local dev) with no prebuilt binary for node 22 on
# alpine/musl, so `npm ci` compiles it with node-gyp — which needs python3 + a
# C++ compiler that node:22-alpine does not ship. Same latent trap the server
# image hit (fixed in #94): the layer was cached until the deploy script's
# `docker builder prune` aged it out, after which `npm ci` dies on
# `gyp ERR! not ok`. Build-stage only — the runner stage copies compiled output.
# Retry once to ride out transient alpine-mirror flakiness on the deploy host.
RUN apk add --no-cache python3 make g++ || (sleep 3 && apk add --no-cache python3 make g++)

# Copy package files
COPY package*.json ./

# Copy prisma directory and use PostgreSQL schema for container builds
COPY prisma ./prisma/
# Use PostgreSQL schema for container deployment (override SQLite default)
ARG USE_POSTGRESQL=true
RUN if [ "$USE_POSTGRESQL" = "true" ] && [ -f prisma/schema.postgresql.prisma ]; then \
      cp prisma/schema.postgresql.prisma prisma/schema.prisma; \
    fi

# Install dependencies
RUN npm ci

# Generate Prisma client
RUN npx prisma generate

# Build stage
FROM base AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Use PostgreSQL schema for container builds (do this again after COPY . . overwrites)
ARG USE_POSTGRESQL=true
RUN if [ "$USE_POSTGRESQL" = "true" ] && [ -f prisma/schema.postgresql.prisma ]; then \
      cp prisma/schema.postgresql.prisma prisma/schema.prisma; \
    fi

# Regenerate Prisma client with the correct schema
RUN npx prisma generate

# Set build-time environment variables
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_WS_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL

# Build Next.js application with webpack (Turbopack has JSON parsing issues with Prisma 7)
RUN npm run build

# Production stage - use full node_modules instead of standalone for Prisma 7 compatibility
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy the entire application with full node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.ts ./

# Set ownership
RUN chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Use next start instead of standalone server for full compatibility
CMD ["npm", "run", "start"]

# Server Dockerfile
FROM node:22-alpine AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Toolchain for native modules. `better-sqlite3` is a prod dependency (the
# SQLite Prisma adapter used for local dev) and ships no prebuilt binary for
# node 22 on alpine/musl, so `npm ci` compiles it with node-gyp — which needs
# python3 + a C++ compiler. Without these the build dies on
# `gyp ERR! not ok` -> `npm ci did not complete successfully: exit code 1`.
#
# This was latent: the layer was cached, so deploys succeeded until the deploy
# script's own `docker builder prune --filter until=24h` aged the cache out,
# after which EVERY deploy failed at this step (prod stuck on 2026-08-12).
# Build-stage only — the runner stage copies the compiled output, so the final
# image does not carry the compiler.
# Retry once to ride out transient alpine-mirror flakiness on the deploy host
# (observed `apk add` exit 1 mid-deploy).
RUN apk add --no-cache python3 make g++ || (sleep 3 && apk add --no-cache python3 make g++)

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/
COPY prisma.config.ts ./

# Install dependencies
RUN npm ci

# Use PostgreSQL for production - update the modular schema config
RUN sed -i 's/provider = "sqlite"/provider = "postgresql"/' prisma/schema/00-config.prisma

# Generate Prisma client for PostgreSQL
RUN npx prisma generate

# Build stage
FROM base AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Use PostgreSQL for production (re-apply after COPY . . overwrites prisma/)
RUN sed -i 's/provider = "sqlite"/provider = "postgresql"/' prisma/schema/00-config.prisma

# Regenerate Prisma client with the correct schema
RUN npx prisma generate

# Build TypeScript
RUN npm run build

# One-shot init/migrate stage: the builder stage already carries devDependencies
# (tsx, prisma CLI), src/, scripts/ and prisma/, which the slim runner image
# deliberately omits. Used by the `init` compose service (schema push, seed,
# admin bootstrap). Not the default target — the runner stage below stays last.
FROM builder AS migrate
ENV NODE_ENV=production
CMD ["sh", "scripts/docker-init.sh"]

# Production stage
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

# Install dumb-init for proper signal handling and wget for health checks
RUN apk add --no-cache dumb-init wget

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 fastify

# Copy built application
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts

# Set ownership
RUN chown -R fastify:nodejs /app

USER fastify

EXPOSE 3001

ENV PORT=3001
ENV HOST=0.0.0.0

# Commit this image was built from; /health reports it so a deploy can check
# the new code is what is serving (pass it with --build-arg GIT_SHA=...).
ARG GIT_SHA=unknown
ENV GIT_SHA=$GIT_SHA

# Use dumb-init as PID 1 for proper signal handling
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/index.js"]

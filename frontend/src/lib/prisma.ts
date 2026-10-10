/**
 * Prisma Client Singleton - Enterprise Database Configuration
 *
 * Database provider is auto-detected from DATABASE_URL scheme:
 *
 * For SQLite (local/desktop/Docker):
 *   DATABASE_URL=file:./data/app.db
 *
 * For PostgreSQL (cloud/enterprise):
 *   DATABASE_URL=postgresql://user:password@host:5432/dbname
 *
 * Prisma 7 requires adapters for database connections.
 *
 * IMPORTANT: Always use getPrisma() to get the client. The synchronous
 * export is only for backwards compatibility with existing code.
 */
import type { PrismaClient } from "@prisma/client";

// Lazily load PrismaClient via dynamic import (no require) so Turbopack keeps it external
// and the large runtime JSON stays intact. Cache the promise to avoid duplicate imports.
let prismaClientLoader: Promise<
  typeof import("@prisma/client").PrismaClient
> | null = null;
async function loadPrismaClient(): Promise<
  typeof import("@prisma/client").PrismaClient
> {
  if (!prismaClientLoader) {
    prismaClientLoader = import("@prisma/client").then((m) => m.PrismaClient);
  }
  return prismaClientLoader;
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | null;
  prismaInitializing: Promise<PrismaClient> | null;
};

type DatabaseProvider = "sqlite" | "postgresql";

/**
 * Detect database provider from DATABASE_URL scheme.
 * Matches backend detection logic in server/src/db.ts
 */
function getDatabaseProvider(): DatabaseProvider {
  const dbUrl = process.env.DATABASE_URL || "";
  if (dbUrl.startsWith("postgresql://") || dbUrl.startsWith("postgres://")) {
    return "postgresql";
  }
  return "sqlite"; // Default to SQLite for local development
}

function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL environment variable is required. " +
        "For SQLite: DATABASE_URL=file:./data/app.db\n" +
        "For PostgreSQL: DATABASE_URL=postgresql://user:password@host:5432/dbname",
    );
  }
  return url;
}

async function createAdapter() {
  const provider = getDatabaseProvider();
  const url = getDatabaseUrl();

  if (provider === "postgresql") {
    // Dynamically import PostgreSQL adapter
    const { PrismaPg } = await import("@prisma/adapter-pg");
    const { Pool } = await import("pg");
    const pool = new Pool({ connectionString: url });
    return new PrismaPg(pool);
  } else {
    // SQLite adapter
    const { PrismaBetterSqlite3 } = await import(
      "@prisma/adapter-better-sqlite3"
    );
    // Remove file: prefix if present for better-sqlite3
    const dbPath = url.startsWith("file:") ? url.slice(5) : url;
    return new PrismaBetterSqlite3({ url: dbPath });
  }
}

/**
 * Async initialization for PostgreSQL support
 * Use this in API routes: const prisma = await getPrisma();
 */
export async function getPrisma(): Promise<PrismaClient> {
  // Return existing client if already initialized
  if (globalForPrisma.prisma) {
    return globalForPrisma.prisma;
  }

  // Wait for in-progress initialization to complete
  if (globalForPrisma.prismaInitializing) {
    return globalForPrisma.prismaInitializing;
  }

  // Start initialization
  const initPromise = (async () => {
    const PrismaClient = await loadPrismaClient();
    const adapter = await createAdapter();
    const client = new PrismaClient({
      adapter,
      log:
        process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    });

    globalForPrisma.prisma = client;
    globalForPrisma.prismaInitializing = null;

    return client;
  })();

  globalForPrisma.prismaInitializing = initPromise;
  return initPromise;
}

// Note: We don't export a synchronous `prisma` constant anymore
// because it causes build-time issues with Next.js when the DATABASE_URL
// is not available. Always use `await getPrisma()` instead.

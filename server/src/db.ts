/**
 * Prisma client singleton for database access.
 *
 * Supports both SQLite (development) and PostgreSQL (production).
 * Database type is determined by DATABASE_URL environment variable.
 *
 * IMPORTANT: Always use getPrisma() to access the Prisma client.
 * This async function properly initializes the database adapter.
 */
import { PrismaClient } from "@prisma/client";
import type { Pool as PgPool } from "pg";
import { withFieldEncryption } from "./middleware/field-encryption.js";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  pgPool: PgPool | undefined;
};

export type DatabaseProvider = "sqlite" | "postgresql";

/**
 * Connection pool metrics (PostgreSQL only)
 */
export interface PoolMetrics {
  provider: DatabaseProvider;
  totalConnections: number;
  idleConnections: number;
  waitingClients: number;
  maxConnections: number;
}

function detectProvider(): DatabaseProvider {
  const dbUrl = process.env.DATABASE_URL || "";
  if (dbUrl.startsWith("postgresql://") || dbUrl.startsWith("postgres://")) {
    return "postgresql";
  }
  return "sqlite";
}

async function createPrismaClient(): Promise<PrismaClient> {
  const provider = detectProvider();
  const dbUrl = process.env.DATABASE_URL;

  if (provider === "postgresql") {
    // PostgreSQL - use pg adapter
    const { PrismaPg } = await import("@prisma/adapter-pg");
    const { Pool } = await import("pg");
    const pool = new Pool({ connectionString: dbUrl });

    // Store pool for metrics access
    globalForPrisma.pgPool = pool;

    const adapter = new PrismaPg(pool);

    return new PrismaClient({
      adapter,
      log:
        process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    });
  } else {
    // SQLite - use better-sqlite3 adapter
    const { PrismaBetterSqlite3 } = await import(
      "@prisma/adapter-better-sqlite3"
    );
    const path = await import("path");
    const { fileURLToPath } = await import("url");

    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const dbPath = dbUrl?.startsWith("file:")
      ? dbUrl.slice(5)
      : path.resolve(__dirname, "../prisma/dev.db");

    const adapter = new PrismaBetterSqlite3({ url: `file:${dbPath}` });

    return new PrismaClient({
      adapter,
      log:
        process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    });
  }
}

// Cached prisma instance
let prismaInstance: PrismaClient | null = null;

/**
 * Get the Prisma client instance.
 *
 * This is the recommended way to access Prisma. It properly initializes
 * the database adapter for both SQLite and PostgreSQL.
 *
 * @example
 * const prisma = await getPrisma();
 * const users = await prisma.user.findMany();
 */
export async function getPrisma(): Promise<PrismaClient> {
  if (prismaInstance) {
    return prismaInstance;
  }

  if (globalForPrisma.prisma) {
    prismaInstance = globalForPrisma.prisma;
    return prismaInstance;
  }

  const client = await createPrismaClient();
  prismaInstance = withFieldEncryption(client);

  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = prismaInstance;
  }

  return prismaInstance;
}

/**
 * Connection test result
 */
export interface ConnectionTestResult {
  ok: boolean;
  provider: DatabaseProvider;
  latencyMs?: number;
  error?: string;
  suggestion?: string;
}

/**
 * Format connection error into a user-friendly message
 */
function formatConnectionError(error: unknown): {
  error: string;
  suggestion: string;
} {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorCode = (error as { code?: string }).code;

  // PostgreSQL errors
  if (errorCode === "ECONNREFUSED") {
    const match = errorMessage.match(/(\d+\.\d+\.\d+\.\d+):(\d+)/);
    const host = match ? match[1] : "localhost";
    const port = match ? match[2] : "5432";
    return {
      error: `Cannot connect to PostgreSQL at ${host}:${port}`,
      suggestion:
        "Ensure PostgreSQL is running and accessible at the configured host/port",
    };
  }

  if (errorCode === "ENOTFOUND") {
    return {
      error: "Database host not found",
      suggestion: "Check the hostname in your DATABASE_URL",
    };
  }

  if (errorMessage.includes("password authentication failed")) {
    return {
      error: "Database authentication failed",
      suggestion: "Check your database username and password in DATABASE_URL",
    };
  }

  if (
    errorMessage.includes("database") &&
    errorMessage.includes("does not exist")
  ) {
    const dbMatch = errorMessage.match(/database "([^"]+)" does not exist/);
    const dbName = dbMatch ? dbMatch[1] : "unknown";
    return {
      error: `Database "${dbName}" does not exist`,
      suggestion:
        "Create the database or update DATABASE_URL to point to an existing database",
    };
  }

  // SQLite errors
  if (
    errorMessage.includes("SQLITE_CANTOPEN") ||
    errorMessage.includes("unable to open database")
  ) {
    return {
      error: "Cannot open SQLite database file",
      suggestion:
        "Check the file path in DATABASE_URL and ensure the directory exists with write permissions",
    };
  }

  if (errorMessage.includes("ENOENT")) {
    return {
      error: "Database file or directory not found",
      suggestion:
        'Run "npx prisma db push" to create the database, or check your DATABASE_URL path',
    };
  }

  // Generic fallback
  return {
    error: errorMessage,
    suggestion:
      "Check your DATABASE_URL environment variable and database server status",
  };
}

/**
 * Test database connection and return detailed status.
 * Use this during startup to verify the database is accessible.
 *
 * @example
 * const result = await testConnection();
 * if (!result.ok) {
 *   console.error(`Database error: ${result.error}`);
 *   console.error(`Suggestion: ${result.suggestion}`);
 *   process.exit(1);
 * }
 */
export async function testConnection(): Promise<ConnectionTestResult> {
  const provider = detectProvider();
  const startTime = Date.now();

  try {
    const prisma = await getPrisma();
    // Simple query to test connection
    await prisma.$queryRaw`SELECT 1`;
    const latencyMs = Date.now() - startTime;

    return {
      ok: true,
      provider,
      latencyMs,
    };
  } catch (error) {
    const { error: errorMsg, suggestion } = formatConnectionError(error);
    return {
      ok: false,
      provider,
      error: errorMsg,
      suggestion,
    };
  }
}

/**
 * Get the current database provider type.
 */
export function getDatabaseProvider(): DatabaseProvider {
  return detectProvider();
}

/**
 * Get connection pool metrics (PostgreSQL only).
 * Returns null for SQLite (no connection pooling).
 */
export function getPoolMetrics(): PoolMetrics | null {
  const provider = detectProvider();

  if (provider !== "postgresql" || !globalForPrisma.pgPool) {
    return null;
  }

  const pool = globalForPrisma.pgPool;

  return {
    provider,
    totalConnections: pool.totalCount,
    idleConnections: pool.idleCount,
    waitingClients: pool.waitingCount,
    maxConnections: pool.options.max || 10, // pg default is 10
  };
}

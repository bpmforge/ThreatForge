/**
 * Health Check Service
 *
 * Comprehensive health checks for all application dependencies.
 */

import os from "node:os";
import { readFileSync } from "node:fs";
import v8 from "node:v8";
import { getPrisma, getPoolMetrics, type PoolMetrics } from "../../db.js";
import { isRedisEnabled } from "../redis-collaboration.js";

// Health check status
type HealthStatus = "healthy" | "degraded" | "unhealthy";

// Health check result
export interface HealthCheckResult {
  status: HealthStatus;
  message?: string;
  latencyMs?: number;
  details?: Record<string, unknown>;
}

// Overall health response
export interface HealthResponse {
  status: HealthStatus;
  timestamp: string;
  /** Package version of the running server. */
  version: string;
  /** Git commit the image was built from (GIT_SHA build arg), or "unknown". */
  commit: string;
  uptime: number;
  checks: Record<string, HealthCheckResult>;
}

/** server/package.json's version (src/ and dist/ are both three levels down). */
function readAppVersion(): string {
  try {
    const pkg = JSON.parse(
      readFileSync(new URL("../../../package.json", import.meta.url), "utf8"),
    ) as { version?: string };
    return pkg.version ?? "unknown";
  } catch {
    return "unknown";
  }
}
const APP_VERSION = readAppVersion();

// Track start time for uptime
const startTime = Date.now();

/**
 * Check database health
 */
async function checkDatabase(): Promise<HealthCheckResult> {
  const start = performance.now();

  try {
    const prisma = await getPrisma();
    await prisma.$queryRaw`SELECT 1`;

    return {
      status: "healthy",
      latencyMs: Math.round(performance.now() - start),
    };
  } catch (error) {
    return {
      status: "unhealthy",
      message:
        error instanceof Error ? error.message : "Database connection failed",
      latencyMs: Math.round(performance.now() - start),
    };
  }
}

/**
 * Check Redis health (if enabled)
 */
async function checkRedis(): Promise<HealthCheckResult> {
  if (!isRedisEnabled()) {
    return {
      status: "healthy",
      message: "Redis not configured (using in-memory)",
    };
  }

  const start = performance.now();

  try {
    // In production, would ping Redis
    return {
      status: "healthy",
      latencyMs: Math.round(performance.now() - start),
    };
  } catch (error) {
    return {
      status: "degraded",
      message:
        error instanceof Error ? error.message : "Redis connection failed",
      latencyMs: Math.round(performance.now() - start),
    };
  }
}

/**
 * Check database connection pool (PostgreSQL only)
 */
function checkConnectionPool(): HealthCheckResult & { pool?: PoolMetrics } {
  const metrics = getPoolMetrics();

  if (!metrics) {
    return {
      status: "healthy",
      message: "SQLite (no connection pooling)",
    };
  }

  // Check pool utilization
  const utilization = metrics.totalConnections / metrics.maxConnections;
  let status: HealthStatus = "healthy";

  if (utilization > 0.9 || metrics.waitingClients > 0) {
    status = "degraded";
  }
  if (utilization >= 1.0 && metrics.waitingClients > 5) {
    status = "unhealthy";
  }

  return {
    status,
    pool: metrics,
    details: {
      utilization: Math.round(utilization * 100) + "%",
    },
  };
}

/**
 * Check memory usage
 */
export function checkMemory(): HealthCheckResult {
  const usage = process.memoryUsage();
  const heapUsedMB = Math.round(usage.heapUsed / 1024 / 1024);
  const heapTotalMB = Math.round(usage.heapTotal / 1024 / 1024);
  const rssMB = Math.round(usage.rss / 1024 / 1024);

  // Measure against V8's heap limit, not heapTotal: V8 grows heapTotal lazily,
  // so used/total reads ~95% on a freshly booted, idle process.
  const heapLimit = v8.getHeapStatistics().heap_size_limit;
  const heapUsagePercent = (usage.heapUsed / heapLimit) * 100;

  let status: HealthStatus = "healthy";
  if (heapUsagePercent > 90) {
    status = "unhealthy";
  } else if (heapUsagePercent > 75) {
    status = "degraded";
  }

  return {
    status,
    details: {
      heapUsedMB,
      heapTotalMB,
      heapLimitMB: Math.round(heapLimit / 1024 / 1024),
      rssMB,
      heapUsagePercent: Math.round(heapUsagePercent),
    },
  };
}

/**
 * Check CPU usage (simplified)
 */
function checkCpu(): HealthCheckResult {
  const cpuUsage = process.cpuUsage();

  return {
    status: "healthy",
    details: {
      userMicroseconds: cpuUsage.user,
      systemMicroseconds: cpuUsage.system,
    },
  };
}

/**
 * Run all health checks
 */
export async function runHealthChecks(): Promise<HealthResponse> {
  const [database, redis] = await Promise.all([checkDatabase(), checkRedis()]);

  const memory = checkMemory();
  const cpu = checkCpu();
  const connectionPool = checkConnectionPool();

  const checks = {
    database,
    redis,
    connectionPool,
    memory,
    cpu,
  };

  // Determine overall status
  const statuses = Object.values(checks).map((c) => c.status);
  let overallStatus: HealthStatus = "healthy";

  if (statuses.includes("unhealthy")) {
    overallStatus = "unhealthy";
  } else if (statuses.includes("degraded")) {
    overallStatus = "degraded";
  }

  return {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    version: APP_VERSION,
    commit: process.env.GIT_SHA || "unknown",
    uptime: Math.round((Date.now() - startTime) / 1000),
    checks,
  };
}

/**
 * Run liveness check (basic check that app is running)
 */
export function runLivenessCheck(): { status: "ok"; timestamp: string } {
  return {
    status: "ok",
    timestamp: new Date().toISOString(),
  };
}

/**
 * Run readiness check (check that app is ready to receive traffic)
 */
export async function runReadinessCheck(): Promise<{
  ready: boolean;
  checks: Record<string, boolean>;
}> {
  const [database, redis] = await Promise.all([checkDatabase(), checkRedis()]);

  const checks = {
    database: database.status !== "unhealthy",
    redis: redis.status !== "unhealthy",
  };

  return {
    ready: Object.values(checks).every(Boolean),
    checks,
  };
}

/**
 * Dependency check result
 */
export interface DependencyCheckResult {
  ready: boolean;
  checks: {
    database: {
      ok: boolean;
      provider?: string;
      latencyMs?: number;
      error?: string;
    };
    redis: { ok: boolean; required: boolean; error?: string };
    encryption: { ok: boolean; error?: string };
    envVars: { ok: boolean; missing?: string[] };
  };
}

/**
 * Run comprehensive dependency checks for startup verification.
 * Returns detailed status of all required services.
 */
export async function runDependencyCheck(): Promise<DependencyCheckResult> {
  const IS_PRODUCTION = process.env.NODE_ENV === "production";

  // Check required environment variables
  const requiredVars: string[] = [];
  if (IS_PRODUCTION) {
    requiredVars.push("JWT_SECRET", "DATABASE_URL");
  }
  const missingVars = requiredVars.filter((v) => !process.env[v]);
  const envVarsOk = missingVars.length === 0;

  // Check encryption key in production
  const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
  const encryptionOk =
    !IS_PRODUCTION || (!!ENCRYPTION_KEY && ENCRYPTION_KEY.length >= 32);

  // Check database
  const dbResult = await checkDatabase();
  const dbProvider = process.env.DATABASE_URL?.startsWith("postgres")
    ? "postgresql"
    : "sqlite";
  const databaseCheck = {
    ok: dbResult.status !== "unhealthy",
    provider: dbProvider,
    latencyMs: dbResult.latencyMs,
    error: dbResult.status === "unhealthy" ? dbResult.message : undefined,
  };

  // Check Redis
  const redisRequired = !!process.env.REDIS_URL;
  const redisResult = await checkRedis();
  const redisCheck = {
    ok: redisResult.status !== "unhealthy",
    required: redisRequired,
    error: redisResult.status === "unhealthy" ? redisResult.message : undefined,
  };

  const allOk =
    databaseCheck.ok &&
    (redisCheck.ok || !redisRequired) &&
    encryptionOk &&
    envVarsOk;

  return {
    ready: allOk,
    checks: {
      database: databaseCheck,
      redis: redisCheck,
      encryption: {
        ok: encryptionOk,
        error: !encryptionOk
          ? "ENCRYPTION_KEY not set or too short (min 32 chars)"
          : undefined,
      },
      envVars: {
        ok: envVarsOk,
        missing: missingVars.length > 0 ? missingVars : undefined,
      },
    },
  };
}

/**
 * Get system info
 */
export function getSystemInfo(): {
  nodeVersion: string;
  platform: string;
  arch: string;
  cpus: number;
  totalMemoryMB: number;
  freeMemoryMB: number;
  loadAverage: number[];
  uptime: number;
  pid: number;
} {
  return {
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch,
    cpus: os.cpus().length,
    totalMemoryMB: Math.round(os.totalmem() / 1024 / 1024),
    freeMemoryMB: Math.round(os.freemem() / 1024 / 1024),
    loadAverage: os.loadavg(),
    uptime: Math.round((Date.now() - startTime) / 1000),
    pid: process.pid,
  };
}

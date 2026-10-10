/**
 * ThreatForge - Backend Server Entry Point
 *
 * Process bootstrap: env checks, DB/Redis init, listen, graceful shutdown.
 * The Fastify app itself is built in app.ts.
 */
import "dotenv/config";
import { testConnection } from "./db.js";
import { recoverOrphanedJobs } from "./jobs/orphan-recovery.js";
import {
  initializeRedisCollaboration,
  cleanupRedisConnections,
  getServerId,
} from "./services/redis-collaboration.js";
import logger from "./utils/logger.js";
import { assertEncryptionConfigured } from "./middleware/field-encryption.js";
import { buildServer } from "./app.js";

const PORT = parseInt(process.env.PORT || "3001", 10);
const HOST = process.env.HOST || "0.0.0.0";

// Outside development JWT_SECRET must be set, at least 32 characters, and
// not one of the example values shipped in this repository.
const JWT_SECRET = process.env.JWT_SECRET;
const EXAMPLE_SECRETS = [
  "change-this-in-production",
  "change-this-to-a-secure-random-string",
  "development-only-secret-not-for-production",
];
if (process.env.NODE_ENV !== "development") {
  if (
    !JWT_SECRET ||
    JWT_SECRET.length < 32 ||
    EXAMPLE_SECRETS.some((example) => JWT_SECRET.includes(example))
  ) {
    logger.fatal(
      "FATAL: JWT_SECRET must be set to a random value of at least 32 characters (openssl rand -base64 32)",
    );
    process.exit(1);
  }
}
// Only reached in development (line 105 exits for all non-development envs above)
const jwtSecret = JWT_SECRET || "development-only-secret-not-for-production";

/**
 * Start the server.
 */
async function start() {
  try {
    assertEncryptionConfigured();

    // Test database connection early with clear error messages
    const dbTest = await testConnection();
    if (!dbTest.ok) {
      logger.fatal(
        {
          provider: dbTest.provider,
          error: dbTest.error,
          suggestion: dbTest.suggestion,
          databaseUrlSet: !!process.env.DATABASE_URL,
        },
        "DATABASE CONNECTION FAILED",
      );
      process.exit(1);
    }
    logger.info(
      `Database connected (${dbTest.provider}, ${dbTest.latencyMs}ms)`,
    );

    // Initialize Redis collaboration if REDIS_URL is configured
    const redisInitialized = await initializeRedisCollaboration();
    if (redisInitialized) {
      logger.info("Redis collaboration enabled for horizontal scaling");
    }

    // Initialize AI job queue if Redis is available
    if (process.env.REDIS_URL) {
      const { initAiQueue } = await import("./jobs/ai-queue.js");
      await initAiQueue(process.env.REDIS_URL);
      logger.info("AI job queue initialized (BullMQ)");

      // Daily freshness check — notifies org members about stale threat models
      const { initFreshnessQueue } = await import("./jobs/freshness-queue.js");
      await initFreshnessQueue(process.env.REDIS_URL);
      logger.info("Freshness check queue initialized (daily @ 09:00 UTC)");

      // Webhook delivery retry queue
      const { initWebhookRetryQueue } = await import(
        "./jobs/webhook-retry-queue.js"
      );
      await initWebhookRetryQueue(process.env.REDIS_URL);
      logger.info("Webhook retry queue initialized");
    }

    await recoverOrphanedJobs(process.env.REDIS_URL);

    const server = await buildServer({ jwtSecret });

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      server.log.info(`Received ${signal}, shutting down gracefully...`);

      // AI-SPEND: write unsynced AI usage/cost before the process exits.
      const { aiMetrics } = await import("./services/ai/ai-metrics.js");
      await aiMetrics
        .syncToDB()
        .catch((err) =>
          server.log.error({ err }, "Final AI metrics sync failed"),
        );

      // Close Redis connections
      await cleanupRedisConnections();

      // Close server
      await server.close();

      process.exit(0);
    };

    process.on("SIGINT", () => shutdown("SIGINT"));
    process.on("SIGTERM", () => shutdown("SIGTERM"));

    await server.listen({ port: PORT, host: HOST });

    server.log.info(`Server listening on http://${HOST}:${PORT}`);
    if (redisInitialized) {
      server.log.info(
        `Redis collaboration enabled - Server ID: ${getServerId()}`,
      );
    }
  } catch (err) {
    logger.error({ err: err }, "Failed to start server:");
    await cleanupRedisConnections();
    process.exit(1);
  }
}

start();

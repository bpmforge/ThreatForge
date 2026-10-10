/**
 * GitHub Issues Integration API - Modular Entry Point
 *
 * Create GitHub issues from threats/mitigations with bidirectional sync.
 */
import type { FastifyPluginAsync } from "fastify";
import { configurationRoutes } from "./routes/configuration.js";
import { metadataRoutes } from "./routes/metadata.js";
import { issueRoutes } from "./routes/issues.js";
import { syncRoutes } from "./routes/sync.js";
import { webhookRoutes } from "./routes/webhook.js";
import { analyzeRoutes } from "./routes/analyze.js";

export const githubRoutes: FastifyPluginAsync = async (server) => {
  await server.register(configurationRoutes);
  await server.register(metadataRoutes);
  await server.register(issueRoutes);
  await server.register(syncRoutes);
  await server.register(webhookRoutes);
  await server.register(analyzeRoutes);
};

// Re-export types and helpers
export * from "./schemas.js";
export * from "./helpers.js";

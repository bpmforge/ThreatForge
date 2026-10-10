/**
 * JIRA Integration API - Modular Entry Point
 *
 * Full JIRA integration with OAuth2, issue creation, and bidirectional sync.
 */
import type { FastifyPluginAsync } from "fastify";
import { configurationRoutes } from "./routes/configuration.js";
import { metadataRoutes } from "./routes/metadata.js";
import { issueRoutes } from "./routes/issues.js";
import { syncRoutes } from "./routes/sync.js";
import { statusRoutes } from "./routes/status.js";
import { webhookRoutes } from "./routes/webhook.js";

export const jiraRoutes: FastifyPluginAsync = async (server) => {
  await server.register(configurationRoutes);
  await server.register(metadataRoutes);
  await server.register(issueRoutes);
  await server.register(syncRoutes);
  await server.register(statusRoutes);
  await server.register(webhookRoutes);
};

// Re-export types and helpers
export * from "./schemas.js";
export * from "./helpers.js";

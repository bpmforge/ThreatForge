/**
 * CI/CD API - Modular Entry Point
 *
 * Endpoints for threat model scanning in CI/CD pipelines.
 * Supports:
 * - GitHub Actions (PR comments, check runs, commit status)
 * - GitLab CI (MR comments, commit status)
 * - Bitbucket Pipelines (PR comments, build status)
 */
import type { FastifyPluginAsync } from "fastify";
import { scanRoutes } from "./routes/scan.js";
import { apiKeyRoutes } from "./routes/api-keys.js";
import { webhookSecretRoutes } from "./routes/webhook-secret.js";
import { feedbackRoutes } from "./routes/feedback.js";
import { webhookRoutes } from "./routes/webhooks.js";

// Extend Fastify's config type to include skipAuth
declare module "fastify" {
  interface FastifyContextConfig {
    skipAuth?: boolean;
  }
}

export const ciRoutes: FastifyPluginAsync = async (fastify) => {
  await fastify.register(scanRoutes);
  await fastify.register(apiKeyRoutes);
  await fastify.register(webhookSecretRoutes);
  await fastify.register(feedbackRoutes);
  await fastify.register(webhookRoutes);
};

// Re-export types and helpers
export * from "./schemas.js";
export * from "./helpers.js";

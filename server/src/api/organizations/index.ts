/**
 * Organization API - Modular Entry Point
 *
 * CRUD operations for organizations, members, and audit log.
 * All routes require authentication and verify organization membership.
 */
import type { FastifyPluginAsync } from "fastify";
import { crudRoutes } from "./routes/crud.js";
import { settingsRoutes } from "./routes/settings.js";
import { freshnessRoutes } from "./routes/freshness.js";
import { brandingRoutes } from "./routes/branding.js";

export const organizationRoutes: FastifyPluginAsync = async (fastify) => {
  await fastify.register(crudRoutes);
  await fastify.register(settingsRoutes);
  await fastify.register(freshnessRoutes);
  await fastify.register(brandingRoutes);
};

// Re-export helpers for use by other modules
export * from "./helpers.js";

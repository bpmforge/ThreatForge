/**
 * Admin API Routes - Modular Entry Point
 *
 * Combines all admin route modules into a single plugin.
 */
import type { FastifyPluginAsync } from "fastify";
import { settingsRoutes } from "./settings-routes.js";
import { statsRoutes } from "./stats-routes.js";
import { usersRoutes } from "./users-routes.js";
import { membershipsRoutes } from "./memberships-routes.js";
import { organizationsRoutes } from "./organizations-routes.js";
import { auditRoutes } from "./audit-routes.js";
import { bulkRoutes } from "./bulk-routes.js";

/**
 * Admin routes plugin - registers all admin sub-routes.
 */
export const adminRoutes: FastifyPluginAsync = async (server) => {
  // Register all admin route modules
  await server.register(settingsRoutes);
  await server.register(statsRoutes);
  await server.register(usersRoutes);
  await server.register(membershipsRoutes);
  await server.register(organizationsRoutes);
  await server.register(auditRoutes);
  await server.register(bulkRoutes);
};

// Re-export utilities for use by other modules

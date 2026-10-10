/**
 * Custom Roles API - Modular Entry Point
 *
 * Manage organization-level custom roles with fine-grained permissions.
 * All routes require authentication.
 */
import type { FastifyPluginAsync } from "fastify";
import { queryRoutes } from "./routes/queries.js";
import { mutationRoutes } from "./routes/mutations.js";
import { assignmentRoutes } from "./routes/assignments.js";
import { permissionRoutes } from "./routes/permissions.js";

export const customRoleRoutes: FastifyPluginAsync = async (fastify) => {
  await fastify.register(queryRoutes);
  await fastify.register(mutationRoutes);
  await fastify.register(assignmentRoutes);
  await fastify.register(permissionRoutes);
};

// Re-export types and helpers
export * from "./helpers.js";

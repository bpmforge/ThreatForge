/**
 * Audit Log API - Modular Entry Point
 *
 * Query and export audit logs for organizations and threat models.
 * All routes require authentication.
 */
import type { FastifyPluginAsync } from "fastify";
import { queryRoutes } from "./routes/queries.js";
import { managementRoutes } from "./routes/management.js";

export const auditRoutes: FastifyPluginAsync = async (fastify) => {
  await fastify.register(managementRoutes);
  await fastify.register(queryRoutes);
};

/**
 * Project API - Modular Entry Point
 *
 * CRUD operations for projects including members and sharing.
 * All routes require authentication and verify access via organization membership.
 */
import type { FastifyPluginAsync } from "fastify";
import { crudRoutes } from "./routes/crud.js";
import { memberRoutes } from "./routes/members.js";

export const projectRoutes: FastifyPluginAsync = async (fastify) => {
  await fastify.register(crudRoutes);
  await fastify.register(memberRoutes);
};

// Re-export helpers for use by other modules
export * from "./helpers.js";

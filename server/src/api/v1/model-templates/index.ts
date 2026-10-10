/**
 * Model Templates API (v1)
 *
 * Save complete threat models as reusable templates.
 */
import type { FastifyPluginAsync } from "fastify";
import { listRoutes } from "./list-routes.js";
import { createRoutes } from "./create-routes.js";
import { deleteRoutes } from "./delete-routes.js";

// Re-export schemas
export * from "./schemas.js";

/**
 * Model Templates routes
 */
export const modelTemplateRoutes: FastifyPluginAsync = async (server) => {
  await server.register(listRoutes);
  await server.register(createRoutes);
  await server.register(deleteRoutes);
};

/**
 * Mitigation Library API (v1) - Barrel
 *
 * Allows organizations to create and manage reusable mitigation templates.
 */
import type { FastifyPluginAsync } from "fastify";
import { libraryRoutes } from "./routes/libraries.js";
import { templateRoutes } from "./routes/templates.js";
import { templateMutationRoutes } from "./routes/template-mutations.js";
import { templateSearchRoutes } from "./routes/template-search.js";

export const mitigationLibraryRoutes: FastifyPluginAsync = async (server) => {
  await server.register(libraryRoutes);
  await server.register(templateRoutes);
  await server.register(templateMutationRoutes);
  await server.register(templateSearchRoutes);
};

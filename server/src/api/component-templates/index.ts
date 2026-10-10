/**
 * Component Templates API - Modular Entry Point
 *
 * CRUD operations for component template libraries and templates.
 * All routes require authentication.
 */
import type { FastifyPluginAsync } from "fastify";
import { libraryRoutes } from "./routes/libraries.js";
import { templateRoutes } from "./routes/templates.js";

export const componentTemplateRoutes: FastifyPluginAsync = async (fastify) => {
  await fastify.register(libraryRoutes);
  await fastify.register(templateRoutes);
};

// Re-export helpers
export * from "./helpers.js";

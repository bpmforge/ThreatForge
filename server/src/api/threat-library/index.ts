/**
 * Threat Library API - Modular Entry Point
 *
 * CRUD operations for threat libraries and threat templates.
 * All routes require authentication.
 */
import type { FastifyPluginAsync } from "fastify";
import { libraryRoutes } from "./routes/libraries.js";
import { templateRoutes } from "./routes/templates.js";
import { importExportRoutes } from "./routes/import-export.js";

export const threatLibraryRoutes: FastifyPluginAsync = async (fastify) => {
  await fastify.register(importExportRoutes);
  await fastify.register(libraryRoutes);
  await fastify.register(templateRoutes);
};

// Re-export types and helpers
export * from "./schemas.js";
export * from "./helpers.js";

/**
 * AI Prompts API - Modular Entry Point
 *
 * Endpoints for:
 * - Listing, viewing, creating, updating, deleting prompt templates
 * - Managing document type configurations
 * - Executing prompts
 * - Viewing execution logs
 */
import type { FastifyPluginAsync } from "fastify";
import { templateRoutes } from "./routes/templates.js";
import { documentTypeRoutes } from "./routes/document-types.js";
import { executionRoutes } from "./routes/execution.js";
import { logRoutes } from "./routes/logs.js";

export const promptRoutes: FastifyPluginAsync = async (server) => {
  await server.register(templateRoutes);
  await server.register(documentTypeRoutes);
  await server.register(executionRoutes);
  await server.register(logRoutes);
};

// Re-export types and helpers
export * from "./types.js";
export * from "./helpers.js";

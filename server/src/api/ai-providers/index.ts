/**
 * AI Providers API
 *
 * Multi-provider configuration with fallback ordering,
 * connection testing, and usage tracking.
 */
import type { FastifyPluginAsync } from "fastify";
import { crudRoutes } from "./crud-routes.js";
import { managementRoutes } from "./management-routes.js";

// Re-export types
export * from "./types.js";

/**
 * AI Providers routes
 */
export const aiProviderRoutes: FastifyPluginAsync = async (server) => {
  await server.register(crudRoutes);
  await server.register(managementRoutes);
};

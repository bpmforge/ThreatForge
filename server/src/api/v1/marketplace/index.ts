/**
 * Marketplace API (v1)
 *
 * Browse and subscribe to shared libraries and templates.
 */
import type { FastifyPluginAsync } from "fastify";
import { browseRoutes } from "./browse-routes.js";
import { publishRoutes } from "./publish-routes.js";
import { subscriptionRoutes } from "./subscription-routes.js";

// Re-export schemas for external use
export * from "./schemas.js";

/**
 * Public marketplace routes
 * Mounted at /api/v1/marketplace
 */
export const marketplaceRoutes: FastifyPluginAsync = async (server) => {
  await server.register(browseRoutes);
  await server.register(publishRoutes);
};

/**
 * Organization-specific marketplace routes
 * Mounted at /api/v1/organizations
 */
export const orgMarketplaceRoutes: FastifyPluginAsync = async (server) => {
  await server.register(subscriptionRoutes);
};

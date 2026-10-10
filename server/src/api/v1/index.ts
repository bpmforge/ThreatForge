/**
 * API v1 Routes Index
 *
 * Versioned API for external integrations and public Module API.
 * All routes are prefixed with /api/v1/
 */
import type { FastifyPluginAsync } from "fastify";
import { customCategoryRoutes } from "./custom-categories.js";
import { mitigationLibraryRoutes } from "./mitigation-libraries.js";
import { modelTemplateRoutes } from "./model-templates.js";
import { riskScoringRoutes } from "./risk-scoring.js";
import { integrationRoutes } from "./integrations/index.js";
import { infrastructureWebhookRoutes } from "./integrations/infrastructure/webhook.js";
import { marketplaceRoutes, orgMarketplaceRoutes } from "./marketplace.js";
import { dataApiRoutes } from "./data-api.js";
import { routeAuthz } from "../../middleware/authz-policy.js";

/**
 * Register all v1 API routes under /api/v1 prefix
 */
export const v1Routes: FastifyPluginAsync = async (server) => {
  // Register v1 routes with prefix
  await server.register(
    async (v1) => {
      // Customization Module
      await v1.register(customCategoryRoutes, { prefix: "/organizations" });
      await v1.register(mitigationLibraryRoutes, { prefix: "/organizations" });
      await v1.register(modelTemplateRoutes);
      await v1.register(riskScoringRoutes);

      // Integration Module
      await v1.register(integrationRoutes, { prefix: "/organizations" });
      await v1.register(infrastructureWebhookRoutes);

      // Collaboration Module (Marketplace)
      await v1.register(marketplaceRoutes, { prefix: "/marketplace" });
      await v1.register(orgMarketplaceRoutes, { prefix: "/organizations" });

      // Public Data API (for CISO integrations / GRC tools)
      await v1.register(dataApiRoutes);

      // v1 API info
      v1.get("/", routeAuthz("authenticated"), async () => {
        return {
          version: "v1",
          status: "stable",
          modules: {
            customization: {
              endpoints: [
                "/organizations/:orgId/custom-categories",
                "/organizations/:orgId/mitigation-libraries",
                "/model-templates",
                "/risk-frameworks",
              ],
            },
            integration: {
              endpoints: ["/organizations/:orgId/integrations"],
              supported: ["jira", "github", "slack", "custom_webhook"],
            },
            marketplace: {
              endpoints: ["/marketplace/libraries", "/marketplace/templates"],
            },
            data: {
              description:
                "Public data API for CISO integrations and GRC tools",
              endpoints: [
                "GET /threat-models",
                "GET /threat-models/:id/threats",
                "GET /threat-models/:id/compliance/:framework",
                "GET /threat-models/:id/risk-summary",
                "GET /compliance/frameworks",
              ],
              auth: "Bearer ftm_xxx token with read:models or read:threats scope",
            },
          },
        };
      });
    },
    { prefix: "/api/v1" },
  );
};

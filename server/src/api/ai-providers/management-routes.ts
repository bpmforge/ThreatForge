/**
 * AI Providers Management Routes
 *
 * Test, reorder, and usage routes for AI providers.
 */
import type { FastifyPluginAsync } from "fastify";
import type { AITestStatus } from "@prisma/client";
import { getPrisma } from "../../db.js";
import {
  getAuthUser,
  hasOrgAdminAccess,
  decryptApiKey,
  testProviderConnection,
} from "./helpers.js";
import {
  sendSuccess,
  sendNotFound,
  sendForbidden,
  sendBadRequest,
} from "../../utils/api-response.js";
import type { ReorderProvidersBody } from "./types.js";
import { routeAuthz } from "../../middleware/authz-policy.js";

const ORG_ADMIN = routeAuthz({ org: "ADMIN" });

export const managementRoutes: FastifyPluginAsync = async (server) => {
  const prisma = await getPrisma();

  /** Test connection to an AI provider */
  server.post<{ Params: { orgId: string; providerId: string } }>(
    "/api/organizations/:orgId/ai-providers/:providerId/test",
    ORG_ADMIN,
    async (request, reply) => {
      const authUser = getAuthUser(request);
      const { orgId, providerId } = request.params;

      const hasAccess = await hasOrgAdminAccess(authUser.id, orgId);
      if (!hasAccess) {
        return sendForbidden(
          reply,
          "Only organization owners and admins can test AI providers",
        );
      }

      const provider = await prisma.aIProvider.findFirst({
        where: { id: providerId, organizationId: orgId },
      });

      if (!provider) {
        return sendNotFound(reply, "Provider");
      }

      let apiKey: string | null = null;
      if (provider.encryptedApiKey) {
        apiKey = await decryptApiKey(orgId, provider.encryptedApiKey);
      }

      const result = await testProviderConnection(
        provider.type,
        apiKey,
        provider.baseUrl,
        provider.model,
      );

      const testStatus: AITestStatus = result.success ? "SUCCESS" : "FAILED";
      await prisma.aIProvider.update({
        where: { id: providerId },
        data: {
          lastTestedAt: new Date(),
          lastTestStatus: testStatus,
          lastTestError: result.error || null,
        },
      });

      return sendSuccess(reply, {
        success: result.success,
        error: result.error,
        latencyMs: result.latencyMs,
      });
    },
  );

  /** Reorder AI providers for fallback priority */
  server.put<{ Params: { orgId: string }; Body: ReorderProvidersBody }>(
    "/api/organizations/:orgId/ai-providers/reorder",
    ORG_ADMIN,
    async (request, reply) => {
      const authUser = getAuthUser(request);
      const { orgId } = request.params;
      const { providerIds } = request.body;

      const hasAccess = await hasOrgAdminAccess(authUser.id, orgId);
      if (!hasAccess) {
        return sendForbidden(
          reply,
          "Only organization owners and admins can reorder AI providers",
        );
      }

      if (!providerIds || !Array.isArray(providerIds)) {
        return sendBadRequest(reply, "providerIds array is required");
      }

      const providers = await prisma.aIProvider.findMany({
        where: { organizationId: orgId },
        select: { id: true },
      });
      const orgProviderIds = new Set(providers.map((p) => p.id));

      for (const id of providerIds) {
        if (!orgProviderIds.has(id)) {
          return sendBadRequest(
            reply,
            `Provider ${id} not found in organization`,
          );
        }
      }

      await Promise.all(
        providerIds.map((id, index) =>
          prisma.aIProvider.update({
            where: { id },
            data: { priority: index },
          }),
        ),
      );

      return sendSuccess(reply, { reordered: true });
    },
  );

  /** Get usage summary for all providers in an organization */
  server.get<{ Params: { orgId: string } }>(
    "/api/organizations/:orgId/ai-providers/usage",
    ORG_ADMIN,
    async (request, reply) => {
      const authUser = getAuthUser(request);
      const { orgId } = request.params;

      const hasAccess = await hasOrgAdminAccess(authUser.id, orgId);
      if (!hasAccess) {
        return sendForbidden(
          reply,
          "Only organization owners and admins can view AI usage",
        );
      }

      const providers = await prisma.aIProvider.findMany({
        where: { organizationId: orgId },
        select: {
          id: true,
          name: true,
          type: true,
          totalRequests: true,
          totalTokens: true,
          totalInputTokens: true,
          totalOutputTokens: true,
          estimatedCost: true,
          usageResetAt: true,
        },
      });

      const totals = providers.reduce(
        (acc, p) => ({
          totalRequests: acc.totalRequests + p.totalRequests,
          totalTokens: acc.totalTokens + p.totalTokens,
          totalInputTokens: acc.totalInputTokens + p.totalInputTokens,
          totalOutputTokens: acc.totalOutputTokens + p.totalOutputTokens,
          estimatedCost: acc.estimatedCost + p.estimatedCost,
        }),
        {
          totalRequests: 0,
          totalTokens: 0,
          totalInputTokens: 0,
          totalOutputTokens: 0,
          estimatedCost: 0,
        },
      );

      return sendSuccess(reply, {
        providers,
        totals,
      });
    },
  );
};

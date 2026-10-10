/**
 * AI Providers CRUD Routes
 *
 * List, Get, Create, Update, Delete routes for AI providers.
 */
import type { FastifyPluginAsync } from "fastify";
import { getPrisma } from "../../db.js";
import {
  getAuthUser,
  hasOrgAdminAccess,
  isOrgMember,
  encryptApiKey,
  syncDefaultProviderToLegacy,
} from "./helpers.js";
import {
  sendSuccess,
  sendNotFound,
  sendForbidden,
  sendBadRequest,
  sendInternalError,
} from "../../utils/api-response.js";
import type { CreateProviderBody, UpdateProviderBody } from "./types.js";
import { checkTenantBaseUrl } from "../../services/ai/private-host-policy.js";
import { routeAuthz } from "../../middleware/authz-policy.js";

const ORG_MEMBER = routeAuthz({ org: "VIEWER" });
const ORG_ADMIN = routeAuthz({ org: "ADMIN" });

export const crudRoutes: FastifyPluginAsync = async (server) => {
  const prisma = await getPrisma();

  /** Get all AI providers for an organization */
  server.get<{ Params: { orgId: string } }>(
    "/api/organizations/:orgId/ai-providers",
    ORG_MEMBER,
    async (request, reply) => {
      const authUser = getAuthUser(request);
      const { orgId } = request.params;

      const isMember = await isOrgMember(authUser.id, orgId);
      if (!isMember) {
        return sendNotFound(reply, "Organization");
      }

      const providers = await prisma.aIProvider.findMany({
        where: { organizationId: orgId },
        orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          name: true,
          type: true,
          isDefault: true,
          priority: true,
          isEnabled: true,
          authType: true,
          baseUrl: true,
          model: true,
          lastTestedAt: true,
          lastTestStatus: true,
          lastTestError: true,
          totalRequests: true,
          totalTokens: true,
          estimatedCost: true,
          usageResetAt: true,
          createdAt: true,
          updatedAt: true,
          encryptedApiKey: true,
        },
      });

      const providersWithKeyStatus = providers.map((p) => {
        const { encryptedApiKey, ...rest } = p;
        return {
          ...rest,
          hasApiKey: Boolean(encryptedApiKey),
        };
      });

      return sendSuccess(reply, { providers: providersWithKeyStatus });
    },
  );

  /** Create a new AI provider */
  server.post<{ Params: { orgId: string }; Body: CreateProviderBody }>(
    "/api/organizations/:orgId/ai-providers",
    ORG_ADMIN,
    async (request, reply) => {
      const authUser = getAuthUser(request);
      const { orgId } = request.params;
      const {
        name,
        type,
        authType,
        apiKey,
        baseUrl,
        model,
        isDefault,
        priority,
      } = request.body;

      const hasAccess = await hasOrgAdminAccess(authUser.id, orgId);
      if (!hasAccess) {
        return sendForbidden(
          reply,
          "Only organization owners and admins can manage AI providers",
        );
      }

      if (!name || !type) {
        return sendBadRequest(reply, "Name and type are required");
      }
      const badUrl = baseUrl ? await checkTenantBaseUrl(baseUrl) : null;
      if (badUrl) {
        return sendBadRequest(reply, badUrl);
      }

      let encryptedApiKey: string | null = null;
      if (apiKey) {
        encryptedApiKey = await encryptApiKey(orgId, apiKey);
        if (!encryptedApiKey) {
          return sendInternalError(reply, "Failed to encrypt API key");
        }
      }

      if (isDefault) {
        await prisma.aIProvider.updateMany({
          where: { organizationId: orgId, isDefault: true },
          data: { isDefault: false },
        });
      }

      const maxPriority = await prisma.aIProvider.aggregate({
        where: { organizationId: orgId },
        _max: { priority: true },
      });
      const newPriority = priority ?? (maxPriority._max.priority ?? 0) + 1;

      const provider = await prisma.aIProvider.create({
        data: {
          name,
          type,
          authType: authType || "API_KEY",
          encryptedApiKey,
          baseUrl,
          model,
          isDefault: isDefault || false,
          priority: newPriority,
          organizationId: orgId,
          createdById: authUser.id,
        },
        select: {
          id: true,
          name: true,
          type: true,
          isDefault: true,
          priority: true,
          isEnabled: true,
          authType: true,
          baseUrl: true,
          model: true,
          createdAt: true,
        },
      });
      // Sync default provider to legacy aiSettings
      await syncDefaultProviderToLegacy(orgId).catch(() => {});

      return sendSuccess(reply, {
        provider: { ...provider, hasApiKey: Boolean(encryptedApiKey) },
      });
    },
  );

  /** Get a single AI provider */
  server.get<{ Params: { orgId: string; providerId: string } }>(
    "/api/organizations/:orgId/ai-providers/:providerId",
    ORG_MEMBER,
    async (request, reply) => {
      const authUser = getAuthUser(request);
      const { orgId, providerId } = request.params;

      const isMember = await isOrgMember(authUser.id, orgId);
      if (!isMember) {
        return sendNotFound(reply, "Organization");
      }

      const provider = await prisma.aIProvider.findFirst({
        where: { id: providerId, organizationId: orgId },
        select: {
          id: true,
          name: true,
          type: true,
          isDefault: true,
          priority: true,
          isEnabled: true,
          authType: true,
          encryptedApiKey: true,
          baseUrl: true,
          model: true,
          lastTestedAt: true,
          lastTestStatus: true,
          lastTestError: true,
          totalRequests: true,
          totalTokens: true,
          totalInputTokens: true,
          totalOutputTokens: true,
          estimatedCost: true,
          usageResetAt: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (!provider) {
        return sendNotFound(reply, "Provider");
      }

      return sendSuccess(reply, {
        provider: {
          ...provider,
          hasApiKey: Boolean(provider.encryptedApiKey),
          encryptedApiKey: undefined,
        },
      });
    },
  );

  /** Update an AI provider */
  server.put<{
    Params: { orgId: string; providerId: string };
    Body: UpdateProviderBody;
  }>(
    "/api/organizations/:orgId/ai-providers/:providerId",
    ORG_ADMIN,
    async (request, reply) => {
      const authUser = getAuthUser(request);
      const { orgId, providerId } = request.params;
      const updates = request.body;

      const hasAccess = await hasOrgAdminAccess(authUser.id, orgId);
      if (!hasAccess) {
        return sendForbidden(
          reply,
          "Only organization owners and admins can manage AI providers",
        );
      }

      const existing = await prisma.aIProvider.findFirst({
        where: { id: providerId, organizationId: orgId },
      });

      if (!existing) {
        return sendNotFound(reply, "Provider");
      }

      if (updates.baseUrl) {
        const badUrl = await checkTenantBaseUrl(updates.baseUrl);
        if (badUrl) {
          return sendBadRequest(reply, badUrl);
        }
      }

      // A stored key is only ever sent to the URL it was saved with.
      let encryptedApiKey =
        updates.baseUrl !== undefined && updates.baseUrl !== existing.baseUrl
          ? null
          : existing.encryptedApiKey;
      if (updates.apiKey) {
        encryptedApiKey = await encryptApiKey(orgId, updates.apiKey);
        if (!encryptedApiKey) {
          return sendInternalError(reply, "Failed to encrypt API key");
        }
      }

      if (updates.isDefault) {
        await prisma.aIProvider.updateMany({
          where: {
            organizationId: orgId,
            isDefault: true,
            id: { not: providerId },
          },
          data: { isDefault: false },
        });
      }

      const provider = await prisma.aIProvider.update({
        where: { id: providerId },
        data: {
          name: updates.name,
          authType: updates.authType,
          encryptedApiKey,
          baseUrl: updates.baseUrl,
          model: updates.model,
          isDefault: updates.isDefault,
          isEnabled: updates.isEnabled,
          priority: updates.priority,
        },
        select: {
          id: true,
          name: true,
          type: true,
          isDefault: true,
          priority: true,
          isEnabled: true,
          authType: true,
          baseUrl: true,
          model: true,
          updatedAt: true,
        },
      });

      // Sync default provider to legacy aiSettings
      await syncDefaultProviderToLegacy(orgId).catch(() => {});

      return sendSuccess(reply, {
        provider: { ...provider, hasApiKey: Boolean(encryptedApiKey) },
      });
    },
  );

  /** Delete an AI provider */
  server.delete<{ Params: { orgId: string; providerId: string } }>(
    "/api/organizations/:orgId/ai-providers/:providerId",
    ORG_ADMIN,
    async (request, reply) => {
      const authUser = getAuthUser(request);
      const { orgId, providerId } = request.params;

      const hasAccess = await hasOrgAdminAccess(authUser.id, orgId);
      if (!hasAccess) {
        return sendForbidden(
          reply,
          "Only organization owners and admins can manage AI providers",
        );
      }

      const existing = await prisma.aIProvider.findFirst({
        where: { id: providerId, organizationId: orgId },
      });

      if (!existing) {
        return sendNotFound(reply, "Provider");
      }

      await prisma.aIProvider.delete({ where: { id: providerId } });

      // Sync after deletion
      await syncDefaultProviderToLegacy(orgId).catch(() => {});
      return sendSuccess(reply, { deleted: true });
    },
  );
};

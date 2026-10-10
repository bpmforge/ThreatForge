/**
 * CI/CD API - API Key Management Routes
 */
import type { FastifyPluginAsync } from "fastify";
import { getPrisma } from "../../../db.js";
import { CreateApiKeySchema } from "../schemas.js";
import {
  generateApiKey,
  hashApiKey,
  isOrgAdmin,
  isOrgMember,
  getAuthUser,
} from "../helpers.js";
import {
  sendSuccess,
  sendCreated,
  sendForbidden,
  sendNotFound,
  sendBadRequest,
} from "../../../utils/api-response.js";
import { routeAuthz } from "../../../middleware/authz-policy.js";

const ORG_VIEWER = routeAuthz({ org: "VIEWER" });
const ORG_ADMIN = routeAuthz({ org: "ADMIN" });

export const apiKeyRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * POST /api/ci/api-keys
   * Create a new CI API key for an organization
   */
  fastify.post<{ Querystring: { organizationId: string } }>(
    "/api/ci/api-keys",
    ORG_ADMIN,
    async (request, reply) => {
      const user = getAuthUser(request);
      const { organizationId } = request.query;
      const prisma = await getPrisma();

      if (!(await isOrgAdmin(user.id, organizationId))) {
        return sendForbidden(reply, "Admin access required");
      }

      const parseResult = CreateApiKeySchema.safeParse(request.body);
      if (!parseResult.success) {
        return sendBadRequest(reply, "Invalid request", {
          details: parseResult.error.issues,
        });
      }

      const data = parseResult.data;
      const { key, prefix } = generateApiKey();
      const keyHash = hashApiKey(key);

      const expiresAt = data.expiresInDays
        ? new Date(Date.now() + data.expiresInDays * 24 * 60 * 60 * 1000)
        : null;

      const apiKey = await prisma.cIApiKey.create({
        data: {
          name: data.name,
          keyHash,
          keyPrefix: prefix,
          organizationId,
          scopes: JSON.stringify(data.scopes),
          expiresAt,
          createdById: user.id,
        },
      });

      return sendCreated(reply, {
        id: apiKey.id,
        name: apiKey.name,
        key,
        keyPrefix: apiKey.keyPrefix,
        scopes: data.scopes,
        expiresAt: apiKey.expiresAt,
        createdAt: apiKey.createdAt,
        warning: "Save this API key securely. It cannot be retrieved again.",
      });
    },
  );

  /**
   * GET /api/ci/api-keys
   * List API keys for an organization
   */
  fastify.get<{ Querystring: { organizationId: string } }>(
    "/api/ci/api-keys",
    ORG_VIEWER,
    async (request, reply) => {
      const user = getAuthUser(request);
      const { organizationId } = request.query;
      const prisma = await getPrisma();

      if (!(await isOrgMember(user.id, organizationId))) {
        return sendForbidden(reply, "Access denied");
      }

      const apiKeys = await prisma.cIApiKey.findMany({
        where: { organizationId },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          keyPrefix: true,
          scopes: true,
          isActive: true,
          lastUsedAt: true,
          usageCount: true,
          expiresAt: true,
          createdAt: true,
        },
      });

      return sendSuccess(reply, {
        data: apiKeys.map((k: (typeof apiKeys)[number]) => ({
          ...k,
          scopes: JSON.parse(k.scopes),
        })),
      });
    },
  );

  /**
   * DELETE /api/ci/api-keys/:keyId
   * Revoke an API key
   */
  fastify.delete<{
    Params: { keyId: string };
    Querystring: { organizationId: string };
  }>("/api/ci/api-keys/:keyId", ORG_ADMIN, async (request, reply) => {
    const user = getAuthUser(request);
    const { keyId } = request.params;
    const { organizationId } = request.query;
    const prisma = await getPrisma();

    if (!(await isOrgAdmin(user.id, organizationId))) {
      return sendForbidden(reply, "Admin access required");
    }

    const apiKey = await prisma.cIApiKey.findFirst({
      where: { id: keyId, organizationId },
    });

    if (!apiKey) {
      return sendNotFound(reply, "API key");
    }

    await prisma.cIApiKey.update({
      where: { id: keyId },
      data: { isActive: false },
    });

    return sendSuccess(reply, { success: true, message: "API key revoked" });
  });
};

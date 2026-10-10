/**
 * SCIM Token Management API
 *
 * Org OWNER/ADMIN endpoints for managing per-org SCIM bearer tokens.
 */
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import { randomBytes, createHash } from "crypto";
import { getPrisma } from "../db.js";
import { getAuthUser } from "../utils/auth-helpers.js";
import { sendForbidden, sendNotFound } from "../utils/api-response.js";
import { routeAuthz } from "../middleware/authz-policy.js";

const ORG_ADMIN = routeAuthz({ org: "ADMIN" });

function generateScimToken() {
  const token = `scim_${randomBytes(32).toString("base64url")}`;
  const hash = createHash("sha256").update(token).digest("hex");
  const prefix = token.substring(0, 12);
  return { token, hash, prefix };
}

async function assertOrgRole(
  request: FastifyRequest,
  reply: FastifyReply,
  orgId: string,
  roles: string[],
): Promise<boolean> {
  const prisma = await getPrisma();
  const user = getAuthUser(request);
  const membership = await prisma.membership.findFirst({
    where: { userId: user.id, organizationId: orgId, status: "ACTIVE" },
    select: { role: true },
  });
  if (!membership || !roles.includes(membership.role)) {
    sendForbidden(reply, `Must be org ${roles.join(" or ")}`);
    return false;
  }
  return true;
}

export const scimTokenRoutes: FastifyPluginAsync = async (server) => {
  /** GET /api/organizations/:orgId/scim — current token status + endpoint info */
  server.get<{ Params: { orgId: string } }>(
    "/api/organizations/:orgId/scim",
    ORG_ADMIN,
    async (request, reply) => {
      const { orgId } = request.params;
      if (!(await assertOrgRole(request, reply, orgId, ["OWNER", "ADMIN"])))
        return;

      const prisma = await getPrisma();
      const token = await prisma.scimToken.findFirst({
        where: { organizationId: orgId, revokedAt: null },
        select: {
          id: true,
          tokenPrefix: true,
          description: true,
          lastUsedAt: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      });

      const baseUrl =
        process.env.NEXTAUTH_URL ||
        process.env.APP_URL ||
        "https://your-domain.com";

      return {
        enabled: !!token,
        token: token
          ? {
              id: token.id,
              prefix: token.tokenPrefix,
              description: token.description,
              lastUsedAt: token.lastUsedAt,
              createdAt: token.createdAt,
            }
          : null,
        endpoints: {
          base: `${baseUrl}/api/scim/v2`,
          users: `${baseUrl}/api/scim/v2/Users`,
          groups: `${baseUrl}/api/scim/v2/Groups`,
          serviceProviderConfig: `${baseUrl}/api/scim/v2/ServiceProviderConfig`,
        },
      };
    },
  );

  /** POST /api/organizations/:orgId/scim/rotate — generate new token (revokes existing) */
  server.post<{
    Params: { orgId: string };
    Body: { description?: string };
  }>(
    "/api/organizations/:orgId/scim/rotate",
    ORG_ADMIN,
    async (request, reply) => {
      const { orgId } = request.params;
      // A SCIM token can suspend any member, so only owners may issue or revoke one.
      if (!(await assertOrgRole(request, reply, orgId, ["OWNER"]))) return;

      const prisma = await getPrisma();

      await prisma.scimToken.updateMany({
        where: { organizationId: orgId, revokedAt: null },
        data: { revokedAt: new Date() },
      });

      const { token, hash, prefix } = generateScimToken();
      await prisma.scimToken.create({
        data: {
          organizationId: orgId,
          tokenHash: hash,
          tokenPrefix: prefix,
          description: request.body?.description ?? null,
        },
      });

      reply.status(201);
      return {
        token,
        prefix,
        message:
          "Save this token — it will not be shown again. Update your IdP before rotating.",
      };
    },
  );

  /** DELETE /api/organizations/:orgId/scim/token — revoke active token */
  server.delete<{ Params: { orgId: string } }>(
    "/api/organizations/:orgId/scim/token",
    ORG_ADMIN,
    async (request, reply) => {
      const { orgId } = request.params;
      // A SCIM token can suspend any member, so only owners may issue or revoke one.
      if (!(await assertOrgRole(request, reply, orgId, ["OWNER"]))) return;

      const prisma = await getPrisma();
      const result = await prisma.scimToken.updateMany({
        where: { organizationId: orgId, revokedAt: null },
        data: { revokedAt: new Date() },
      });

      if (result.count === 0) {
        return sendNotFound(reply, "No active SCIM token found");
      }

      reply.status(204).send();
    },
  );
};

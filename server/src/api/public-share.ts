/**
 * Public Share API
 *
 * Generates time-limited, read-only sharing links for threat models.
 * No authentication required to view — just the share token.
 *
 * Usage:
 *   POST /api/threat-models/:id/share — Create share link (auth required)
 *   GET /api/public/share/:token — View shared model (no auth)
 *   DELETE /api/threat-models/:id/share/:shareId — Revoke share (auth required)
 */
import type { FastifyPluginAsync } from "fastify";
import { randomBytes, createHash } from "crypto";
import { getPrisma } from "../db.js";
import { getAuthUser } from "../utils/auth-helpers.js";
import {
  authorizeMemberModelAction,
  canAccessThreatModel,
} from "../api/threat-models/helpers.js";
import { TOKEN_PREFIX as GUEST_TOKEN_PREFIX } from "../services/guest-access/guest-access-service.js";
import {
  sendSuccess,
  sendCreated,
  sendNotFound,
  sendNoContent,
  sendForbidden,
} from "../utils/api-response.js";
import { logAudit } from "../services/audit.js";
import { routeAuthz } from "../middleware/authz-policy.js";

/**
 * Public share links are the ModelAccess rows with no user and a hashed
 * (unprefixed) token. Guest grants carry a user or a `gst_` token and are
 * managed through guest access, never through these routes.
 */
const PUBLIC_SHARE_ROWS = {
  userId: null,
  NOT: { accessToken: { startsWith: GUEST_TOKEN_PREFIX } },
};

const SHARE_MANAGER = routeAuthz({
  handler: "org member (not a guest) with edit on the model",
});

/** Generate a URL-safe share token */
function generateShareToken(): string {
  return "ftm-share-" + randomBytes(24).toString("base64url");
}

export const publicShareRoutes: FastifyPluginAsync = async (server) => {
  const prisma = await getPrisma();

  /**
   * POST /api/threat-models/:id/share
   * Create a public share link. Auth required.
   */
  server.post<{
    Params: { id: string };
    Body: { expiresInDays?: number; label?: string };
  }>("/api/threat-models/:id/share", SHARE_MANAGER, async (request, reply) => {
    const user = getAuthUser(request);
    const { id } = request.params;
    const { expiresInDays = 7, label } = request.body || {};

    // Guests cannot re-share: a public link widens who can read the model.
    if (!(await authorizeMemberModelAction(reply, user.id, id, "edit")))
      return reply;

    const model = await prisma.threatModel.findUnique({
      where: { id },
      include: {
        project: {
          select: {
            organizationId: true,
            organization: { select: { allowGuestAccess: true } },
          },
        },
      },
    });
    if (!model) return sendNotFound(reply, "Threat model");
    if (!model.project.organization.allowGuestAccess) {
      return sendForbidden(
        reply,
        "This organization does not allow guest access",
      );
    }

    const token = generateShareToken();
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const expiresAt = new Date(
      Date.now() + Math.min(expiresInDays, 90) * 24 * 60 * 60 * 1000,
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const share = await (prisma.modelAccess.create as any)({
      data: {
        threatModelId: id,
        organizationId: model.project.organizationId,
        accessToken: tokenHash,
        role: "VIEWER",
        canExport: false,
        expiresAt,
        grantedById: user.id,
        guestEmail: label || "Public Share Link",
      },
    });

    Promise.resolve(
      logAudit({
        action: "SHARE",
        resourceType: "THREAT_MODEL",
        resourceId: id,
        resourceName: label || "Public Share",
        userId: user.id,
        userEmail: user.email || "unknown",
        organizationId: "",
        metadata: { shareId: share.id, expiresAt: expiresAt.toISOString() },
      }),
    ).catch(() => {});

    return sendCreated(reply, {
      shareId: share.id,
      token,
      url: `/public/share/${token}`,
      expiresAt: expiresAt.toISOString(),
      label: label || "Public Share Link",
    });
  });

  // Note: GET /api/public/share/:token is registered in index.ts as a public route (no auth)

  /**
   * GET /api/threat-models/:id/shares
   * List active share links for a model. Auth required.
   */
  server.get<{ Params: { id: string } }>(
    "/api/threat-models/:id/shares",
    routeAuthz({ model: "view" }),
    async (request, reply) => {
      const user = getAuthUser(request);
      const { id } = request.params;

      const hasAccess = await canAccessThreatModel(user.id, id);
      if (!hasAccess) {
        return sendNotFound(reply, "Threat model");
      }

      const shares = await prisma.modelAccess.findMany({
        where: {
          threatModelId: id,
          ...PUBLIC_SHARE_ROWS,
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
        select: {
          id: true,
          guestEmail: true,
          createdAt: true,
          expiresAt: true,
          lastAccessedAt: true,
          accessCount: true,
          grantedById: true,
        },
        orderBy: { createdAt: "desc" },
      });

      return sendSuccess(reply, {
        shares: shares.map((s) => ({
          id: s.id,
          label: s.guestEmail,
          createdAt: s.createdAt,
          expiresAt: s.expiresAt,
          lastAccessedAt: s.lastAccessedAt,
          accessCount: s.accessCount,
          grantedById: s.grantedById,
        })),
      });
    },
  );

  /**
   * DELETE /api/threat-models/:id/share/:shareId
   * Revoke a share link. Auth required.
   */
  server.delete<{ Params: { id: string; shareId: string } }>(
    "/api/threat-models/:id/share/:shareId",
    SHARE_MANAGER,
    async (request, reply) => {
      const user = getAuthUser(request);
      const { id, shareId } = request.params;

      if (!(await authorizeMemberModelAction(reply, user.id, id, "edit")))
        return reply;

      await prisma.modelAccess.deleteMany({
        where: { id: shareId, threatModelId: id, ...PUBLIC_SHARE_ROWS },
      });

      return sendNoContent(reply);
    },
  );
};

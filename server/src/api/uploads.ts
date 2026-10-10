/**
 * File Uploads API
 *
 * Handles avatar and logo uploads for users and organizations.
 * Images are stored as base64 data URLs for simplicity.
 * For production, consider using cloud storage (S3, GCS, etc.)
 */
import type { FastifyPluginAsync } from "fastify";
import { getPrisma } from "../db.js";
import { getAuthUser } from "../utils/auth-helpers.js";
import { checkOrganizationAccess } from "../services/access-control/access-control-service.js";
import { logAudit } from "../services/audit.js";
import { isValidLogoDataUrl } from "../services/reports/branding.js";
import {
  sendSuccess,
  sendBadRequest,
  sendForbidden,
  sendNotFound,
} from "../utils/api-response.js";
import { routeAuthz } from "../middleware/authz-policy.js";

// =============================================================================
// Constants
// =============================================================================

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
];

// =============================================================================
// Types
// =============================================================================

interface UploadAvatarBody {
  image: string; // Base64 data URL: "data:image/png;base64,..."
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Validate and parse a base64 data URL
 */
function validateImageDataUrl(
  dataUrl: string,
): { mimeType: string; data: string } | null {
  const match = dataUrl.match(/^data:(image\/[a-z+]+);base64,(.+)$/i);
  if (!match) return null;

  const [, mimeType, data] = match;

  // Check mime type
  if (!ALLOWED_MIME_TYPES.includes(mimeType.toLowerCase())) {
    return null;
  }

  // Check size (base64 is ~33% larger than binary)
  const estimatedSize = (data.length * 3) / 4;
  if (estimatedSize > MAX_FILE_SIZE) {
    return null;
  }

  return { mimeType: mimeType.toLowerCase(), data };
}

/**
 * Generate a placeholder avatar with initials
 */
function generateInitialsAvatar(name: string, size = 128): string {
  const initials = name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  // Generate a consistent color based on the name
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = hash % 360;
  const bgColor = `hsl(${hue}, 65%, 55%)`;

  // Create SVG
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <rect width="100%" height="100%" fill="${bgColor}"/>
      <text x="50%" y="50%" dominant-baseline="central" text-anchor="middle"
            font-family="system-ui, sans-serif" font-size="${size * 0.4}" font-weight="600" fill="white">
        ${initials}
      </text>
    </svg>
  `.trim();

  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

// =============================================================================
// Routes
// =============================================================================

export const uploadRoutes: FastifyPluginAsync = async (server) => {
  /**
   * POST /api/users/me/avatar
   * Upload user avatar
   */
  server.post<{ Body: UploadAvatarBody }>(
    "/api/users/me/avatar",
    routeAuthz("authenticated"),
    async (request, reply) => {
      const authUser = getAuthUser(request);
      const { image } = request.body;

      if (!image) {
        return sendBadRequest(reply, "Image is required");
      }

      const parsed = validateImageDataUrl(image);
      if (!parsed) {
        return sendBadRequest(
          reply,
          "Invalid image. Must be JPEG, PNG, GIF, or WebP under 2MB.",
        );
      }

      const prisma = await getPrisma();

      await prisma.user.update({
        where: { id: authUser.id },
        data: { avatarUrl: image },
      });

      // Audit log
      await logAudit({
        action: "UPDATE",
        scope: "SYSTEM",
        resourceType: "USER",
        resourceId: authUser.id,
        userId: authUser.id,
        userEmail: authUser.email || "unknown",
        metadata: { field: "avatar" },
      });

      return sendSuccess(reply, { avatarUrl: image });
    },
  );

  /**
   * DELETE /api/users/me/avatar
   * Remove user avatar (reverts to default)
   */
  server.delete(
    "/api/users/me/avatar",
    routeAuthz("authenticated"),
    async (request, reply) => {
      const authUser = getAuthUser(request);

      const prisma = await getPrisma();

      const user = await prisma.user.update({
        where: { id: authUser.id },
        data: { avatarUrl: null },
        select: { name: true },
      });

      // Generate default avatar
      const defaultAvatar = generateInitialsAvatar(user.name || "User");

      // Audit log
      await logAudit({
        action: "UPDATE",
        scope: "SYSTEM",
        resourceType: "USER",
        resourceId: authUser.id,
        userId: authUser.id,
        userEmail: authUser.email || "unknown",
        metadata: { field: "avatar", action: "removed" },
      });

      return sendSuccess(reply, { avatarUrl: defaultAvatar });
    },
  );

  /**
   * GET /api/users/me/avatar
   * Get current user's avatar URL
   */
  server.get(
    "/api/users/me/avatar",
    routeAuthz("authenticated"),
    async (request, reply) => {
      const authUser = getAuthUser(request);

      const prisma = await getPrisma();
      const user = await prisma.user.findUnique({
        where: { id: authUser.id },
        select: { avatarUrl: true, image: true, name: true },
      });

      if (!user) {
        return sendNotFound(reply, "User");
      }

      // Priority: avatarUrl > image > generated initials
      const avatarUrl =
        user.avatarUrl ||
        user.image ||
        generateInitialsAvatar(user.name || "User");

      return sendSuccess(reply, { avatarUrl });
    },
  );

  /**
   * POST /api/organizations/:orgId/logo
   * Upload organization logo
   */
  server.post<{ Params: { orgId: string }; Body: UploadAvatarBody }>(
    "/api/organizations/:orgId/logo",
    routeAuthz({ org: "ADMIN" }),
    async (request, reply) => {
      const authUser = getAuthUser(request);
      const { orgId } = request.params;
      const { image } = request.body;

      // Check org access - only owners/admins can upload logo
      const access = await checkOrganizationAccess(authUser.id, orgId);
      if (
        !access.hasAccess ||
        !access.role ||
        !["OWNER", "ADMIN"].includes(access.role)
      ) {
        return sendForbidden(
          reply,
          "Only admins and owners can update the organization logo",
        );
      }

      if (!image) {
        return sendBadRequest(reply, "Image is required");
      }

      const parsed = validateImageDataUrl(image);
      // Org logos are embedded in DOCX/PDF reports: PNG/JPEG only.
      if (!parsed || !isValidLogoDataUrl(image)) {
        return sendBadRequest(
          reply,
          "Invalid image. Organization logo must be PNG or JPEG under 2MB.",
        );
      }

      const prisma = await getPrisma();

      await prisma.organization.update({
        where: { id: orgId },
        data: { logoUrl: image },
      });

      // Audit log
      await logAudit({
        action: "UPDATE",
        scope: "ORGANIZATION",
        resourceType: "ORGANIZATION",
        resourceId: orgId,
        organizationId: orgId,
        userId: authUser.id,
        userEmail: authUser.email || "unknown",
        metadata: { field: "logo" },
      });

      return sendSuccess(reply, { logoUrl: image });
    },
  );

  /**
   * DELETE /api/organizations/:orgId/logo
   * Remove organization logo
   */
  server.delete<{ Params: { orgId: string } }>(
    "/api/organizations/:orgId/logo",
    routeAuthz({ org: "ADMIN" }),
    async (request, reply) => {
      const authUser = getAuthUser(request);
      const { orgId } = request.params;

      // Check org access - only owners/admins can remove logo
      const access = await checkOrganizationAccess(authUser.id, orgId);
      if (
        !access.hasAccess ||
        !access.role ||
        !["OWNER", "ADMIN"].includes(access.role)
      ) {
        return sendForbidden(
          reply,
          "Only admins and owners can update the organization logo",
        );
      }

      const prisma = await getPrisma();

      const org = await prisma.organization.update({
        where: { id: orgId },
        data: { logoUrl: null },
        select: { name: true },
      });

      // Generate default logo
      const defaultLogo = generateInitialsAvatar(org.name || "Org");

      // Audit log
      await logAudit({
        action: "UPDATE",
        scope: "ORGANIZATION",
        resourceType: "ORGANIZATION",
        resourceId: orgId,
        organizationId: orgId,
        userId: authUser.id,
        userEmail: authUser.email || "unknown",
        metadata: { field: "logo", action: "removed" },
      });

      return sendSuccess(reply, { logoUrl: defaultLogo });
    },
  );

  /**
   * GET /api/organizations/:orgId/logo
   * Get organization logo URL
   */
  server.get<{ Params: { orgId: string } }>(
    "/api/organizations/:orgId/logo",
    routeAuthz({ org: "VIEWER" }),
    async (request, reply) => {
      const authUser = getAuthUser(request);
      const { orgId } = request.params;

      // Check org access
      const access = await checkOrganizationAccess(authUser.id, orgId);
      if (!access.hasAccess) {
        return sendForbidden(reply);
      }

      const prisma = await getPrisma();
      const org = await prisma.organization.findUnique({
        where: { id: orgId },
        select: { logoUrl: true, name: true },
      });

      if (!org) {
        return sendNotFound(reply, "Organization");
      }

      const logoUrl = org.logoUrl || generateInitialsAvatar(org.name || "Org");

      return sendSuccess(reply, { logoUrl });
    },
  );

  /**
   * GET /api/users/:userId/avatar
   * A user's avatar, for themselves and anyone sharing an ACTIVE org with them.
   * Anyone else gets 404, so the route cannot be used to probe user ids.
   */
  server.get<{ Params: { userId: string } }>(
    "/api/users/:userId/avatar",
    routeAuthz({
      handler: "the user themselves, or anyone sharing an ACTIVE org with them",
    }),
    async (request, reply) => {
      const authUser = getAuthUser(request);
      const { userId } = request.params;

      const prisma = await getPrisma();
      if (userId !== authUser.id) {
        // nosemgrep: tf-membership-query-missing-status -- caller's ACTIVE status is required in the nested filter
        const shared = await prisma.membership.findFirst({
          where: {
            userId,
            organization: {
              memberships: { some: { userId: authUser.id, status: "ACTIVE" } },
            },
          },
          select: { id: true },
        });
        if (!shared) return sendNotFound(reply, "User");
      }
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { avatarUrl: true, image: true, name: true },
      });

      if (!user) {
        return sendNotFound(reply, "User");
      }

      const avatarUrl =
        user.avatarUrl ||
        user.image ||
        generateInitialsAvatar(user.name || "User");

      return sendSuccess(reply, { avatarUrl });
    },
  );
};

// Export helper for generating avatars

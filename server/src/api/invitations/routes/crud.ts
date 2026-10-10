/**
 * Invitations API - CRUD Routes
 *
 * Create invitations, list pending invitations, revoke invitations.
 */
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { getPrisma } from "../../../db.js";
import {
  createInvitation,
  getPendingInvitations,
  revokeInvitation,
} from "../../../services/invitation/invitation-service.js";
import { dispatchWebhookEvent } from "../../../services/webhooks/webhook-dispatcher.js";
import {
  sendSuccess,
  sendCreated,
  sendBadRequest,
  sendForbidden,
  sendConflict,
} from "../../../utils/api-response.js";
import { getAuthUser } from "../../../utils/auth-helpers.js";

// Request schemas
const SendInvitationSchema = z.object({
  email: z.string().email("Valid email required"),
  role: z.enum(["ADMIN", "EDITOR", "VIEWER"]),
  /** Ignored: members always join by accepting an invitation. Kept so older clients still validate. */
  addDirectly: z.boolean().optional(),
});

export const crudRoutes: FastifyPluginAsync = async (server) => {
  /**
   * POST /api/organizations/:organizationId/invitations
   * Send an invitation to join an organization.
   * Requires OWNER or ADMIN role.
   */
  server.post<{
    Params: { organizationId: string };
    Body: z.infer<typeof SendInvitationSchema>;
  }>(
    "/api/organizations/:organizationId/invitations",
    {
      config: { authz: { org: "ADMIN" } },
      schema: {
        description: "Send an invitation to join an organization",
        tags: ["Organizations"],
        params: {
          type: "object",
          properties: {
            organizationId: { type: "string" },
          },
          required: ["organizationId"],
        },
        body: {
          type: "object",
          properties: {
            email: { type: "string", format: "email" },
            role: { type: "string", enum: ["ADMIN", "EDITOR", "VIEWER"] },
          },
          required: ["email", "role"],
        },
      },
    },
    async (request, reply) => {
      const user = getAuthUser(request);

      const { organizationId } = request.params;

      // Validate body
      const parseResult = SendInvitationSchema.safeParse(request.body);
      if (!parseResult.success) {
        return sendBadRequest(reply, "Validation failed");
      }

      const { email, role } = parseResult.data;
      const prisma = await getPrisma();
      const normalizedEmail = email.toLowerCase().trim();

      // Check user's role in organization
      const membership = await prisma.membership.findFirst({
        where: { userId: user.id, organizationId, status: "ACTIVE" },
      });

      if (
        !membership ||
        (membership.role !== "OWNER" && membership.role !== "ADMIN")
      ) {
        return sendForbidden(
          reply,
          "Only owners and admins can send invitations",
        );
      }

      // Admins cannot invite other admins (only owners can)
      if (membership.role === "ADMIN" && role === "ADMIN") {
        return sendForbidden(
          reply,
          "Admins can only invite editors and viewers",
        );
      }

      const existingUser = await prisma.user.findUnique({
        where: { email: normalizedEmail },
        select: { id: true },
      });

      // The service refuses ACTIVE and SUSPENDED members (409): an invite
      // never adds anyone directly or undoes a suspension.
      const result = await createInvitation({
        organizationId,
        email: normalizedEmail,
        role: role as "ADMIN" | "EDITOR" | "VIEWER",
        invitedById: user.id,
        inviterEmail: user.email || "unknown",
      });

      if (!result.success) {
        if (result.alreadyMember) {
          return sendConflict(reply, result.error || "Already a member");
        }
        return sendBadRequest(reply, result.error || "Operation failed");
      }

      // Build invitation link for manual sharing (useful when email is not configured)
      const appUrl =
        process.env.APP_URL ||
        process.env.NEXTAUTH_URL ||
        "https://localhost:3000";
      const inviteLink = `${appUrl}/invitations/${result.invitationToken}`;

      // Fire webhook event
      dispatchWebhookEvent(organizationId, "member.invited", {
        email: normalizedEmail,
        role,
        invitedBy: user.id,
      });

      return sendCreated(reply, {
        success: true,
        invitationId: result.invitationId,
        message: result.existingInvitation
          ? "Invitation has been resent"
          : "Invitation sent successfully",
        // Include invite link so admin can share manually if email isn't configured
        inviteLink,
        userExists: !!existingUser,
        note: existingUser
          ? "User is registered. They can accept from their pending invitations, or use the invite link."
          : "User is not registered yet. Share the invite link with them.",
      });
    },
  );

  /**
   * GET /api/invitations
   * List pending invitations for the current user.
   */
  server.get(
    "/api/invitations",
    {
      config: { authz: "authenticated" },
      schema: {
        description: "List pending invitations for the current user",
        tags: ["Organizations"],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = getAuthUser(request);

      const invitations = await getPendingInvitations(user.id);
      return sendSuccess(reply, invitations);
    },
  );

  /**
   * DELETE /api/organizations/:organizationId/invitations/:invitationId
   * Revoke a pending invitation.
   * Requires OWNER or ADMIN role.
   */
  server.delete<{
    Params: { organizationId: string; invitationId: string };
  }>(
    "/api/organizations/:organizationId/invitations/:invitationId",
    {
      config: {
        authz: {
          handler:
            "revokeInvitation: caller must be ACTIVE OWNER/ADMIN of the invitation's own org (URL organizationId is not used)",
        },
      },
      schema: {
        description: "Revoke a pending invitation",
        tags: ["Organizations"],
        params: {
          type: "object",
          properties: {
            organizationId: { type: "string" },
            invitationId: { type: "string" },
          },
          required: ["organizationId", "invitationId"],
        },
      },
    },
    async (request, reply) => {
      const user = getAuthUser(request);

      const { invitationId } = request.params;

      const result = await revokeInvitation(
        invitationId,
        user.id,
        user.email || "unknown",
      );

      if (!result.success) {
        if (
          result.error?.includes("permission") ||
          result.error?.includes("Only owners")
        ) {
          return sendForbidden(reply, result.error || "Access denied");
        }
        return sendBadRequest(reply, result.error || "Operation failed");
      }

      return sendSuccess(reply, { success: true });
    },
  );

  /**
   * GET /api/organizations/:organizationId/invitations
   * List pending invitations for an organization.
   * Requires OWNER or ADMIN role.
   */
  server.get<{
    Params: { organizationId: string };
  }>(
    "/api/organizations/:organizationId/invitations",
    {
      config: { authz: { org: "ADMIN" } },
      schema: {
        description: "List pending invitations for an organization",
        tags: ["Organizations"],
        params: {
          type: "object",
          properties: {
            organizationId: { type: "string" },
          },
          required: ["organizationId"],
        },
      },
    },
    async (request, reply) => {
      const user = getAuthUser(request);

      const { organizationId } = request.params;
      const prisma = await getPrisma();

      // Check user's role in organization
      const membership = await prisma.membership.findFirst({
        where: { userId: user.id, organizationId, status: "ACTIVE" },
      });

      if (
        !membership ||
        (membership.role !== "OWNER" && membership.role !== "ADMIN")
      ) {
        return sendForbidden(
          reply,
          "Only owners and admins can view pending invitations",
        );
      }

      // Fetch pending invitations
      const pendingInvitations = await prisma.membership.findMany({
        where: {
          organizationId,
          status: "PENDING",
          invitationExpiresAt: { gt: new Date() },
        },
        include: {
          user: { select: { email: true } },
          invitedBy: { select: { id: true, name: true, email: true } },
        },
        orderBy: { invitedAt: "desc" },
      });

      return sendSuccess(
        reply,
        pendingInvitations.map((inv) => ({
          id: inv.id,
          email: inv.user.email,
          role: inv.role,
          invitedAt: inv.invitedAt?.toISOString(),
          expiresAt: inv.invitationExpiresAt?.toISOString(),
          invitedBy: inv.invitedBy,
        })),
      );
    },
  );
};

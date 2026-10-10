/**
 * Invitations API - Action Routes
 *
 * Accept and decline invitations.
 */
import type { FastifyPluginAsync } from "fastify";
import {
  acceptInvitation,
  declineInvitation,
  isValidTokenFormat,
} from "../../../services/invitation/invitation-service.js";
import { dispatchWebhookEvent } from "../../../services/webhooks/webhook-dispatcher.js";
import { sendSuccess, sendBadRequest } from "../../../utils/api-response.js";
import { getAuthUser } from "../../../utils/auth-helpers.js";

interface InvitationParams {
  token: string;
}

export const actionRoutes: FastifyPluginAsync = async (server) => {
  /**
   * POST /api/invitations/:token/accept
   * Accept an invitation.
   */
  server.post<{
    Params: InvitationParams;
  }>(
    "/api/invitations/:token/accept",
    {
      config: {
        authz: {
          handler:
            "acceptInvitation: the token's invitation must be PENDING and addressed to the caller's email",
        },
      },
      schema: {
        description: "Accept an invitation to join an organization",
        tags: ["Organizations"],
        params: {
          type: "object",
          properties: {
            token: { type: "string" },
          },
          required: ["token"],
        },
      },
    },
    async (request, reply) => {
      const user = getAuthUser(request);

      const { token } = request.params;

      if (!isValidTokenFormat(token)) {
        return reply
          .status(400)
          .send({ error: "Invalid invitation token format" });
      }

      const result = await acceptInvitation(
        token,
        user.id,
        user.email || "unknown",
      );

      if (!result.success) {
        return sendBadRequest(reply, result.error || "Operation failed");
      }

      // Fire webhook event
      if (result.organizationId) {
        dispatchWebhookEvent(result.organizationId, "member.joined", {
          userId: user.id,
          email: user.email,
          role: result.role,
        });
      }

      return sendSuccess(reply, {
        success: true,
        organizationId: result.organizationId,
        organizationName: result.organizationName,
        role: result.role,
      });
    },
  );

  /**
   * POST /api/invitations/:token/decline
   * Decline an invitation.
   */
  server.post<{
    Params: InvitationParams;
  }>(
    "/api/invitations/:token/decline",
    {
      config: {
        authz: {
          handler:
            "declineInvitation: the token's invitation must be PENDING and addressed to the caller's email",
        },
      },
      schema: {
        description: "Decline an invitation to join an organization",
        tags: ["Organizations"],
        params: {
          type: "object",
          properties: {
            token: { type: "string" },
          },
          required: ["token"],
        },
      },
    },
    async (request, reply) => {
      const user = getAuthUser(request);

      const { token } = request.params;

      if (!isValidTokenFormat(token)) {
        return sendBadRequest(reply, "Invalid invitation token format");
      }

      const result = await declineInvitation(
        token,
        user.id,
        user.email || "unknown",
      );

      if (!result.success) {
        return sendBadRequest(reply, result.error || "Operation failed");
      }

      return sendSuccess(reply, { success: true });
    },
  );
};

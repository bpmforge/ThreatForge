/**
 * Members API Routes
 *
 * Handles organization member management endpoints:
 * - List members
 * - Update member role
 * - Remove member
 * - Leave organization
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import {
  getOrganizationMembers,
  updateMemberRole,
  removeMember,
  leaveOrganization,
  suspendMember,
  unsuspendMember,
} from "../services/membership/membership-service.js";
import { dispatchWebhookEvent } from "../services/webhooks/webhook-dispatcher.js";
import {
  sendSuccess,
  sendBadRequest,
  sendForbidden,
  sendNotFound,
} from "../utils/api-response.js";
import { getAuthUser } from "../utils/auth-helpers.js";

// Request schemas
const UpdateRoleSchema = z.object({
  role: z.enum(["ADMIN", "EDITOR", "VIEWER"]),
});

const ListMembersQuerySchema = z.object({
  includeInactive: z.coerce.boolean().optional().default(false),
  limit: z.coerce.number().min(1).max(100).optional().default(50),
  offset: z.coerce.number().min(0).optional().default(0),
});

const SuspendSchema = z.object({
  reason: z.string().max(500).optional(),
});

/** Member mutations: the service enforces role rank and the URL org. */
const MEMBER_MUTATION_CONFIG = {
  authz: {
    handler:
      "membership-service: caller's ACTIVE role in the membership's org must outrank the target; the membership must be in the URL org",
  },
};

const memberParamsSchema = {
  type: "object",
  properties: {
    organizationId: { type: "string" },
    memberId: { type: "string" },
  },
  required: ["organizationId", "memberId"],
} as const;

/**
 * Register member management routes.
 */
export async function memberRoutes(server: FastifyInstance): Promise<void> {
  /**
   * GET /api/organizations/:organizationId/members
   * List members of an organization.
   * Any active member can view the member list.
   */
  server.get<{
    Params: { organizationId: string };
    Querystring: z.infer<typeof ListMembersQuerySchema>;
  }>(
    "/api/organizations/:organizationId/members",
    {
      config: { authz: { org: "VIEWER" } },
      schema: {
        description: "List members of an organization",
        tags: ["Organizations"],
        params: {
          type: "object",
          properties: {
            organizationId: { type: "string" },
          },
          required: ["organizationId"],
        },
        querystring: {
          type: "object",
          properties: {
            includeInactive: { type: "boolean" },
            limit: { type: "number", minimum: 1, maximum: 100 },
            offset: { type: "number", minimum: 0 },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{
        Params: { organizationId: string };
        Querystring: z.infer<typeof ListMembersQuerySchema>;
      }>,
      reply: FastifyReply,
    ) => {
      const user = getAuthUser(request);

      const { organizationId } = request.params;

      // Parse query params
      const queryResult = ListMembersQuerySchema.safeParse(request.query);
      const options = queryResult.success ? queryResult.data : {};

      const result = await getOrganizationMembers(
        organizationId,
        user.id,
        options,
      );

      if (!result.success) {
        return sendForbidden(reply, result.error);
      }

      return sendSuccess(reply, {
        members: result.members,
        total: result.total,
        canManageMembers: result.canManageMembers,
      });
    },
  );

  /**
   * PATCH /api/organizations/:organizationId/members/:memberId
   * Update a member's role.
   * Requires OWNER or ADMIN role with appropriate permissions.
   */
  server.patch<{
    Params: { organizationId: string; memberId: string };
    Body: z.infer<typeof UpdateRoleSchema>;
  }>(
    "/api/organizations/:organizationId/members/:memberId",
    {
      config: MEMBER_MUTATION_CONFIG,
      schema: {
        description: "Update a member's role",
        tags: ["Organizations"],
        params: memberParamsSchema,
        body: {
          type: "object",
          properties: {
            role: { type: "string", enum: ["ADMIN", "EDITOR", "VIEWER"] },
          },
          required: ["role"],
        },
      },
    },
    async (request, reply) => {
      const user = getAuthUser(request);

      const { organizationId, memberId } = request.params;

      // Validate body
      const parseResult = UpdateRoleSchema.safeParse(request.body);
      if (!parseResult.success) {
        return sendBadRequest(reply, "Validation failed", {
          details: parseResult.error.issues,
        });
      }

      const { role } = parseResult.data;

      const result = await updateMemberRole({
        membershipId: memberId,
        organizationId,
        newRole: role,
        updatingUserId: user.id,
        updatingUserEmail: user.email || "unknown",
      });

      if (!result.success) {
        if (
          result.error?.includes("permissions") ||
          result.error?.includes("Cannot")
        ) {
          return sendForbidden(reply, result.error);
        }
        if (result.error === "Membership not found") {
          return sendNotFound(reply, "Membership");
        }
        return sendBadRequest(reply, result.error || "Update failed");
      }

      return sendSuccess(reply, {
        success: true,
        previousRole: result.previousRole,
        newRole: result.newRole,
      });
    },
  );

  /**
   * DELETE /api/organizations/:organizationId/members/:memberId
   * Remove a member from an organization.
   * Requires OWNER or ADMIN role with appropriate permissions.
   */
  server.delete<{
    Params: { organizationId: string; memberId: string };
  }>(
    "/api/organizations/:organizationId/members/:memberId",
    {
      config: MEMBER_MUTATION_CONFIG,
      schema: {
        description: "Remove a member from an organization",
        tags: ["Organizations"],
        params: memberParamsSchema,
      },
    },
    async (request, reply) => {
      const user = getAuthUser(request);

      const { organizationId, memberId } = request.params;

      const result = await removeMember({
        membershipId: memberId,
        organizationId,
        removingUserId: user.id,
        removingUserEmail: user.email || "unknown",
      });

      if (!result.success) {
        if (
          result.error?.includes("permissions") ||
          result.error?.includes("Cannot")
        ) {
          return sendForbidden(reply, result.error);
        }
        if (result.error === "Membership not found") {
          return sendNotFound(reply, "Membership");
        }
        return sendBadRequest(reply, result.error || "Remove failed");
      }

      // The service proved the membership belongs to organizationId.
      dispatchWebhookEvent(organizationId, "member.removed", {
        userId: result.removedUserId,
        email: result.removedUserEmail,
        removedBy: user.id,
      });

      return sendSuccess(reply, {
        success: true,
        removedUserId: result.removedUserId,
        removedUserEmail: result.removedUserEmail,
      });
    },
  );

  /**
   * POST /api/organizations/:organizationId/leave
   * Leave an organization voluntarily.
   * Owner cannot leave without transferring ownership.
   */
  server.post<{
    Params: { organizationId: string };
  }>(
    "/api/organizations/:organizationId/leave",
    {
      config: {
        authz: {
          handler:
            "the caller's own membership (any status); the last owner cannot leave",
        },
      },
      schema: {
        description: "Leave an organization",
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

      const result = await leaveOrganization({
        organizationId,
        userId: user.id,
        userEmail: user.email || "unknown",
      });

      if (!result.success) {
        if (
          result.error?.includes("Owner cannot leave") ||
          result.error?.includes("Cannot leave")
        ) {
          return sendForbidden(reply, result.error);
        }
        return sendBadRequest(reply, result.error || "Leave failed");
      }

      // Fire webhook event (member left voluntarily = removed)
      dispatchWebhookEvent(organizationId, "member.removed", {
        userId: user.id,
        email: user.email,
        removedBy: user.id, // self-removal
        voluntary: true,
      });

      return sendSuccess(reply, { success: true });
    },
  );

  /**
   * POST /api/organizations/:organizationId/members/:memberId/suspend
   * Suspend a member.
   * Requires OWNER or ADMIN role with appropriate permissions.
   */
  server.post<{
    Params: { organizationId: string; memberId: string };
    Body: z.infer<typeof SuspendSchema>;
  }>(
    "/api/organizations/:organizationId/members/:memberId/suspend",
    {
      config: MEMBER_MUTATION_CONFIG,
      schema: {
        description: "Suspend a member",
        tags: ["Organizations"],
        params: memberParamsSchema,
        body: {
          type: "object",
          properties: {
            reason: { type: "string", maxLength: 500 },
          },
        },
      },
    },
    async (request, reply) => {
      const user = getAuthUser(request);

      const { organizationId, memberId } = request.params;

      // Validate body
      const parseResult = SuspendSchema.safeParse(request.body || {});
      const reason = parseResult.success ? parseResult.data.reason : undefined;

      const result = await suspendMember({
        membershipId: memberId,
        organizationId,
        suspendingUserId: user.id,
        suspendingUserEmail: user.email || "unknown",
        reason,
      });

      if (!result.success) {
        if (
          result.error?.includes("permissions") ||
          result.error?.includes("Cannot")
        ) {
          return sendForbidden(reply, result.error);
        }
        if (result.error === "Membership not found") {
          return sendNotFound(reply, "Membership");
        }
        return sendBadRequest(reply, result.error || "Suspend failed");
      }

      return sendSuccess(reply, {
        success: true,
        suspendedUserId: result.suspendedUserId,
        suspendedUserEmail: result.suspendedUserEmail,
      });
    },
  );

  /**
   * DELETE /api/organizations/:organizationId/members/:memberId/suspend
   * Unsuspend (reactivate) a member.
   * Requires OWNER or ADMIN role with appropriate permissions.
   */
  server.delete<{
    Params: { organizationId: string; memberId: string };
  }>(
    "/api/organizations/:organizationId/members/:memberId/suspend",
    {
      config: MEMBER_MUTATION_CONFIG,
      schema: {
        description: "Unsuspend a member",
        tags: ["Organizations"],
        params: memberParamsSchema,
      },
    },
    async (request, reply) => {
      const user = getAuthUser(request);

      const { organizationId, memberId } = request.params;

      const result = await unsuspendMember({
        membershipId: memberId,
        organizationId,
        unsuspendingUserId: user.id,
        unsuspendingUserEmail: user.email || "unknown",
      });

      if (!result.success) {
        if (
          result.error?.includes("permissions") ||
          result.error?.includes("Cannot")
        ) {
          return sendForbidden(reply, result.error);
        }
        if (result.error === "Membership not found") {
          return sendNotFound(reply, "Membership");
        }
        return sendBadRequest(reply, result.error || "Unsuspend failed");
      }

      return sendSuccess(reply, {
        success: true,
        unsuspendedUserId: result.unsuspendedUserId,
        unsuspendedUserEmail: result.unsuspendedUserEmail,
      });
    },
  );
}

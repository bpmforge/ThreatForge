/**
 * Guest Access API Routes
 *
 * Handles model-level guest access endpoints:
 * - Grant guest access to a threat model
 * - Revoke guest access
 * - List guest access for a model
 * - Validate access token (public endpoint)
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import {
  grantGuestAccess,
  revokeGuestAccess,
  listModelGuestAccess,
  validateAccessToken,
  isValidTokenFormat,
} from "../services/guest-access/guest-access-service.js";
import {
  sendSuccess,
  sendCreated,
  sendBadRequest,
  sendForbidden,
  sendNotFound,
  sendUnauthorized,
} from "../utils/api-response.js";

// Request schemas
const GrantAccessSchema = z.object({
  email: z.string().email("Valid email required"),
  role: z.enum(["VIEWER", "COMMENTER", "EDITOR"]),
  canExport: z.boolean().default(false),
  expiresInDays: z.number().min(1).max(365).nullable().optional(),
  allowedIps: z.array(z.string()).optional(),
  allowedDomains: z.array(z.string()).optional(),
});

/**
 * Register guest access routes.
 */
export async function guestAccessRoutes(
  server: FastifyInstance,
): Promise<void> {
  /**
   * POST /api/threat-models/:threatModelId/guest-access
   * Grant guest access to a threat model.
   * Requires OWNER, ADMIN, or EDITOR role.
   */
  server.post<{
    Params: { threatModelId: string };
    Body: z.infer<typeof GrantAccessSchema>;
  }>(
    "/api/threat-models/:threatModelId/guest-access",
    {
      config: { authz: { model: "edit" } },
      schema: {
        description: "Grant guest access to a threat model",
        tags: ["Threat Models"],
        params: {
          type: "object",
          properties: {
            threatModelId: { type: "string" },
          },
          required: ["threatModelId"],
        },
        body: {
          type: "object",
          properties: {
            email: { type: "string", format: "email" },
            role: { type: "string", enum: ["VIEWER", "COMMENTER", "EDITOR"] },
            canExport: { type: "boolean" },
            expiresInDays: {
              type: "number",
              minimum: 1,
              maximum: 365,
              nullable: true,
            },
            allowedIps: { type: "array", items: { type: "string" } },
            allowedDomains: { type: "array", items: { type: "string" } },
          },
          required: ["email", "role"],
        },
      },
    },
    async (request, reply) => {
      const user = request.authUser;
      if (!user) {
        return sendUnauthorized(reply);
      }

      const { threatModelId } = request.params;

      // Validate body
      const parseResult = GrantAccessSchema.safeParse(request.body);
      if (!parseResult.success) {
        return sendBadRequest(reply, "Validation failed");
      }

      const {
        email,
        role,
        canExport,
        expiresInDays,
        allowedIps,
        allowedDomains,
      } = parseResult.data;

      const result = await grantGuestAccess({
        threatModelId,
        email,
        role,
        canExport,
        expiresInDays: expiresInDays ?? null,
        allowedIps,
        allowedDomains,
        grantedById: user.id,
        grantedByEmail: user.email || "unknown",
      });

      if (!result.success) {
        if (
          result.error?.includes("not allow") ||
          result.error?.includes("Only")
        ) {
          return sendForbidden(reply, result.error || "Access denied");
        }
        return sendBadRequest(reply, result.error || "Operation failed");
      }

      return sendCreated(reply, {
        success: true,
        accessId: result.accessId,
        accessToken: result.accessToken,
        message: result.alreadyGranted
          ? "Guest access has been updated"
          : "Guest access granted successfully",
      });
    },
  );

  /**
   * GET /api/threat-models/:threatModelId/guest-access
   * List all guest access for a threat model.
   * Any active org member can view.
   */
  server.get<{
    Params: { threatModelId: string };
  }>(
    "/api/threat-models/:threatModelId/guest-access",
    {
      config: { authz: { model: "view" } },
      schema: {
        description: "List guest access for a threat model",
        tags: ["Threat Models"],
        params: {
          type: "object",
          properties: {
            threatModelId: { type: "string" },
          },
          required: ["threatModelId"],
        },
      },
    },
    async (
      request: FastifyRequest<{ Params: { threatModelId: string } }>,
      reply: FastifyReply,
    ) => {
      const user = request.authUser;
      if (!user) {
        return sendUnauthorized(reply);
      }

      const { threatModelId } = request.params;

      const result = await listModelGuestAccess(threatModelId, user.id);

      if (!result.success) {
        if (result.error?.includes("not an active member")) {
          return sendForbidden(reply, result.error || "Access denied");
        }
        return sendNotFound(reply, result.error || "Resource");
      }

      return sendSuccess(reply, {
        accessRecords: result.accessRecords,
        canManageAccess: result.canManageAccess,
      });
    },
  );

  /**
   * DELETE /api/threat-models/:threatModelId/guest-access/:accessId
   * Revoke guest access.
   * Requires OWNER, ADMIN, or EDITOR role.
   */
  server.delete<{
    Params: { threatModelId: string; accessId: string };
  }>(
    "/api/threat-models/:threatModelId/guest-access/:accessId",
    {
      config: {
        authz: {
          handler:
            "ACTIVE OWNER/ADMIN/EDITOR of the org owning the access record (accessId); :threatModelId is not checked",
        },
      },
      schema: {
        description: "Revoke guest access to a threat model",
        tags: ["Threat Models"],
        params: {
          type: "object",
          properties: {
            threatModelId: { type: "string" },
            accessId: { type: "string" },
          },
          required: ["threatModelId", "accessId"],
        },
      },
    },
    async (request, reply) => {
      const user = request.authUser;
      if (!user) {
        return sendUnauthorized(reply);
      }

      const { accessId } = request.params;

      const result = await revokeGuestAccess(
        accessId,
        user.id,
        user.email || "unknown",
      );

      if (!result.success) {
        if (
          result.error?.includes("Only") ||
          result.error?.includes("not an active member")
        ) {
          return sendForbidden(reply, result.error || "Access denied");
        }
        return sendBadRequest(reply, result.error || "Operation failed");
      }

      return sendSuccess(reply, { success: true });
    },
  );

  /**
   * POST /api/guest-access/validate
   * Validate an access token and return access details.
   * This is a semi-public endpoint - doesn't require full auth.
   */
  server.post<{
    Body: { token: string };
  }>(
    "/api/guest-access/validate",
    {
      config: {
        authz: {
          handler:
            "any signed-in user holding a valid, unexpired guest-access token (IP allowlist checked); returns only that grant's model id and role",
        },
      },
      schema: {
        description: "Validate a guest access token",
        tags: ["Threat Models"],
        body: {
          type: "object",
          properties: {
            token: { type: "string" },
          },
          required: ["token"],
        },
      },
    },
    async (request, reply) => {
      const { token } = request.body;

      if (!token || !isValidTokenFormat(token)) {
        return sendBadRequest(reply, "Invalid token format");
      }

      // Get client IP for IP whitelist check
      const clientIp = request.ip;

      const result = await validateAccessToken(token, clientIp);

      if (!result.valid) {
        return reply.status(401).send({ valid: false, error: result.error });
      }

      return sendSuccess(reply, {
        valid: true,
        threatModelId: result.threatModelId,
        role: result.role,
        canExport: result.canExport,
      });
    },
  );
}

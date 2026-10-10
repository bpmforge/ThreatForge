/**
 * Admin Bulk Operations Routes
 *
 * Bulk import/invite operations for users.
 */
import type { FastifyPluginAsync } from "fastify";
import { getAuthUser, isSuperAdmin } from "./utils.js";
import {
  sendSuccess,
  sendForbidden,
  sendBadRequest,
} from "../../utils/api-response.js";
import { routeAuthz } from "../../middleware/authz-policy.js";

interface BulkInviteResult {
  line: number;
  email: string;
  success: boolean;
  error?: string;
  invitationId?: string;
}

const SUPER_ADMIN = routeAuthz("superAdmin");

export const bulkRoutes: FastifyPluginAsync = async (server) => {
  /** Bulk invite users via CSV */
  server.post<{ Body: { csv: string } }>(
    "/api/admin/users/bulk-invite",
    SUPER_ADMIN,
    async (request, reply) => {
      const authUser = getAuthUser(request);

      const hasAccess = await isSuperAdmin(authUser.id);
      if (!hasAccess) {
        return sendForbidden(reply, "Super admin access required");
      }

      const { csv } = request.body;
      if (!csv || typeof csv !== "string") {
        return sendBadRequest(reply, "CSV content required");
      }

      const lines = csv.trim().split("\n");
      const results: BulkInviteResult[] = [];

      const { createInvitation } = await import(
        "../../services/invitation/invitation-service.js"
      );

      // Skip header row if present
      const startIndex = lines[0]?.toLowerCase().includes("email") ? 1 : 0;

      for (let i = startIndex; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const parts = line.split(",").map((p) => p.trim());
        const [email, role, organizationId] = parts;

        // Validate fields
        if (!email || !role || !organizationId) {
          results.push({
            line: i + 1,
            email: email || "missing",
            success: false,
            error: "Missing required fields: email, role, organizationId",
          });
          continue;
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
          results.push({
            line: i + 1,
            email,
            success: false,
            error: "Invalid email format",
          });
          continue;
        }

        // Validate role
        const validRoles = ["ADMIN", "EDITOR", "VIEWER"];
        const normalizedRole = role.toUpperCase();
        if (!validRoles.includes(normalizedRole)) {
          results.push({
            line: i + 1,
            email,
            success: false,
            error: `Invalid role: ${role}. Must be ADMIN, EDITOR, or VIEWER`,
          });
          continue;
        }

        // Create invitation
        try {
          const result = await createInvitation({
            organizationId,
            email,
            role: normalizedRole as "ADMIN" | "EDITOR" | "VIEWER",
            invitedById: authUser.id,
            inviterEmail: authUser.email || "admin@system",
          });

          if (result.success) {
            results.push({
              line: i + 1,
              email,
              success: true,
              invitationId: result.invitationId,
            });
          } else {
            results.push({
              line: i + 1,
              email,
              success: false,
              error: result.error || "Failed to create invitation",
            });
          }
        } catch (err) {
          results.push({
            line: i + 1,
            email,
            success: false,
            error: err instanceof Error ? err.message : "Unknown error",
          });
        }
      }

      const successCount = results.filter((r) => r.success).length;
      const failureCount = results.filter((r) => !r.success).length;

      return sendSuccess(reply, {
        success: failureCount === 0,
        totalProcessed: results.length,
        successCount,
        failureCount,
        results,
      });
    },
  );
};

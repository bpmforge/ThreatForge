/**
 * Cache Management API
 *
 * Admin endpoints for cache management and monitoring.
 */

import { FastifyInstance } from "fastify";
import {
  cacheStats,
  cacheClear,
  cacheInvalidateByTag,
  cacheInvalidateByPattern,
} from "../services/cache/index.js";
import { sendSuccess, sendForbidden } from "../utils/api-response.js";
import { getAuthUser } from "../utils/auth-helpers.js";
import { isSuperAdmin } from "./admin/utils.js";
import { routeAuthz } from "../middleware/authz-policy.js";

const SUPER_ADMIN = routeAuthz("superAdmin");

export async function cacheRoutes(fastify: FastifyInstance) {
  // Get cache statistics (admin only)
  fastify.get("/api/admin/cache/stats", SUPER_ADMIN, async (request, reply) => {
    const authUser = getAuthUser(request);
    if (!(await isSuperAdmin(authUser.id))) {
      return sendForbidden(reply, "Admin access required");
    }

    const stats = cacheStats();

    return sendSuccess(reply, {
      success: true,
      data: {
        ...stats,
        hitRatePercent: `${(stats.hitRate * 100).toFixed(2)}%`,
      },
    });
  });

  // Clear all cache (admin only)
  fastify.post(
    "/api/admin/cache/clear",
    SUPER_ADMIN,
    async (request, reply) => {
      const authUser = getAuthUser(request);
      if (!(await isSuperAdmin(authUser.id))) {
        return sendForbidden(reply, "Admin access required");
      }

      await cacheClear();

      return sendSuccess(reply, {
        success: true,
        message: "Cache cleared",
      });
    },
  );

  // Invalidate by tag (admin only)
  fastify.post<{ Body: { tag: string } }>(
    "/api/admin/cache/invalidate/tag",
    {
      config: { authz: "superAdmin" },
      schema: {
        body: {
          type: "object",
          properties: {
            tag: { type: "string" },
          },
          required: ["tag"],
        },
      },
    },
    async (request, reply) => {
      const authUser = getAuthUser(request);
      if (!(await isSuperAdmin(authUser.id))) {
        return sendForbidden(reply, "Admin access required");
      }

      const count = await cacheInvalidateByTag(request.body.tag);

      return sendSuccess(reply, {
        success: true,
        data: { invalidatedCount: count },
      });
    },
  );

  // Invalidate by pattern (admin only)
  fastify.post<{ Body: { pattern: string } }>(
    "/api/admin/cache/invalidate/pattern",
    {
      config: { authz: "superAdmin" },
      schema: {
        body: {
          type: "object",
          properties: {
            pattern: { type: "string" },
          },
          required: ["pattern"],
        },
      },
    },
    async (request, reply) => {
      const authUser = getAuthUser(request);
      if (!(await isSuperAdmin(authUser.id))) {
        return sendForbidden(reply, "Admin access required");
      }

      const count = await cacheInvalidateByPattern(request.body.pattern);

      return sendSuccess(reply, {
        success: true,
        data: { invalidatedCount: count },
      });
    },
  );
}

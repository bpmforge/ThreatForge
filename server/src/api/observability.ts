/**
 * Observability API
 *
 * Endpoints for metrics, health checks, and tracing.
 */

import { createHash, timingSafeEqual } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
  exportMetrics,
  runHealthChecks,
  runLivenessCheck,
  runReadinessCheck,
  runDependencyCheck,
  getSystemInfo,
} from "../services/observability/index.js";
import { sendForbidden } from "../utils/api-response.js";
import { getAuthUser } from "../utils/auth-helpers.js";
import { isSuperAdmin } from "./admin/utils.js";
import { authenticate } from "../middleware/auth.js";
import { routeAuthz } from "../middleware/authz-policy.js";

const SUPER_ADMIN = routeAuthz("superAdmin");

const sha256 = (s: string) => createHash("sha256").update(s).digest();

/**
 * /metrics and /health/dependencies expose platform-wide counters, env var
 * names and raw connection errors: they need `Authorization: Bearer
 * $METRICS_TOKEN`, and are off (404) while METRICS_TOKEN is unset.
 */
async function requireMetricsToken(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const expected = process.env.METRICS_TOKEN;
  if (!expected) {
    return reply.status(404).send({ error: "Not Found" });
  }
  const given = request.headers.authorization?.replace(/^Bearer /, "") ?? "";
  if (!timingSafeEqual(sha256(given), sha256(expected))) {
    return reply.status(401).send({ error: "Unauthorized" });
  }
}

const METRICS_TOKEN_ROUTE = {
  preHandler: requireMetricsToken,
  ...routeAuthz({
    public: "no user session; METRICS_TOKEN bearer, off when unset",
  }),
};
const PROBE = routeAuthz({ public: "health probe, no tenant data" });

export async function observabilityRoutes(fastify: FastifyInstance) {
  // Prometheus metrics endpoint
  fastify.get("/metrics", METRICS_TOKEN_ROUTE, async (request, reply) => {
    const metrics = exportMetrics();
    reply
      .header("Content-Type", "text/plain; version=0.0.4; charset=utf-8")
      .send(metrics);
  });

  // Health check (comprehensive)
  fastify.get("/health", PROBE, async () => {
    return runHealthChecks();
  });

  // Liveness probe (Kubernetes)
  fastify.get("/health/live", PROBE, async () => {
    return runLivenessCheck();
  });

  // Readiness probe (Kubernetes)
  fastify.get("/health/ready", PROBE, async (request, reply) => {
    const result = await runReadinessCheck();
    if (!result.ready) {
      reply.status(503);
    }
    return result;
  });

  // Dependency check endpoint (detailed startup verification)
  fastify.get(
    "/health/dependencies",
    METRICS_TOKEN_ROUTE,
    async (request, reply) => {
      const result = await runDependencyCheck();
      if (!result.ready) {
        reply.status(503);
      }
      return result;
    },
  );

  // System info (admin only — auth required)
  fastify.get(
    "/api/admin/system",
    { preHandler: authenticate, ...SUPER_ADMIN },
    async (request, reply) => {
      const authUser = getAuthUser(request);
      if (!(await isSuperAdmin(authUser.id))) {
        return sendForbidden(reply, "Admin access required");
      }

      return {
        success: true,
        data: getSystemInfo(),
      };
    },
  );
}

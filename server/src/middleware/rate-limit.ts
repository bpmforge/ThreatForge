/**
 * Rate Limiting Middleware
 *
 * Protects against brute force and DoS attacks by limiting request rates.
 * Uses @fastify/rate-limit with configurable limits per route category.
 */
import type { FastifyInstance, FastifyRequest } from "fastify";
import rateLimit from "@fastify/rate-limit";

/**
 * Rate limit configuration by route category.
 */
const rateLimits = {
  // General API rate limit.
  // NOTE: 500/min per IP was chosen after observing SPAs trip 100/min on a
  // single canvas page load (7 parallel GETs × React strict mode × tab switches
  // = 30+ requests in a few seconds). Paired with Fastify's `trustProxy: true`
  // so each real client gets its own bucket, not the nginx/Cloudflare gateway.
  global: {
    max: 2000,
    timeWindow: "1 minute",
  },
  // Authentication endpoints (stricter)
  auth: {
    max: 10,
    timeWindow: "1 minute",
  },
  // AI endpoints (more restrictive due to cost)
  ai: {
    max: 20,
    timeWindow: "1 minute",
  },
  // Setup endpoints (very restrictive - one-time operation)
  setup: {
    max: 5,
    timeWindow: "15 minutes",
  },
};

/**
 * Register rate limiting plugin with global limits.
 */
export async function registerRateLimiting(
  server: FastifyInstance,
): Promise<void> {
  await server.register(rateLimit, {
    max: rateLimits.global.max,
    timeWindow: rateLimits.global.timeWindow,
    // Use IP address as key
    keyGenerator: (request) => {
      return request.ip;
    },
    // Error handler for rate limit exceeded
    errorResponseBuilder: (_request, context) => {
      return {
        error: "Too Many Requests",
        message: `Rate limit exceeded. Try again in ${Math.ceil(context.ttl / 1000)} seconds.`,
        statusCode: 429,
        retryAfter: Math.ceil(context.ttl / 1000),
      };
    },
    // Skip rate limiting for health checks
    allowList: (request) => {
      return request.url === "/health";
    },
  });
}

/**
 * Get rate limit config for auth routes.
 */
export function getAuthRateLimit() {
  return {
    config: {
      rateLimit: {
        max: rateLimits.auth.max,
        timeWindow: rateLimits.auth.timeWindow,
      },
    },
  };
}

/**
 * Get rate limit config for setup routes.
 */
export function getSetupRateLimit() {
  return {
    config: {
      rateLimit: {
        max: rateLimits.setup.max,
        timeWindow: rateLimits.setup.timeWindow,
      },
    },
  };
}

/**
 * Get rate limit config for synchronous AI routes. Runs in preHandler so the
 * authenticated caller is known; keyGenerator picks the bucket (per org when
 * the route knows it, else per user).
 */
export function getAiRateLimit(
  keyGenerator: (request: FastifyRequest) => string | Promise<string>,
) {
  return {
    config: {
      rateLimit: {
        max: rateLimits.ai.max,
        timeWindow: rateLimits.ai.timeWindow,
        hook: "preHandler" as const,
        keyGenerator,
      },
    },
  };
}

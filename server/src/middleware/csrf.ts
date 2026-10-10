/**
 * CSRF Protection Middleware
 *
 * Protects against cross-site request forgery attacks.
 * Uses the double-submit cookie pattern with @fastify/csrf-protection.
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import csrf from "@fastify/csrf-protection";

/**
 * Register CSRF protection plugin.
 * Adds CSRF token generation and validation.
 */
export async function registerCsrf(server: FastifyInstance): Promise<void> {
  await server.register(csrf, {
    sessionPlugin: "@fastify/cookie",
    cookieOpts: {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    },
    getToken: (req: FastifyRequest) => {
      // Check multiple header formats
      return (
        (req.headers["csrf-token"] as string) ||
        (req.headers["x-csrf-token"] as string) ||
        (req.headers["xsrf-token"] as string) ||
        (req.headers["x-xsrf-token"] as string)
      );
    },
  });
}

/**
 * CSRF token endpoint handler.
 * Returns a new CSRF token for the client to use.
 */
export async function getCsrfToken(
  _request: FastifyRequest,
  reply: FastifyReply,
): Promise<{ csrfToken: string }> {
  const token = await reply.generateCsrf();
  return { csrfToken: token };
}

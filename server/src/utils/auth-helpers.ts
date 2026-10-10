/**
 * Shared Authentication Helpers
 *
 * Provides getAuthUser() and related helpers used across all API routes.
 * Import from here instead of defining locally in each route file.
 */
import type { FastifyRequest } from "fastify";
import type { AuthUser } from "../middleware/auth.js";

/**
 * Get the authenticated user from the request.
 * Throws if no user is authenticated (should be caught by error handler).
 */
export function getAuthUser(request: FastifyRequest): AuthUser {
  if (!request.authUser) {
    throw new Error("User not authenticated");
  }
  return request.authUser;
}

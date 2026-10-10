/**
 * Project API - Shared Helpers
 *
 * Access check functions and validation schemas shared across project routes.
 */
import { z } from "zod";
import type { FastifyReply } from "fastify";
import {
  checkProjectAccess,
  type Permission,
} from "../../services/access-control/access-control-service.js";
import { sendForbidden, sendNotFound } from "../../utils/api-response.js";

/**
 * Authorize `action` on a project through the caller's ACTIVE org membership.
 * Sends 404 (no access or no such project — indistinguishable) or 403 (role
 * lacks the permission) and returns false when refused.
 */
export async function authorizeProject(
  reply: FastifyReply,
  userId: string,
  projectId: string,
  action: Permission,
): Promise<boolean> {
  const access = await checkProjectAccess(userId, projectId);
  if (!access.hasAccess) {
    sendNotFound(reply, "Project");
    return false;
  }
  if (!access.permissions.includes(action)) {
    sendForbidden(
      reply,
      `${access.role} role does not have '${action}' permission`,
    );
    return false;
  }
  return true;
}

/** Check if user has access to a project through organization membership (backward compat) */
export async function canAccessProject(
  userId: string,
  projectId: string,
): Promise<boolean> {
  const access = await checkProjectAccess(userId, projectId);
  return access.hasAccess;
}

const ProjectStatusSchema = z.enum(["ACTIVE", "ARCHIVED"]);
const ProjectRoleSchema = z.enum(["OWNER", "EDITOR", "VIEWER"]);

export const CreateProjectSchema = z.object({
  name: z.string().min(3).max(100),
  description: z.string().max(500).optional(),
  organizationId: z.string().optional(), // Optional - will auto-select if user has only one org
});

export const UpdateProjectSchema = z.object({
  name: z.string().min(3).max(100).optional(),
  description: z.string().max(500).optional(),
  status: ProjectStatusSchema.optional(),
});

export const InviteProjectMemberSchema = z.object({
  email: z.string().email(),
  role: ProjectRoleSchema,
});

export const UpdateProjectMemberSchema = z.object({
  role: ProjectRoleSchema,
});

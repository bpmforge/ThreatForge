/**
 * Project Member Routes
 *
 * POST invite, PATCH update role, DELETE remove member.
 */
import type { FastifyPluginAsync } from "fastify";
import { getPrisma } from "../../../db.js";
import {
  sendCreated,
  sendSuccess,
  sendNoContent,
  sendNotFound,
  sendConflict,
  sendValidationError,
  sendBadRequest,
} from "../../../utils/api-response.js";
import { getAuthUser } from "../../../utils/auth-helpers.js";
import {
  authorizeProject,
  InviteProjectMemberSchema,
  UpdateProjectMemberSchema,
} from "../helpers.js";
import { checkOrganizationAccess } from "../../../services/access-control/access-control-service.js";
import { routeAuthz } from "../../../middleware/authz-policy.js";

/** Managing project membership is an org-admin action (manage permission). */
const PROJECT_MANAGE = routeAuthz({
  handler: "org role with manage on the project",
});

export const memberRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * POST /api/projects/:id/members
   * Invite member to project
   */
  fastify.post<{ Params: { id: string } }>(
    "/api/projects/:id/members",
    PROJECT_MANAGE,
    async (request, reply) => {
      const authUser = getAuthUser(request);
      const prisma = await getPrisma();
      const { id } = request.params;

      if (!(await authorizeProject(reply, authUser.id, id, "manage"))) {
        return reply;
      }

      const parseResult = InviteProjectMemberSchema.safeParse(request.body);

      if (!parseResult.success) {
        const errors = parseResult.error.issues.map((e) => ({
          field: e.path.join("."),
          message: e.message,
        }));
        return sendValidationError(reply, errors);
      }

      const { email, role } = parseResult.data;

      // Only existing, ACTIVE members of the project's organization can be
      // added. This used to create a User row for any email — an account
      // squatting on someone else's address. New people join the org by
      // invitation first.
      const project = await prisma.project.findUnique({
        where: { id },
        select: { organizationId: true },
      });
      const user = await prisma.user.findUnique({ where: { email } });
      const orgAccess =
        user && project
          ? await checkOrganizationAccess(user.id, project.organizationId)
          : null;
      if (!user || !orgAccess?.hasAccess) {
        return sendBadRequest(
          reply,
          "User must be an active member of the project's organization. Invite them to the organization first.",
        );
      }

      // Check if already a member
      const existingMember = await prisma.projectMember.findUnique({
        where: {
          projectId_userId: {
            projectId: id,
            userId: user.id,
          },
        },
      });

      if (existingMember) {
        return sendConflict(reply, "User is already a project member");
      }

      const member = await prisma.projectMember.create({
        data: {
          projectId: id,
          userId: user.id,
          role,
        },
      });

      return sendCreated(reply, {
        id: member.id,
        userId: member.userId,
        role: member.role,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          avatarUrl: user.avatarUrl,
        },
      });
    },
  );

  /**
   * PATCH /api/projects/:id/members/:memberId
   * Update project member role
   */
  fastify.patch<{ Params: { id: string; memberId: string } }>(
    "/api/projects/:id/members/:memberId",
    PROJECT_MANAGE,
    async (request, reply) => {
      const authUser = getAuthUser(request);
      const prisma = await getPrisma();
      const { id, memberId } = request.params;

      if (!(await authorizeProject(reply, authUser.id, id, "manage"))) {
        return reply;
      }

      const parseResult = UpdateProjectMemberSchema.safeParse(request.body);

      if (!parseResult.success) {
        const errors = parseResult.error.issues.map((e) => ({
          field: e.path.join("."),
          message: e.message,
        }));
        return sendValidationError(reply, errors);
      }

      const member = await prisma.projectMember.findFirst({
        where: { id: memberId, projectId: id },
      });

      if (!member) {
        return sendNotFound(reply, "Member", memberId);
      }

      const updated = await prisma.projectMember.update({
        where: { id: memberId },
        data: { role: parseResult.data.role },
      });

      return sendSuccess(reply, {
        id: updated.id,
        userId: updated.userId,
        role: updated.role,
      });
    },
  );

  /**
   * DELETE /api/projects/:id/members/:memberId
   * Remove member from project
   */
  fastify.delete<{ Params: { id: string; memberId: string } }>(
    "/api/projects/:id/members/:memberId",
    PROJECT_MANAGE,
    async (request, reply) => {
      const authUser = getAuthUser(request);
      const prisma = await getPrisma();
      const { id, memberId } = request.params;

      if (!(await authorizeProject(reply, authUser.id, id, "manage"))) {
        return reply;
      }

      const member = await prisma.projectMember.findFirst({
        where: { id: memberId, projectId: id },
      });

      if (!member) {
        return sendNotFound(reply, "Member", memberId);
      }

      await prisma.projectMember.delete({ where: { id: memberId } });

      return sendNoContent(reply);
    },
  );
};

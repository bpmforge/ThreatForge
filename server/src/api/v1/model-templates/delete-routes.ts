/**
 * Model Templates Delete Routes
 */
import type { FastifyPluginAsync } from "fastify";
import { getPrisma } from "../../../db.js";
import { getAuthUser, checkOrganizationAccess, logAudit } from "../helpers.js";
import {
  sendNotFound,
  sendForbidden,
  sendNoContent,
} from "../../../utils/api-response.js";

export const deleteRoutes: FastifyPluginAsync = async (server) => {
  const prisma = await getPrisma();

  /**
   * DELETE /model-templates/:id
   * Delete a model template
   */
  server.delete<{ Params: { id: string } }>(
    "/model-templates/:id",
    {
      config: {
        authz: {
          handler:
            "template creator, or ACTIVE OWNER/ADMIN of the template's organization",
        },
      },
      schema: {
        tags: ["Model Templates"],
        summary: "Delete model template",
      },
    },
    async (request, reply) => {
      const user = getAuthUser(request);
      const { id } = request.params;

      const template = await prisma.modelTemplate.findUnique({
        where: { id },
      });
      if (!template) {
        return sendNotFound(reply, "Template");
      }

      if (template.createdById !== user.id) {
        if (template.organizationId) {
          const access = await checkOrganizationAccess(
            user.id,
            template.organizationId,
          );
          if (
            !access ||
            !access.role ||
            !["OWNER", "ADMIN"].includes(access.role)
          ) {
            return sendForbidden(reply, "Admin access required");
          }
        } else {
          return sendForbidden(
            reply,
            "Cannot delete template you did not create",
          );
        }
      }

      await prisma.modelTemplate.delete({ where: { id } });

      await logAudit({
        scope: "ORGANIZATION",
        action: "DELETE",
        resourceType: "THREAT_MODEL",
        resourceId: id,
        resourceName: template.name,
        userId: user.id,
        userEmail: user.email || "",
        organizationId: template.organizationId ?? undefined,
        metadata: { type: "model_template" },
      });

      return sendNoContent(reply);
    },
  );
};

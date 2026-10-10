/**
 * Mitigation Template Mutation Routes
 *
 * Update and delete mitigation templates within libraries.
 */
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { getPrisma } from "../../../../db.js";
import {
  getAuthUser,
  checkOrganizationAccess,
  logAudit,
} from "../../helpers.js";
import {
  sendNotFound,
  sendForbidden,
  sendNoContent,
} from "../../../../utils/api-response.js";
import { UpdateTemplateSchema } from "../schemas.js";

export const templateMutationRoutes: FastifyPluginAsync = async (server) => {
  const prisma = await getPrisma();

  /**
   * PATCH /:orgId/mitigation-libraries/:libraryId/templates/:templateId
   * Update a mitigation template
   */
  server.patch<{
    Params: { orgId: string; libraryId: string; templateId: string };
    Body: z.infer<typeof UpdateTemplateSchema>;
  }>(
    "/:orgId/mitigation-libraries/:libraryId/templates/:templateId",
    {
      schema: {
        tags: ["Mitigation Libraries"],
        summary: "Update mitigation template",
      },
      config: { authz: { org: "EDITOR" } },
    },
    async (request, reply) => {
      const user = getAuthUser(request);
      const { orgId, libraryId, templateId } = request.params;
      const body = UpdateTemplateSchema.parse(request.body);

      const access = await checkOrganizationAccess(user.id, orgId);
      if (
        !access ||
        !access.role ||
        !["OWNER", "ADMIN", "EDITOR"].includes(access.role)
      ) {
        return sendForbidden(reply, "Editor access required");
      }

      // Verify template exists and library is owned
      const template = await prisma.mitigationTemplate.findFirst({
        where: { id: templateId, libraryId },
        include: { library: true },
      });
      if (!template || template.library.organizationId !== orgId) {
        return sendNotFound(reply, "Template");
      }

      const updateData: Record<string, unknown> = {};
      if (body.name !== undefined) updateData.name = body.name;
      if (body.description !== undefined)
        updateData.description = body.description;
      if (body.strategy !== undefined) updateData.strategy = body.strategy;
      if (body.effort !== undefined) updateData.effort = body.effort;
      if (body.effectiveness !== undefined)
        updateData.effectiveness = body.effectiveness;
      if (body.applicableThreatTypes !== undefined)
        updateData.applicableThreatTypes = JSON.stringify(
          body.applicableThreatTypes,
        );
      if (body.complianceControls !== undefined)
        updateData.complianceControls = JSON.stringify(body.complianceControls);
      if (body.implementationSteps !== undefined)
        updateData.implementationSteps = JSON.stringify(
          body.implementationSteps,
        );
      if (body.prerequisites !== undefined)
        updateData.prerequisites = JSON.stringify(body.prerequisites);
      if (body.relatedTemplateIds !== undefined)
        updateData.relatedTemplateIds = JSON.stringify(body.relatedTemplateIds);
      if (body.tags !== undefined) updateData.tags = JSON.stringify(body.tags);

      const updated = await prisma.mitigationTemplate.update({
        where: { id: templateId },
        data: updateData,
      });

      await logAudit({
        scope: "ORGANIZATION",
        action: "UPDATE",
        resourceType: "THREAT_LIBRARY",
        resourceId: templateId,
        resourceName: updated.name,
        userId: user.id,
        userEmail: user.email || "",
        organizationId: orgId,
        metadata: { type: "mitigation_template", libraryId },
      });

      return {
        id: updated.id,
        name: updated.name,
        description: updated.description,
        strategy: updated.strategy,
        effort: updated.effort,
        effectiveness: updated.effectiveness,
        applicableThreatTypes: JSON.parse(updated.applicableThreatTypes),
        complianceControls: JSON.parse(updated.complianceControls),
        implementationSteps: JSON.parse(updated.implementationSteps),
        prerequisites: JSON.parse(updated.prerequisites),
        relatedTemplateIds: JSON.parse(updated.relatedTemplateIds),
        tags: JSON.parse(updated.tags),
        usageCount: updated.usageCount,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
      };
    },
  );

  /**
   * DELETE /:orgId/mitigation-libraries/:libraryId/templates/:templateId
   * Delete a mitigation template
   */
  server.delete<{
    Params: { orgId: string; libraryId: string; templateId: string };
  }>(
    "/:orgId/mitigation-libraries/:libraryId/templates/:templateId",
    {
      schema: {
        tags: ["Mitigation Libraries"],
        summary: "Delete mitigation template",
      },
      config: { authz: { org: "ADMIN" } },
    },
    async (request, reply) => {
      const user = getAuthUser(request);
      const { orgId, libraryId, templateId } = request.params;

      const access = await checkOrganizationAccess(user.id, orgId);
      if (
        !access ||
        !access.role ||
        !["OWNER", "ADMIN"].includes(access.role)
      ) {
        return sendForbidden(reply, "Admin access required");
      }

      const template = await prisma.mitigationTemplate.findFirst({
        where: { id: templateId, libraryId },
        include: { library: true },
      });
      if (!template || template.library.organizationId !== orgId) {
        return sendNotFound(reply, "Template");
      }

      await prisma.mitigationTemplate.delete({ where: { id: templateId } });

      await logAudit({
        scope: "ORGANIZATION",
        action: "DELETE",
        resourceType: "THREAT_LIBRARY",
        resourceId: templateId,
        resourceName: template.name,
        userId: user.id,
        userEmail: user.email || "",
        organizationId: orgId,
        metadata: { type: "mitigation_template", libraryId },
      });

      return sendNoContent(reply);
    },
  );
};

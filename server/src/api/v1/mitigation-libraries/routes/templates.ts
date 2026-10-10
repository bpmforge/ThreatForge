/**
 * Mitigation Template List & Create Routes
 *
 * List and create mitigation templates within libraries.
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
  sendCreated,
  sendNotFound,
  sendForbidden,
} from "../../../../utils/api-response.js";
import { CreateTemplateSchema } from "../schemas.js";

export const templateRoutes: FastifyPluginAsync = async (server) => {
  const prisma = await getPrisma();

  /**
   * GET /:orgId/mitigation-libraries/:libraryId/templates
   * List templates in a mitigation library
   */
  server.get<{
    Params: { orgId: string; libraryId: string };
    Querystring: { search?: string; strategy?: string; tags?: string };
  }>(
    "/:orgId/mitigation-libraries/:libraryId/templates",
    {
      config: { authz: { org: "VIEWER" } },
      schema: {
        tags: ["Mitigation Libraries"],
        summary: "List mitigation templates",
      },
    },
    async (request, reply) => {
      const user = getAuthUser(request);
      const { orgId, libraryId } = request.params;
      const { search, strategy, tags } = request.query;

      const access = await checkOrganizationAccess(user.id, orgId);
      if (!access) {
        return sendForbidden(reply, "Access denied");
      }

      // Verify library access
      const library = await prisma.mitigationLibrary.findFirst({
        where: {
          id: libraryId,
          OR: [
            { organizationId: orgId },
            { isPublic: true },
            { isDefault: true },
          ],
        },
      });
      if (!library) {
        return sendNotFound(reply, "Library");
      }

      // Build where clause
      const where: Record<string, unknown> = { libraryId };
      if (search) {
        where.OR = [
          { name: { contains: search } },
          { description: { contains: search } },
        ];
      }
      if (strategy) {
        where.strategy = strategy;
      }

      const templates = await prisma.mitigationTemplate.findMany({
        where,
        orderBy: { name: "asc" },
      });

      // Filter by tags if provided
      let filteredTemplates = templates;
      if (tags) {
        const tagList = tags.split(",").map((t) => t.trim().toLowerCase());
        filteredTemplates = templates.filter((t) => {
          const templateTags = JSON.parse(t.tags) as string[];
          return tagList.some((tag) =>
            templateTags.some((tt) => tt.toLowerCase().includes(tag)),
          );
        });
      }

      return {
        data: filteredTemplates.map((t) => ({
          id: t.id,
          name: t.name,
          description: t.description,
          strategy: t.strategy,
          effort: t.effort,
          effectiveness: t.effectiveness,
          applicableThreatTypes: JSON.parse(t.applicableThreatTypes),
          complianceControls: JSON.parse(t.complianceControls),
          implementationSteps: JSON.parse(t.implementationSteps),
          prerequisites: JSON.parse(t.prerequisites),
          relatedTemplateIds: JSON.parse(t.relatedTemplateIds),
          tags: JSON.parse(t.tags),
          usageCount: t.usageCount,
          createdAt: t.createdAt.toISOString(),
          updatedAt: t.updatedAt.toISOString(),
        })),
      };
    },
  );

  /**
   * POST /:orgId/mitigation-libraries/:libraryId/templates
   * Create a mitigation template
   */
  server.post<{
    Params: { orgId: string; libraryId: string };
    Body: z.infer<typeof CreateTemplateSchema>;
  }>(
    "/:orgId/mitigation-libraries/:libraryId/templates",
    {
      config: { authz: { org: "EDITOR" } },
      schema: {
        tags: ["Mitigation Libraries"],
        summary: "Create mitigation template",
      },
    },
    async (request, reply) => {
      const user = getAuthUser(request);
      const { orgId, libraryId } = request.params;
      const body = CreateTemplateSchema.parse(request.body);

      const access = await checkOrganizationAccess(user.id, orgId);
      if (
        !access ||
        !access.role ||
        !["OWNER", "ADMIN", "EDITOR"].includes(access.role)
      ) {
        return sendForbidden(reply, "Editor access required");
      }

      // Verify library ownership
      const library = await prisma.mitigationLibrary.findFirst({
        where: { id: libraryId, organizationId: orgId },
      });
      if (!library) {
        return sendNotFound(reply, "Library");
      }

      const template = await prisma.mitigationTemplate.create({
        data: {
          libraryId,
          name: body.name,
          description: body.description,
          strategy: body.strategy,
          effort: body.effort,
          effectiveness: body.effectiveness,
          applicableThreatTypes: JSON.stringify(body.applicableThreatTypes),
          complianceControls: JSON.stringify(body.complianceControls),
          implementationSteps: JSON.stringify(body.implementationSteps),
          prerequisites: JSON.stringify(body.prerequisites),
          relatedTemplateIds: JSON.stringify(body.relatedTemplateIds),
          tags: JSON.stringify(body.tags),
          createdById: user.id,
        },
      });

      await logAudit({
        scope: "ORGANIZATION",
        action: "CREATE",
        resourceType: "THREAT_LIBRARY",
        resourceId: template.id,
        resourceName: template.name,
        userId: user.id,
        userEmail: user.email || "",
        organizationId: orgId,
        metadata: { type: "mitigation_template", libraryId },
      });

      return sendCreated(reply, {
        id: template.id,
        name: template.name,
        description: template.description,
        strategy: template.strategy,
        effort: template.effort,
        effectiveness: template.effectiveness,
        applicableThreatTypes: body.applicableThreatTypes,
        complianceControls: body.complianceControls,
        implementationSteps: body.implementationSteps,
        prerequisites: body.prerequisites,
        relatedTemplateIds: body.relatedTemplateIds,
        tags: body.tags,
        usageCount: 0,
        createdAt: template.createdAt.toISOString(),
        updatedAt: template.updatedAt.toISOString(),
      });
    },
  );
};

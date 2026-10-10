/**
 * Model Templates Create Routes
 */
import type { FastifyPluginAsync } from "fastify";
import { getPrisma } from "../../../db.js";
import { getAuthUser, checkOrganizationAccess, logAudit } from "../helpers.js";
import { buildCanvasState, normalizeTemplate } from "./template-normalize.js";
import {
  CreateTemplateSchema,
  SaveAsTemplateSchema,
  type CreateTemplateInput,
  type SaveAsTemplateInput,
  type CreateFromTemplateBody,
} from "./schemas.js";
import {
  sendCreated,
  sendNotFound,
  sendForbidden,
} from "../../../utils/api-response.js";

/**
 * Editors may save private templates. A public template is shown to every
 * tenant, so publishing one is an org ADMIN action, as for /marketplace/publish.
 */
function templateAccessError(
  role: string | undefined,
  isPublic: boolean,
): string | null {
  const allowed = isPublic ? ["OWNER", "ADMIN"] : ["OWNER", "ADMIN", "EDITOR"];
  if (role && allowed.includes(role)) return null;
  return isPublic
    ? "Admin access required to publish a public template"
    : "Editor access required";
}

const TEMPLATE_AUTHZ = {
  handler: "org EDITOR for a private template, org ADMIN for a public one",
} as const;

export const createRoutes: FastifyPluginAsync = async (server) => {
  const prisma = await getPrisma();

  /**
   * POST /model-templates
   * Create a new model template from scratch
   */
  server.post<{ Body: CreateTemplateInput }>(
    "/model-templates",
    {
      config: { authz: TEMPLATE_AUTHZ },
      schema: {
        tags: ["Model Templates"],
        summary: "Create model template",
      },
    },
    async (request, reply) => {
      const user = getAuthUser(request);
      const body = CreateTemplateSchema.parse(request.body);

      const access = await checkOrganizationAccess(
        user.id,
        body.organizationId,
      );
      const denied = templateAccessError(access?.role, body.isPublic);
      if (denied) {
        return sendForbidden(reply, denied);
      }

      const template = await prisma.modelTemplate.create({
        data: {
          organizationId: body.organizationId,
          name: body.name,
          description: body.description,
          category: body.category,
          tags: JSON.stringify(body.tags),
          canvasState: JSON.stringify({
            nodes: [],
            edges: [],
            viewport: { x: 0, y: 0, zoom: 1 },
          }),
          components: "[]",
          boundaries: "[]",
          threats: "[]",
          isPublic: body.isPublic,
          createdById: user.id,
        },
      });

      await logAudit({
        scope: "ORGANIZATION",
        action: "CREATE",
        resourceType: "THREAT_MODEL",
        resourceId: template.id,
        resourceName: template.name,
        userId: user.id,
        userEmail: user.email || "",
        organizationId: body.organizationId,
        metadata: { type: "model_template" },
      });

      return sendCreated(reply, {
        id: template.id,
        name: template.name,
        description: template.description,
        category: template.category,
        tags: body.tags,
        isPublic: template.isPublic,
        createdAt: template.createdAt.toISOString(),
      });
    },
  );

  /**
   * POST /threat-models/:modelId/save-as-template
   * Save an existing threat model as a template
   */
  server.post<{ Params: { modelId: string }; Body: SaveAsTemplateInput }>(
    "/threat-models/:modelId/save-as-template",
    {
      config: { authz: TEMPLATE_AUTHZ },
      schema: {
        tags: ["Model Templates"],
        summary: "Save threat model as template",
      },
    },
    async (request, reply) => {
      const user = getAuthUser(request);
      const { modelId } = request.params;
      const body = SaveAsTemplateSchema.parse(request.body);

      const model = await prisma.threatModel.findUnique({
        where: { id: modelId },
        include: {
          project: { select: { organizationId: true } },
          components: true,
          boundaries: true,
          threats: body.includeThreats
            ? { include: { mitigations: true } }
            : false,
        },
      });

      if (!model) {
        return sendNotFound(reply, "Threat model");
      }

      const orgId = model.project.organizationId;
      const access = await checkOrganizationAccess(user.id, orgId);
      const denied = templateAccessError(access?.role, body.isPublic);
      if (denied) {
        return sendForbidden(reply, denied);
      }

      const components = model.components.map((c) => ({
        type: c.type,
        name: c.name,
        description: c.description,
        trustLevel: c.trustLevel,
        properties: JSON.parse(c.properties),
        positionX: c.positionX,
        positionY: c.positionY,
      }));

      const boundaries = model.boundaries.map((b) => ({
        name: b.name,
        trustLevel: b.trustLevel,
        description: b.description,
        positionX: b.positionX,
        positionY: b.positionY,
        width: b.width,
        height: b.height,
      }));

      const threats =
        body.includeThreats && model.threats
          ? model.threats.map((t: Record<string, unknown>) => ({
              name: t.name,
              description: t.description,
              strideCategories: JSON.parse(t.strideCategories as string),
              severity: t.severity,
              category: t.category,
              complianceControls: JSON.parse(t.complianceControls as string),
              cweIds: JSON.parse(t.cweIds as string),
              owaspIds: JSON.parse(t.owaspIds as string),
              mitigations: (
                t.mitigations as Array<Record<string, unknown>> | undefined
              )?.map((m) => ({
                description: m.description,
                strategy: m.strategy,
                priority: m.priority,
              })),
            }))
          : [];

      const template = await prisma.modelTemplate.create({
        data: {
          organizationId: body.isPublic ? null : orgId,
          name: body.name,
          description: body.description,
          category: body.category,
          tags: JSON.stringify(body.tags),
          thumbnail: null,
          canvasState: model.canvasState,
          components: JSON.stringify(components),
          boundaries: JSON.stringify(boundaries),
          threats: JSON.stringify(threats),
          isPublic: body.isPublic,
          createdById: user.id,
        },
      });

      await logAudit({
        scope: "MODEL",
        action: "CREATE",
        resourceType: "THREAT_MODEL",
        resourceId: template.id,
        resourceName: template.name,
        userId: user.id,
        userEmail: user.email || "",
        organizationId: orgId,
        modelId,
        metadata: { type: "model_template", sourceModelId: modelId },
      });

      return sendCreated(reply, {
        id: template.id,
        name: template.name,
        description: template.description,
        category: template.category,
        tags: body.tags,
        isPublic: template.isPublic,
        componentCount: components.length,
        boundaryCount: boundaries.length,
        threatCount: threats.length,
        createdAt: template.createdAt.toISOString(),
      });
    },
  );

  /**
   * POST /threat-models/from-template/:templateId
   * Create a new threat model from a template
   */
  server.post<{ Params: { templateId: string }; Body: CreateFromTemplateBody }>(
    "/threat-models/from-template/:templateId",
    {
      schema: {
        tags: ["Model Templates"],
        summary: "Create threat model from template",
      },
      config: {
        authz: {
          handler:
            "ACTIVE EDITOR+ of the org owning body projectId; template must be public or owned by that org",
        },
      },
    },
    async (request, reply) => {
      const user = getAuthUser(request);
      const { templateId } = request.params;
      const { projectId, name } = request.body;

      const template = await prisma.modelTemplate.findUnique({
        where: { id: templateId },
      });
      if (!template) {
        return sendNotFound(reply, "Template");
      }

      const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { organizationId: true },
      });
      if (!project) {
        return sendNotFound(reply, "Project");
      }

      const access = await checkOrganizationAccess(
        user.id,
        project.organizationId,
      );
      if (
        !access ||
        !access.role ||
        !["OWNER", "ADMIN", "EDITOR"].includes(access.role)
      ) {
        return sendForbidden(reply, "Editor access required");
      }

      if (
        !template.isPublic &&
        template.organizationId !== project.organizationId
      ) {
        return sendForbidden(reply, "Template not accessible");
      }

      const { components, boundaries, threats } = normalizeTemplate(template);
      const stamp = Date.now();

      // One transaction: a template that fails to instantiate must not leave an
      // empty model behind.
      const threatModel = await prisma.$transaction(async (tx) => {
        const model = await tx.threatModel.create({
          data: {
            projectId,
            name,
            canvasState:
              buildCanvasState(template.canvasState, boundaries) ?? undefined,
            createdById: user.id,
          },
        });

        for (let i = 0; i < components.length; i++) {
          const c = components[i];
          await tx.component.create({
            data: {
              threatModelId: model.id,
              nodeId: c.templateId ?? `component-${stamp}-${i}`,
              type: c.type,
              name: c.name,
              description: c.description,
              trustLevel: c.trustLevel,
              properties: JSON.stringify(c.properties),
              positionX: c.positionX,
              positionY: c.positionY,
            },
          });
        }

        for (let i = 0; i < boundaries.length; i++) {
          const b = boundaries[i];
          await tx.boundary.create({
            data: {
              threatModelId: model.id,
              nodeId: `boundary-${stamp}-${i}`,
              name: b.name,
              trustLevel: b.trustLevel,
              description: b.description,
              positionX: b.positionX,
              positionY: b.positionY,
              width: b.width,
              height: b.height,
            },
          });
        }

        for (const t of threats) {
          const threat = await tx.threat.create({
            data: {
              threatModelId: model.id,
              // Threat points at the canvas node id, which is the component's nodeId.
              componentNodeId: t.componentTemplateId,
              name: t.name,
              description: t.description,
              strideCategories: JSON.stringify(t.strideCategories),
              severity: t.severity,
              category: t.category,
              complianceControls: JSON.stringify(t.complianceControls),
              cweIds: JSON.stringify(t.cweIds),
              owaspIds: JSON.stringify(t.owaspIds),
              createdById: user.id,
            },
          });

          for (const m of t.mitigations) {
            await tx.mitigation.create({
              data: {
                threatId: threat.id,
                description: m.description,
                strategy: m.strategy as
                  | "PREVENTION"
                  | "DETECTION"
                  | "RESPONSE"
                  | "RECOVERY"
                  | "DETERRENCE",
                priority: m.priority as "CRITICAL" | "HIGH" | "MEDIUM" | "LOW",
                createdById: user.id,
              },
            });
          }
        }

        return model;
      });

      await prisma.modelTemplate.update({
        where: { id: templateId },
        data: { usageCount: { increment: 1 } },
      });

      await logAudit({
        scope: "MODEL",
        action: "CREATE",
        resourceType: "THREAT_MODEL",
        resourceId: threatModel.id,
        resourceName: threatModel.name,
        userId: user.id,
        userEmail: user.email || "",
        organizationId: project.organizationId,
        modelId: threatModel.id,
        metadata: {
          type: "from_template",
          templateId,
          templateName: template.name,
        },
      });

      return sendCreated(reply, {
        id: threatModel.id,
        name: threatModel.name,
        projectId,
        componentCount: components.length,
        boundaryCount: boundaries.length,
        threatCount: threats.length,
        createdAt: threatModel.createdAt.toISOString(),
      });
    },
  );
};

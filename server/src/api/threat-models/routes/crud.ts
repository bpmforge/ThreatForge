/**
 * Threat Model API - CRUD Routes
 */
import type { FastifyPluginAsync, FastifyReply } from "fastify";
import { getPrisma } from "../../../db.js";
import { logAudit } from "../../../services/audit.js";
import {
  canPerformAction,
  checkProjectAccess,
  requireOrgRole,
} from "../../../services/access-control/access-control-service.js";
import { syncCanvasToDatabase } from "../../../services/canvas-sync.js";
import {
  CreateThreatModelSchema,
  UpdateThreatModelSchema,
} from "../schemas.js";
import {
  getAuthUser,
  canAccessThreatModel,
  authorizeModelExport,
  CREATOR_ROLES,
  firstEditableProjectId,
  resolveModelTargetProject,
} from "../helpers.js";
import logger from "../../../utils/logger.js";
import {
  sendSuccess,
  sendCreated,
  sendNotFound,
  sendBadRequest,
  sendForbidden,
  sendNoContent,
} from "../../../utils/api-response.js";
import { requireScopes } from "../../../middleware/auth.js";
import { buildReportData } from "../../../services/reports/report-data-builder.js";
import { generateDocxBuffer } from "../../../services/reports/docx-generator.js";
import { loadBrandingForModel } from "../../../services/reports/branding.js";
import { routeAuthz } from "../../../middleware/authz-policy.js";

const MODEL_VIEW = routeAuthz({ model: "view" });

/** Canvas state shape for type safety */
interface CanvasStateShape {
  nodes: unknown[];
  edges: unknown[];
  viewport?: { x: number; y: number; zoom: number };
}

/** Default empty canvas state */
const DEFAULT_CANVAS_STATE: CanvasStateShape = {
  nodes: [],
  edges: [],
  viewport: { x: 0, y: 0, zoom: 1 },
};

/** Safely parse canvas state JSON, returning default if null/undefined */
function parseCanvasState(json: string | null | undefined): CanvasStateShape {
  if (!json) return DEFAULT_CANVAS_STATE;
  try {
    const parsed = JSON.parse(json);
    // Ensure it has the expected shape
    if (parsed && Array.isArray(parsed.nodes) && Array.isArray(parsed.edges)) {
      return parsed as CanvasStateShape;
    }
    return DEFAULT_CANVAS_STATE;
  } catch {
    // parse fallback — intentionally silent
    return DEFAULT_CANVAS_STATE;
  }
}

/**
 * Where POST /api/threat-models puts a new model. With a projectId, or when
 * the caller has an org where they are EDITOR+, see resolveModelTargetProject.
 * A first-time user with no membership at all gets a personal org and
 * project. Anyone else — VIEWER-only, or every membership SUSPENDED — is
 * refused (403) rather than handed a new org. Sends the refusal, returns null.
 */
async function resolveNewModelProject(
  reply: FastifyReply,
  user: { id: string; name?: string | null; email?: string | null },
  name: string,
  projectId: string | undefined,
): Promise<string | null> {
  if (projectId) return resolveModelTargetProject(reply, user.id, projectId);
  const existing = await firstEditableProjectId(user.id);
  if (existing) return existing;

  const prisma = await getPrisma();
  const editorMembership = await prisma.membership.findFirst({
    where: { userId: user.id, status: "ACTIVE", role: { in: CREATOR_ROLES } },
    select: { organizationId: true },
  });
  let orgId = editorMembership?.organizationId;
  if (!orgId) {
    // nosemgrep: tf-membership-query-missing-status -- any row (any status) means not a first-time user
    const anyMembership = await prisma.membership.findFirst({
      where: { userId: user.id },
      select: { id: true },
    });
    if (anyMembership) {
      sendForbidden(
        reply,
        "Creating threat models requires EDITOR or above in an active organization membership",
      );
      return null;
    }
    const org = await prisma.organization.create({
      data: {
        name: `${user.name || user.email}'s Organization`,
        slug: `org-${user.id.slice(0, 8)}`,
      },
    });
    await prisma.membership.create({
      data: { userId: user.id, organizationId: org.id, role: "OWNER" },
    });
    orgId = org.id;
  }
  const project = await prisma.project.create({
    data: { name, organizationId: orgId, createdById: user.id },
  });
  return project.id;
}

export const crudRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /api/threat-models/:id
   * Get a single threat model with full canvas state
   */
  fastify.get<{ Params: { id: string } }>(
    "/api/threat-models/:id",
    MODEL_VIEW,
    async (request, reply) => {
      const user = getAuthUser(request);
      const prisma = await getPrisma();
      const { id } = request.params;

      const hasAccess = await canAccessThreatModel(user.id, id);
      if (!hasAccess) {
        return sendNotFound(reply, "Threat model");
      }

      const model = await prisma.threatModel.findUnique({
        where: { id },
        include: {
          project: { select: { id: true, name: true } },
          components: true,
          connections: true,
          boundaries: true,
          threats: { include: { mitigations: true } },
        },
      });

      if (!model) {
        return sendNotFound(reply, "Threat model");
      }

      return sendSuccess(reply, {
        ...model,
        projectName: model.project?.name || null,
        canvasState: parseCanvasState(model.canvasState),
      });
    },
  );

  /**
   * POST /api/threat-models
   * Create a new threat model
   */
  fastify.post(
    "/api/threat-models",
    {
      config: {
        authz: { handler: "EDITOR+ in the target project's organization" },
      },
      preHandler: requireScopes(["write:models"]),
    },
    async (request, reply) => {
      const user = getAuthUser(request);
      const prisma = await getPrisma();
      const parseResult = CreateThreatModelSchema.safeParse(request.body);

      if (!parseResult.success) {
        return sendBadRequest(reply, "Validation failed", {
          details: parseResult.error.flatten(),
        });
      }

      const { name, projectId, canvasState } = parseResult.data;
      const targetProjectId = await resolveNewModelProject(
        reply,
        user,
        name,
        projectId,
      );
      if (!targetProjectId) return reply;

      const model = await prisma.threatModel.create({
        data: {
          name,
          projectId: targetProjectId,
          createdById: user.id,
          canvasState: canvasState ? JSON.stringify(canvasState) : undefined,
        },
        include: { project: { select: { organizationId: true } } },
      });

      await logAudit({
        action: "CREATE",
        resourceType: "THREAT_MODEL",
        resourceId: model.id,
        resourceName: model.name,
        userId: user.id,
        userEmail: user.email || "unknown",
        organizationId: model.project.organizationId,
        metadata: { ip: request.ip, userAgent: request.headers["user-agent"] },
      });

      return sendCreated(reply, {
        ...model,
        canvasState: parseCanvasState(model.canvasState),
      });
    },
  );

  /**
   * PUT /api/threat-models/:id
   * Update a threat model
   */
  fastify.patch<{ Params: { id: string } }>(
    "/api/threat-models/:id",
    {
      config: { authz: { model: "edit" } },
      preHandler: requireScopes(["write:models"]),
    },
    async (request, reply) => {
      const user = getAuthUser(request);
      const prisma = await getPrisma();
      const { id } = request.params;

      const actionCheck = await canPerformAction(user.id, id, "edit");
      if (!actionCheck.allowed) {
        if (!actionCheck.access?.hasAccess) {
          return sendNotFound(reply, "Threat model");
        }
        return sendForbidden(reply, actionCheck.error);
      }

      const parseResult = UpdateThreatModelSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          error: "Validation failed",
          details: parseResult.error.flatten(),
        });
      }

      const { name, canvasState, projectId, status, reanalysisSchedule } =
        parseResult.data;

      const oldModel = await prisma.threatModel.findUnique({
        where: { id },
        select: {
          name: true,
          projectId: true,
          status: true,
          canvasState: true,
          project: { select: { organizationId: true, name: true } },
        },
      });
      if (!oldModel) {
        return sendNotFound(reply, "Threat model");
      }

      // A move inside the org needs an active EDITOR there. A move to another
      // org changes who owns the model, so it needs ADMIN/OWNER in both orgs.
      // Guests never move.
      if (projectId && projectId !== oldModel.projectId) {
        if (actionCheck.access?.isGuest) {
          return sendForbidden(reply, "Guests cannot move threat models");
        }
        const target = await checkProjectAccess(user.id, projectId);
        if (!target.hasAccess || !target.organizationId) {
          return sendForbidden(reply, "Access denied to target project");
        }
        const sourceOrgId = oldModel.project.organizationId;
        const minimumRole =
          target.organizationId === sourceOrgId ? "EDITOR" : "ADMIN";
        for (const orgId of new Set([sourceOrgId, target.organizationId])) {
          const roleCheck = await requireOrgRole(user.id, orgId, minimumRole);
          if (!roleCheck.allowed) {
            return sendForbidden(
              reply,
              minimumRole === "ADMIN"
                ? "Moving a threat model to another organization requires ADMIN in both"
                : "Moving a threat model requires EDITOR in its organization",
            );
          }
        }
      }

      const model = await prisma.threatModel.update({
        where: { id },
        data: {
          ...(name && { name }),
          ...(projectId && { projectId }),
          ...(status && { status }),
          ...(canvasState && { canvasState: JSON.stringify(canvasState) }),
          ...(reanalysisSchedule && { reanalysisSchedule }),
          version: { increment: 1 },
        },
        include: {
          project: { select: { id: true, name: true, organizationId: true } },
        },
      });

      if (status && status !== oldModel.status) {
        try {
          const currentCanvasState =
            canvasState || parseCanvasState(oldModel.canvasState);
          await syncCanvasToDatabase(id, currentCanvasState);
        } catch (syncError) {
          logger.error(
            { data: syncError },
            "Failed to sync canvas on status change:",
          );
        }
      }

      const changes: Record<string, { old: string; new: string }> = {};
      if (name && name !== oldModel.name) {
        changes.name = { old: oldModel.name, new: name };
      }
      if (projectId && projectId !== oldModel.projectId) {
        changes.project = {
          old: oldModel.project.name,
          new: model.project.name,
        };
      }

      if (Object.keys(changes).length > 0) {
        await logAudit({
          action: "UPDATE",
          resourceType: "THREAT_MODEL",
          resourceId: model.id,
          resourceName: model.name,
          userId: user.id,
          userEmail: user.email || "unknown",
          organizationId: model.project.organizationId,
          changes,
          metadata: {
            ip: request.ip,
            userAgent: request.headers["user-agent"],
          },
        });
      }

      return sendSuccess(reply, {
        ...model,
        canvasState: parseCanvasState(model.canvasState),
      });
    },
  );

  /**
   * DELETE /api/threat-models/:id
   * Delete a threat model
   */
  fastify.delete<{ Params: { id: string } }>(
    "/api/threat-models/:id",
    {
      config: { authz: { model: "delete" } },
      preHandler: requireScopes(["write:models"]),
    },
    async (request, reply) => {
      const user = getAuthUser(request);
      const prisma = await getPrisma();
      const { id } = request.params;

      const actionCheck = await canPerformAction(user.id, id, "delete");
      if (!actionCheck.allowed) {
        if (!actionCheck.access?.hasAccess) {
          return sendNotFound(reply, "Threat model");
        }
        return sendForbidden(reply, actionCheck.error);
      }

      // Use transaction to ensure delete and audit log are atomic
      await prisma.$transaction(async (tx) => {
        const model = await tx.threatModel.findUnique({
          where: { id },
          select: { name: true, project: { select: { organizationId: true } } },
        });

        if (!model) {
          throw new Error("Model not found");
        }

        await tx.threatModel.delete({ where: { id } });

        // Create audit log within transaction
        await tx.auditLog.create({
          data: {
            scope: "SYSTEM",
            action: "DELETE",
            resourceType: "THREAT_MODEL",
            resourceId: id,
            resourceName: model.name,
            userId: user.id,
            userEmail: user.email || "unknown",
            organizationId: model.project.organizationId,
            metadata: JSON.stringify({
              ip: request.ip,
              userAgent: request.headers["user-agent"],
            }),
          },
        });
      });

      return sendNoContent(reply);
    },
  );

  /**
   * GET /api/threat-models/:id/branding
   * Org logo + brand colours for client-rendered (PDF) reports.
   */
  fastify.get<{ Params: { id: string } }>(
    "/api/threat-models/:id/branding",
    MODEL_VIEW,
    async (request, reply) => {
      const user = getAuthUser(request);
      const { id } = request.params;
      if (!(await canAccessThreatModel(user.id, id))) {
        return sendNotFound(reply, "Threat model");
      }
      return sendSuccess(reply, (await loadBrandingForModel(id)) ?? {});
    },
  );

  /**
   * GET /api/threat-models/:id/report.docx
   * Download a server-generated Word document report for a threat model.
   */
  fastify.get<{ Params: { id: string } }>(
    "/api/threat-models/:id/report.docx",
    MODEL_VIEW,
    async (request, reply) => {
      const user = getAuthUser(request);
      const { id } = request.params;

      if (!(await authorizeModelExport(reply, user.id, id))) {
        return reply;
      }

      const reportData = await buildReportData(id, user.id);
      if (!reportData) {
        return sendNotFound(reply, "Threat model");
      }

      const buffer = await generateDocxBuffer(reportData);
      const safeName = reportData.modelName.replace(/[^a-zA-Z0-9]/g, "_");

      reply.header(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      );
      reply.header(
        "Content-Disposition",
        `attachment; filename="${safeName}-report.docx"`,
      );
      return reply.send(buffer);
    },
  );
};

/**
 * Requirements API — CRUD routes
 *
 * All routes are scoped to a threat model.
 * Customers can store requirements from SRS/SAD docs, CSV imports, compliance
 * frameworks, or manual entry, then link them to mitigations for traceability.
 */
import type { FastifyPluginAsync, FastifyReply } from "fastify";
import { getPrisma } from "../../../db.js";
import {
  getAuthUser,
  canAccessThreatModel,
  authorizeModelAction,
} from "../helpers.js";
import {
  sendSuccess,
  sendCreated,
  sendNotFound,
  sendBadRequest,
  sendNoContent,
} from "../../../utils/api-response.js";
import {
  CreateRequirementSchema,
  UpdateRequirementSchema,
  BulkCreateRequirementsSchema,
} from "../schemas/requirements.js";
import { upsertRequirementVersion } from "../../../services/requirements/versioning.js";
import { routeAuthz } from "../../../middleware/authz-policy.js";

const MODEL_VIEW = routeAuthz({ model: "view" });
const MODEL_EDIT = routeAuthz({ model: "edit" });

/**
 * A requirement of the model, when the caller may edit that model. Otherwise
 * sends 404 / 403 and returns null.
 */
async function editableRequirement(
  reply: FastifyReply,
  userId: string,
  modelId: string,
  id: string,
) {
  if (!(await authorizeModelAction(reply, userId, modelId, "edit"))) {
    return null;
  }
  const prisma = await getPrisma();
  const requirement = await prisma.requirement.findFirst({
    where: { id, threatModelId: modelId },
  });
  if (!requirement) sendNotFound(reply, "Requirement");
  return requirement;
}

export const requirementsRoutes: FastifyPluginAsync = async (fastify) => {
  const prisma = await getPrisma();

  /** Include shape reused across GET responses */
  const requirementInclude = {
    _count: { select: { mitigations: true } },
    mitigations: {
      select: {
        mitigationId: true,
        mitigation: {
          select: {
            id: true,
            description: true,
            status: true,
            threat: { select: { id: true, name: true, threatModelId: true } },
          },
        },
      },
    },
  } as const;

  /**
   * GET /api/threat-models/:modelId/requirements
   * List all requirements for a threat model, with mitigation coverage.
   */
  fastify.get<{
    Params: { modelId: string };
    Querystring: {
      category?: string;
      source?: string;
      includeHistory?: string;
    };
  }>(
    "/api/threat-models/:modelId/requirements",
    MODEL_VIEW,
    async (request, reply) => {
      const user = getAuthUser(request);
      const { modelId } = request.params;

      const hasAccess = await canAccessThreatModel(user.id, modelId);
      if (!hasAccess) return sendNotFound(reply, "Threat model");

      const includeHistory = request.query.includeHistory === "true";
      const where: Record<string, unknown> = { threatModelId: modelId };
      if (!includeHistory) where.supersededAt = null;
      if (request.query.category) where.category = request.query.category;
      if (request.query.source) where.source = request.query.source;

      const [requirements, total] = await Promise.all([
        prisma.requirement.findMany({
          where,
          include: requirementInclude,
          orderBy: [{ source: "asc" }, { reqId: "asc" }],
        }),
        prisma.requirement.count({ where }),
      ]);

      return sendSuccess(reply, requirements, { total });
    },
  );

  /**
   * POST /api/threat-models/:modelId/requirements
   * Create a single requirement manually.
   */
  fastify.post<{ Params: { modelId: string }; Body: unknown }>(
    "/api/threat-models/:modelId/requirements",
    MODEL_EDIT,
    async (request, reply) => {
      const user = getAuthUser(request);
      const { modelId } = request.params;

      if (!(await authorizeModelAction(reply, user.id, modelId, "edit"))) {
        return reply;
      }

      const parsed = CreateRequirementSchema.safeParse(request.body);
      if (!parsed.success) {
        return sendBadRequest(
          reply,
          parsed.error.issues[0]?.message ?? "Invalid body",
        );
      }
      const data = parsed.data;

      // Check uniqueness against current (non-superseded) versions only
      const existing = await prisma.requirement.findFirst({
        where: {
          threatModelId: modelId,
          reqId: data.reqId,
          supersededAt: null,
        },
      });
      if (existing) {
        return sendBadRequest(
          reply,
          `Requirement ID '${data.reqId}' already exists in this model`,
        );
      }

      const created = await prisma.requirement.create({
        data: { ...data, threatModelId: modelId, createdById: user.id },
      });
      const req = await prisma.requirement.update({
        where: { id: created.id },
        data: { requirementFamilyId: created.id },
        include: requirementInclude,
      });

      return sendCreated(reply, req);
    },
  );

  /**
   * PATCH /api/threat-models/:modelId/requirements/:id
   * Update a requirement's text, category, or docId.
   */
  fastify.patch<{ Params: { modelId: string; id: string }; Body: unknown }>(
    "/api/threat-models/:modelId/requirements/:id",
    MODEL_EDIT,
    async (request, reply) => {
      const user = getAuthUser(request);
      const { modelId, id } = request.params;

      const existing = await editableRequirement(reply, user.id, modelId, id);
      if (!existing) return reply;

      const parsed = UpdateRequirementSchema.safeParse(request.body);
      if (!parsed.success) {
        return sendBadRequest(
          reply,
          parsed.error.issues[0]?.message ?? "Invalid body",
        );
      }

      // When reviewStatus is being changed, stamp reviewer + timestamp
      // so the audit trail records who accepted/rejected the suggestion.
      const data: Record<string, unknown> = { ...parsed.data };
      if (
        parsed.data.reviewStatus &&
        parsed.data.reviewStatus !== existing.reviewStatus
      ) {
        data.reviewedAt = new Date();
        data.reviewedById = user.id;
      }

      const updated = await prisma.requirement.update({
        where: { id },
        data,
        include: requirementInclude,
      });

      return sendSuccess(reply, updated);
    },
  );

  /**
   * DELETE /api/threat-models/:modelId/requirements/:id
   * Delete a requirement (cascades MitigationRequirement links).
   */
  fastify.delete<{ Params: { modelId: string; id: string } }>(
    "/api/threat-models/:modelId/requirements/:id",
    MODEL_EDIT,
    async (request, reply) => {
      const user = getAuthUser(request);
      const { modelId, id } = request.params;

      const existing = await editableRequirement(reply, user.id, modelId, id);
      if (!existing) return reply;

      await prisma.requirement.delete({ where: { id } });
      return sendNoContent(reply);
    },
  );

  /**
   * POST /api/threat-models/:modelId/requirements/bulk
   * Bulk-create requirements (used by document import pipeline).
   * Skips duplicates silently.
   */
  fastify.post<{ Params: { modelId: string }; Body: unknown }>(
    "/api/threat-models/:modelId/requirements/bulk",
    MODEL_EDIT,
    async (request, reply) => {
      const user = getAuthUser(request);
      const { modelId } = request.params;

      if (!(await authorizeModelAction(reply, user.id, modelId, "edit"))) {
        return reply;
      }

      const parsed = BulkCreateRequirementsSchema.safeParse(request.body);
      if (!parsed.success) {
        return sendBadRequest(
          reply,
          parsed.error.issues[0]?.message ?? "Invalid body",
        );
      }

      const batchSource = parsed.data.source;
      let created = 0;
      let superseded = 0;
      let unchanged = 0;

      for (const r of parsed.data.requirements) {
        const result = await upsertRequirementVersion(prisma, {
          reqId: r.reqId,
          text: r.text,
          category: r.category ?? null,
          docId: r.docId ?? null,
          documentId: r.documentId ?? null,
          source: batchSource ?? r.source,
          frameworkId: r.frameworkId ?? null,
          threatModelId: modelId,
          createdById: user.id,
        });
        if (result.outcome === "created") created++;
        else if (result.outcome === "superseded") superseded++;
        else unchanged++;
      }

      return sendSuccess(reply, {
        created,
        superseded,
        unchanged,
        total: parsed.data.requirements.length,
        skipped: unchanged,
      });
    },
  );
};

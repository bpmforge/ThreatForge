/**
 * Threat API routes.
 *
 * CRUD operations for threats within a threat model.
 * All routes require authentication and verify access via organization membership.
 */
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getPrisma } from "../db.js";
import { NotFoundError, threatRepository } from "../repositories/index.js";
import {
  sendSuccess,
  sendCreated,
  sendList,
  sendNoContent,
  sendBadRequest,
  sendNotFound,
  sendValidationError,
  parsePagination,
} from "../utils/api-response.js";
import { getAuthUser } from "../utils/auth-helpers.js";
import { logAudit } from "../services/audit.js";
import logger from "../utils/logger.js";
import { dispatchWebhookEvent } from "../services/webhooks/webhook-dispatcher.js";
import { reviewThreat } from "../services/threat-review/review-service.js";
import { getAccessCache } from "../utils/access-cache.js";
import { getOrgIdFromModel } from "../services/access-control/access-control-service.js";
import { requireScopes } from "../middleware/auth.js";
import {
  authorizeModelAction,
  requireActiveOrgMemberOfModel,
} from "./threat-models/helpers.js";
import { refreshThreatBusinessRisk } from "../services/risk/threat-business-risk.js";
import { routeAuthz } from "../middleware/authz-policy.js";

/** STRIDE categories */
const StrideCategoryEnum = z.enum([
  "SPOOFING",
  "TAMPERING",
  "REPUDIATION",
  "INFORMATION_DISCLOSURE",
  "DENIAL_OF_SERVICE",
  "ELEVATION_OF_PRIVILEGE",
]);

/** Severity levels */
const SeverityEnum = z.enum(["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"]);

/** Threat status */
const ThreatStatusEnum = z.enum([
  "OPEN",
  "MITIGATED",
  "ACCEPTED",
  "NOT_APPLICABLE",
]);

/** Create threat request body - now supports multiple STRIDE categories */
const CreateThreatSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  strideCategories: z
    .array(StrideCategoryEnum)
    .min(1, "At least one STRIDE category is required"),
  severity: SeverityEnum.default("MEDIUM"),
  category: z.string().max(100).optional(), // Custom organization category
  componentNodeId: z.string().optional(), // React Flow node ID
  connectionEdgeId: z.string().optional(), // React Flow edge ID
});

/** Update threat request body */
const UpdateThreatSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  strideCategories: z.array(StrideCategoryEnum).min(1).optional(),
  severity: SeverityEnum.optional(),
  status: ThreatStatusEnum.optional(),
  category: z.string().max(100).optional().nullable(), // Custom organization category
  manuallyEdited: z.boolean().optional(), // Reset to AI passes false; omitted on normal edits
  assigneeId: z.string().nullable().optional(), // Assignee user ID
  likelihood: z.number().min(0).max(1).nullable().optional(), // 0.0–1.0 for business risk scoring
});

/** Helper to parse strideCategories from DB JSON string */
function parseStrideCategories(threat: {
  strideCategories: string;
  [key: string]: unknown;
}) {
  return {
    ...threat,
    strideCategories: JSON.parse(threat.strideCategories) as string[],
  };
}

export async function threatRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/threat-models/:modelId/threats
   * List all threats for a threat model
   * Supports pagination via page/limit query params
   */
  fastify.get<{
    Params: { modelId: string };
    Querystring: {
      page?: string;
      limit?: string;
      severity?: string;
      status?: string;
      search?: string;
      /** ISO-8601 timestamp — show only threats created/updated after this point. */
      since?: string;
      /** "true" → resolve `since` from the most recent attestation (#61). */
      sinceLastSignOff?: string;
    };
  }>(
    "/api/threat-models/:modelId/threats",
    routeAuthz({ model: "view" }),
    async (request, reply) => {
      const user = getAuthUser(request);
      const { modelId } = request.params;
      const { severity, status, search } = request.query;

      // Check access
      const hasAccess = await getAccessCache(request).canAccessThreatModel(
        user.id,
        modelId,
      );
      if (!hasAccess) {
        return sendNotFound(reply, "Threat model", modelId);
      }

      // Resolve the delta-since baseline (#61). Explicit `since` wins; otherwise
      // `sinceLastSignOff=true` looks up the most recent attestation. If the
      // model has no attestation yet, the filter is a no-op (returns all).
      let since: Date | undefined;
      if (request.query.since) {
        const parsed = new Date(request.query.since);
        if (!isNaN(parsed.getTime())) since = parsed;
      } else if (request.query.sinceLastSignOff === "true") {
        const prisma = await getPrisma();
        const latest = await prisma.threatModelAttestation.findFirst({
          where: { threatModelId: modelId },
          orderBy: { attestedAt: "desc" },
          select: { attestedAt: true },
        });
        if (latest) since = latest.attestedAt;
      }

      // Use repository for paginated list (centralizes query logic)
      const { page, limit } = parsePagination(request.query);
      const result = await threatRepository.list({
        threatModelId: modelId,
        page,
        limit,
        severity:
          severity &&
          ["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"].includes(severity)
            ? (severity as import("@prisma/client").Severity)
            : undefined,
        status:
          status &&
          [
            "IDENTIFIED",
            "ACCEPTED",
            "MITIGATED",
            "TRANSFERRED",
            "AVOIDED",
          ].includes(status)
            ? (status as import("@prisma/client").ThreatStatus)
            : undefined,
        search,
        since,
      });

      return sendList(reply, result.data, {
        page: result.pagination.page,
        limit: result.pagination.limit,
        total: result.pagination.total,
      });
    },
  );

  /**
   * GET /api/threat-models/:modelId/threats/:id
   * Get a single threat with mitigations
   */
  fastify.get<{ Params: { modelId: string; id: string } }>(
    "/api/threat-models/:modelId/threats/:id",
    routeAuthz({ model: "view" }),
    async (request, reply) => {
      const user = getAuthUser(request);
      const { modelId, id } = request.params;

      // Check access
      const hasAccess = await getAccessCache(request).canAccessThreatModel(
        user.id,
        modelId,
      );
      if (!hasAccess) {
        return sendNotFound(reply, "Threat model", modelId);
      }

      const threat = await threatRepository.getById(id, modelId);

      if (!threat) {
        return sendNotFound(reply, "Threat", id);
      }

      return sendSuccess(reply, threat);
    },
  );

  /**
   * POST /api/threat-models/:modelId/threats
   * Create a new threat
   */
  fastify.post<{ Params: { modelId: string } }>(
    "/api/threat-models/:modelId/threats",
    {
      preHandler: requireScopes(["write:threats"]),
      config: {
        authz: { model: "edit" },
      },
    },
    async (request, reply) => {
      const user = getAuthUser(request);
      const { modelId } = request.params;
      const parseResult = CreateThreatSchema.safeParse(request.body);

      if (!parseResult.success) {
        const errors = parseResult.error.issues.map((e) => ({
          field: e.path.join("."),
          message: e.message,
        }));
        return sendValidationError(reply, errors);
      }

      // Check access
      // Writing threats needs edit on the model; viewers and commenters
      // only read.
      if (!(await authorizeModelAction(reply, user.id, modelId, "edit"))) {
        return reply;
      }

      const {
        name,
        description,
        strideCategories,
        severity,
        componentNodeId,
        connectionEdgeId,
      } = parseResult.data;

      const threat = await threatRepository.create({
        name,
        description,
        strideCategories,
        severity,
        threatModelId: modelId,
        componentNodeId,
        connectionEdgeId,
        createdById: user.id,
      });

      // Audit + webhook
      const orgId = await getOrgIdFromModel(modelId);
      if (orgId) {
        logAudit({
          action: "CREATE",
          resourceType: "THREAT",
          resourceId: threat.id,
          resourceName: threat.name,
          userId: user.id,
          userEmail: user.email || "unknown",
          organizationId: orgId,
          metadata: { severity: threat.severity, modelId },
        }).catch((err) =>
          logger.warn({ err }, "Audit log failed — non-critical"),
        );
        dispatchWebhookEvent(orgId, "threat.created", {
          threatId: threat.id,
          name: threat.name,
          severity: threat.severity,
          modelId,
        });
      }

      return sendCreated(reply, threat);
    },
  );

  /**
   * PATCH /api/threat-models/:modelId/threats/:id
   * Update a threat
   */
  fastify.patch<{ Params: { modelId: string; id: string } }>(
    "/api/threat-models/:modelId/threats/:id",
    {
      preHandler: requireScopes(["write:threats"]),
      config: {
        authz: { model: "edit" },
      },
    },
    async (request, reply) => {
      const user = getAuthUser(request);
      const { modelId, id } = request.params;
      const parseResult = UpdateThreatSchema.safeParse(request.body);

      if (!parseResult.success) {
        const errors = parseResult.error.issues.map((e) => ({
          field: e.path.join("."),
          message: e.message,
        }));
        return sendValidationError(reply, errors);
      }

      // Check access
      // Writing threats needs edit on the model; viewers and commenters
      // only read.
      if (!(await authorizeModelAction(reply, user.id, modelId, "edit"))) {
        return reply;
      }

      if (
        !(await requireActiveOrgMemberOfModel(
          reply,
          modelId,
          parseResult.data.assigneeId,
        ))
      ) {
        return reply;
      }

      // Update via repository (handles existence check + JSON serialization)
      try {
        const threat = await threatRepository.update(
          id,
          modelId,
          parseResult.data,
        );

        const body = parseResult.data;
        if (body.severity !== undefined || body.likelihood !== undefined) {
          await refreshThreatBusinessRisk(id, modelId);
        }

        // Audit + webhook
        const orgId = await getOrgIdFromModel(modelId);
        if (orgId) {
          logAudit({
            action: "UPDATE",
            resourceType: "THREAT",
            resourceId: threat.id,
            resourceName: threat.name,
            userId: user.id,
            userEmail: user.email || "unknown",
            organizationId: orgId,
            metadata: { modelId },
          }).catch((err) =>
            logger.warn({ err }, "Audit log failed — non-critical"),
          );
          dispatchWebhookEvent(orgId, "threat.updated", {
            threatId: threat.id,
            name: threat.name,
            severity: threat.severity,
            modelId,
          });
        }

        return sendSuccess(reply, threat);
      } catch (err) {
        if (err instanceof NotFoundError) {
          return sendNotFound(reply, "Threat", id);
        }
        throw err;
      }
    },
  );

  /**
   * DELETE /api/threat-models/:modelId/threats/:id
   * Delete a threat
   */
  fastify.delete<{ Params: { modelId: string; id: string } }>(
    "/api/threat-models/:modelId/threats/:id",
    {
      preHandler: requireScopes(["write:threats"]),
      config: {
        authz: { model: "edit" },
      },
    },
    async (request, reply) => {
      const user = getAuthUser(request);
      const { modelId, id } = request.params;

      // Check access
      // Writing threats needs edit on the model; viewers and commenters
      // only read.
      if (!(await authorizeModelAction(reply, user.id, modelId, "edit"))) {
        return reply;
      }

      // Get threat name before deletion (for webhook)
      const existing = await threatRepository.getById(id, modelId);
      if (!existing) {
        return sendNotFound(reply, "Threat", id);
      }

      await threatRepository.delete(id, modelId);

      // Audit + webhook
      const orgId = await getOrgIdFromModel(modelId);
      if (orgId) {
        logAudit({
          action: "DELETE",
          resourceType: "THREAT",
          resourceId: id,
          resourceName: existing.name,
          userId: user.id,
          userEmail: user.email || "unknown",
          organizationId: orgId,
          metadata: { modelId },
        }).catch((err) =>
          logger.warn({ err }, "Audit log failed — non-critical"),
        );
        dispatchWebhookEvent(orgId, "threat.deleted", {
          threatId: id,
          name: existing.name,
          modelId,
        });
      }

      return sendNoContent(reply);
    },
  );

  /**
   * PATCH /api/threat-models/:modelId/threats/:id/review
   * Human review action on an AI-generated threat.
   * Actions: accept, reject, modify
   */
  fastify.patch<{
    Params: { modelId: string; id: string };
    Body: {
      action: "accept" | "reject" | "modify";
      notes?: string;
      changes?: {
        name?: string;
        description?: string;
        severity?: string;
        category?: string;
        cvssVector31?: string;
        cvssScore31?: number;
        cvssVector40?: string;
        cvssScore40?: number;
      };
    };
  }>(
    "/api/threat-models/:modelId/threats/:id/review",
    {
      preHandler: requireScopes(["write:threats"]),
      config: {
        authz: { model: "edit" },
      },
    },
    async (request, reply) => {
      const user = getAuthUser(request);
      const { modelId, id } = request.params;
      const body = request.body;

      if (
        !body?.action ||
        !["accept", "reject", "modify"].includes(body.action)
      ) {
        return sendBadRequest(
          reply,
          "action must be 'accept', 'reject', or 'modify'",
        );
      }

      // Writing threats needs edit on the model; viewers and commenters
      // only read.
      if (!(await authorizeModelAction(reply, user.id, modelId, "edit"))) {
        return reply;
      }

      const prisma = await getPrisma();
      const threat = await prisma.threat.findFirst({
        where: { id, threatModelId: modelId },
      });
      if (!threat) {
        return sendNotFound(reply, "Threat", id);
      }

      await reviewThreat(id, user.id, {
        action: body.action,
        notes: body.notes,
        changes: body.changes,
      });

      // Reload and return updated threat
      const updated = await prisma.threat.findUnique({ where: { id } });

      const orgId = await getOrgIdFromModel(modelId);
      if (orgId) {
        logAudit({
          action: "UPDATE",
          resourceType: "THREAT",
          resourceId: id,
          resourceName: threat.name,
          userId: user.id,
          userEmail: user.email || "unknown",
          organizationId: orgId,
          metadata: { modelId, reviewAction: body.action },
        }).catch((err) =>
          logger.warn({ err }, "Audit log failed — non-critical"),
        );
      }

      return sendSuccess(
        reply,
        updated ? parseStrideCategories(updated) : null,
      );
    },
  );
}

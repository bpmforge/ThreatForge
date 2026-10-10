/**
 * Mitigation API routes.
 *
 * CRUD operations for mitigations within a threat.
 * All routes require authentication and verify access via organization membership.
 */
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getPrisma } from "../db.js";
import type { MitigationStatus, Priority } from "@prisma/client";
import { NotFoundError, mitigationRepository } from "../repositories/index.js";
import { getAuthUser } from "../utils/auth-helpers.js";
import {
  sendSuccess,
  sendCreated,
  sendList,
  sendNoContent,
  sendNotFound,
  sendForbidden,
  sendValidationError,
  parsePagination,
} from "../utils/api-response.js";
import { dispatchWebhookEvent } from "../services/webhooks/webhook-dispatcher.js";
import { logAudit } from "../services/audit.js";
import logger from "../utils/logger.js";
import { getOrgIdFromThreat } from "../services/access-control/access-control-service.js";
import {
  authorizeThreatAction,
  requireRequirementsInModel,
} from "./threat-models/helpers.js";
import { routeAuthz } from "../middleware/authz-policy.js";
import { requireScopes } from "../middleware/auth.js";

/** Mitigation status */
const MitigationStatusEnum = z.enum(["NOT_IMPLEMENTED", "IMPLEMENTED"]);

/** Priority levels */
const PriorityEnum = z.enum(["CRITICAL", "HIGH", "MEDIUM", "LOW"]);

/** Mitigation strategy (NIST-aligned) */
const MitigationStrategyEnum = z.enum([
  "PREVENTION", // Prevent threat from occurring
  "DETECTION", // Detect if threat occurs
  "RESPONSE", // Respond to threat when detected
  "RECOVERY", // Recover from threat impact
  "DETERRENCE", // Discourage threat actor
]);

/** Create mitigation request body */
const CreateMitigationSchema = z.object({
  description: z.string().min(1).max(2000),
  status: MitigationStatusEnum.default("NOT_IMPLEMENTED"),
  priority: PriorityEnum.default("MEDIUM"),
  strategy: MitigationStrategyEnum.default("PREVENTION"),
  notes: z.string().max(5000).optional(),
  dueDate: z.string().datetime().optional(),
  verified: z.boolean().default(false),
  obligation: z.enum(["REQUIRED", "RECOMMENDED"]).default("RECOMMENDED"),
});

/** Evidence link */
const EvidenceLinkSchema = z.object({
  type: z.string().max(50),
  url: z
    .string()
    .max(2000)
    .regex(/^https?:\/\//i, "Evidence links must be http(s) URLs"),
  title: z.string().max(200),
});

/** Requirement reference */
const RequirementRefSchema = z.object({
  docId: z.string().max(200),
  reqId: z.string().max(50),
  text: z.string().max(500),
});

/** Update mitigation request body */
const UpdateMitigationSchema = z.object({
  description: z.string().min(1).max(2000).optional(),
  status: MitigationStatusEnum.optional(),
  priority: PriorityEnum.optional(),
  strategy: MitigationStrategyEnum.optional(),
  notes: z.string().max(5000).optional().nullable(),
  dueDate: z.string().datetime().optional().nullable(),
  // New traceability + testability fields
  controlCategory: z.string().max(50).optional().nullable(),
  testCriteria: z.string().max(2000).optional().nullable(),
  testResult: z
    .enum(["PASS", "FAIL", "PARTIAL", "UNTESTED"])
    .optional()
    .nullable(),
  effectivenessScore: z.number().min(0).max(0.85).optional().nullable(),
  implementationNotes: z.string().max(5000).optional().nullable(),
  evidenceLinks: z.array(EvidenceLinkSchema).optional().nullable(),
  requirementRefs: z.array(RequirementRefSchema).optional().nullable(),
  requirementIds: z.array(z.string()).optional().nullable(),
  verified: z.boolean().optional(),
  obligation: z.enum(["REQUIRED", "RECOMMENDED"]).optional(),
});

/** Threat-scoped routes: the action is checked on the threat's model. */
const THREAT_VIEW = routeAuthz({ handler: "view on the threat's model" });
const THREAT_EDIT = routeAuthz({ handler: "edit on the threat's model" });

export async function mitigationRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/threats/:threatId/mitigations
   * List all mitigations for a threat
   * Supports pagination via page/limit query params
   */
  fastify.get<{
    Params: { threatId: string };
    Querystring: {
      page?: string;
      limit?: string;
      status?: string;
      priority?: string;
    };
  }>(
    "/api/threats/:threatId/mitigations",
    THREAT_VIEW,
    async (request, reply) => {
      const user = getAuthUser(request);
      const { threatId } = request.params;
      const { status, priority } = request.query;

      if (!(await authorizeThreatAction(reply, user.id, threatId, "view"))) {
        return reply;
      }

      // Use repository for paginated list
      const { page, limit } = parsePagination(request.query);
      const result = await mitigationRepository.list({
        threatId,
        page,
        limit,
        status: status as MitigationStatus | undefined,
        priority: priority as Priority | undefined,
      });

      return sendList(reply, result.data, {
        page: result.pagination.page,
        limit: result.pagination.limit,
        total: result.pagination.total,
      });
    },
  );

  /**
   * GET /api/threats/:threatId/mitigations/:id
   * Get a single mitigation
   */
  fastify.get<{ Params: { threatId: string; id: string } }>(
    "/api/threats/:threatId/mitigations/:id",
    THREAT_VIEW,
    async (request, reply) => {
      const user = getAuthUser(request);
      const { threatId, id } = request.params;

      if (!(await authorizeThreatAction(reply, user.id, threatId, "view"))) {
        return reply;
      }

      const mitigation = await mitigationRepository.getById(id, threatId);

      if (!mitigation) {
        return sendNotFound(reply, "Mitigation", id);
      }

      return sendSuccess(reply, mitigation);
    },
  );

  /**
   * POST /api/threats/:threatId/mitigations
   * Create a new mitigation
   */
  fastify.post<{ Params: { threatId: string } }>(
    "/api/threats/:threatId/mitigations",
    { ...THREAT_EDIT, preHandler: requireScopes(["write:threats"]) },
    async (request, reply) => {
      const user = getAuthUser(request);
      const { threatId } = request.params;
      const parseResult = CreateMitigationSchema.safeParse(request.body);

      if (!parseResult.success) {
        const errors = parseResult.error.issues.map((e) => ({
          field: e.path.join("."),
          message: e.message,
        }));
        return sendValidationError(reply, errors);
      }

      if (!(await authorizeThreatAction(reply, user.id, threatId, "edit"))) {
        return reply;
      }

      const { description, status, priority, notes, dueDate } =
        parseResult.data;

      const mitigation = await mitigationRepository.create({
        description,
        status,
        priority,
        notes,
        dueDate: dueDate ? new Date(dueDate) : undefined,
        threatId,
        createdById: user.id,
      });

      // Audit + webhook
      const orgId = await getOrgIdFromThreat(threatId);
      if (orgId) {
        logAudit({
          action: "CREATE",
          resourceType: "MITIGATION",
          resourceId: mitigation.id,
          resourceName: mitigation.description.slice(0, 80),
          userId: user.id,
          userEmail: user.email || "unknown",
          organizationId: orgId,
          metadata: { threatId, status: mitigation.status },
        }).catch((err) =>
          logger.warn({ err }, "Audit log failed — non-critical"),
        );
        dispatchWebhookEvent(orgId, "mitigation.created", {
          mitigationId: mitigation.id,
          description: mitigation.description,
          status: mitigation.status,
          threatId,
        });
      }

      return sendCreated(reply, mitigation);
    },
  );

  /**
   * PATCH /api/threats/:threatId/mitigations/:id
   * Update a mitigation
   */
  fastify.patch<{ Params: { threatId: string; id: string } }>(
    "/api/threats/:threatId/mitigations/:id",
    { ...THREAT_EDIT, preHandler: requireScopes(["write:threats"]) },
    async (request, reply) => {
      const user = getAuthUser(request);
      const { threatId, id } = request.params;
      const parseResult = UpdateMitigationSchema.safeParse(request.body);

      if (!parseResult.success) {
        const errors = parseResult.error.issues.map((e) => ({
          field: e.path.join("."),
          message: e.message,
        }));
        return sendValidationError(reply, errors);
      }

      if (!(await authorizeThreatAction(reply, user.id, threatId, "edit"))) {
        return reply;
      }

      // Linked requirements must belong to the threat's model
      if (parseResult.data.requirementIds) {
        const threat = await (
          await getPrisma()
        ).threat.findUnique({
          where: { id: threatId },
          select: { threatModelId: true },
        });
        if (
          !threat ||
          !(await requireRequirementsInModel(
            reply,
            threat.threatModelId,
            parseResult.data.requirementIds,
          ))
        ) {
          return reply;
        }
      }

      // Update via repository
      try {
        const { dueDate, ...rest } = parseResult.data;
        const mitigation = await mitigationRepository.update(id, threatId, {
          ...rest,
          ...(dueDate !== undefined && {
            dueDate: dueDate ? new Date(dueDate) : null,
          }),
        });

        // Audit + webhook
        const orgId = await getOrgIdFromThreat(threatId);
        if (orgId) {
          logAudit({
            action: "UPDATE",
            resourceType: "MITIGATION",
            resourceId: mitigation.id,
            resourceName: mitigation.description.slice(0, 80),
            userId: user.id,
            userEmail: user.email || "unknown",
            organizationId: orgId,
            metadata: { threatId, status: mitigation.status },
          }).catch((err) =>
            logger.warn({ err }, "Audit log failed — non-critical"),
          );
          dispatchWebhookEvent(orgId, "mitigation.updated", {
            mitigationId: mitigation.id,
            description: mitigation.description,
            status: mitigation.status,
            threatId,
          });
        }

        return sendSuccess(reply, mitigation);
      } catch (err) {
        if (err instanceof NotFoundError) {
          return sendNotFound(reply, "Mitigation", id);
        }
        throw err;
      }
    },
  );

  /**
   * DELETE /api/threats/:threatId/mitigations/:id
   * Delete a mitigation
   */
  fastify.delete<{ Params: { threatId: string; id: string } }>(
    "/api/threats/:threatId/mitigations/:id",
    { ...THREAT_EDIT, preHandler: requireScopes(["write:threats"]) },
    async (request, reply) => {
      const user = getAuthUser(request);
      const { threatId, id } = request.params;

      if (!(await authorizeThreatAction(reply, user.id, threatId, "edit"))) {
        return reply;
      }

      const existing = await mitigationRepository.getById(id, threatId);
      if (!existing) {
        return sendNotFound(reply, "Mitigation", id);
      }

      await mitigationRepository.delete(id, threatId);

      // Audit + webhook
      const orgId = await getOrgIdFromThreat(threatId);
      if (orgId) {
        logAudit({
          action: "DELETE",
          resourceType: "MITIGATION",
          resourceId: id,
          resourceName: existing.description.slice(0, 80),
          userId: user.id,
          userEmail: user.email || "unknown",
          organizationId: orgId,
          metadata: { threatId },
        }).catch((err) =>
          logger.warn({ err }, "Audit log failed — non-critical"),
        );
        dispatchWebhookEvent(orgId, "mitigation.deleted", {
          mitigationId: id,
          description: existing.description,
          threatId,
        });
      }

      return sendNoContent(reply);
    },
  );

  /**
   * PATCH /api/threats/:threatId/mitigations/:id/move
   * Reassign a mitigation to a different threat within the same model.
   */
  fastify.patch<{ Params: { threatId: string; id: string } }>(
    "/api/threats/:threatId/mitigations/:id/move",
    { ...THREAT_EDIT, preHandler: requireScopes(["write:threats"]) },
    async (request, reply) => {
      const user = getAuthUser(request);
      const prisma = await getPrisma();
      const { threatId, id } = request.params;

      const parsed = z
        .object({ targetThreatId: z.string().min(1) })
        .safeParse(request.body);
      if (!parsed.success) {
        return sendValidationError(reply, [
          { field: "targetThreatId", message: "targetThreatId is required" },
        ]);
      }
      const { targetThreatId } = parsed.data;

      if (!(await authorizeThreatAction(reply, user.id, threatId, "edit"))) {
        return reply;
      }

      // Verify mitigation belongs to source threat
      const mitigation = await prisma.mitigation.findFirst({
        where: { id, threatId },
        select: { id: true, description: true },
      });
      if (!mitigation) return sendNotFound(reply, "Mitigation", id);

      // Verify target threat exists and belongs to the same model
      const sourceThreat = await prisma.threat.findFirst({
        where: { id: threatId },
        select: { threatModelId: true },
      });
      const targetThreat = await prisma.threat.findFirst({
        where: {
          id: targetThreatId,
          threatModelId: sourceThreat!.threatModelId,
        },
        select: { id: true },
      });
      if (!targetThreat)
        return sendNotFound(reply, "Target threat", targetThreatId);

      const updated = await prisma.mitigation.update({
        where: { id },
        data: { threatId: targetThreatId },
        select: { id: true, description: true, status: true, threatId: true },
      });

      return sendSuccess(reply, updated);
    },
  );

  /**
   * GET /api/organizations/:orgId/shared-mitigations
   * List mitigations marked as shared controls across the organization.
   */
  fastify.get<{ Params: { orgId: string } }>(
    "/api/organizations/:orgId/shared-mitigations",
    {
      config: { authz: { org: "VIEWER" } },
      schema: {
        tags: ["Mitigations"],
        summary: "List shared control mitigations across the organization",
      },
    },
    async (request, reply) => {
      const user = getAuthUser(request);
      const { orgId } = request.params;

      // Verify org membership
      const prisma = await getPrisma();
      const membership = await prisma.membership.findFirst({
        where: { organizationId: orgId, userId: user.id, status: "ACTIVE" },
      });
      if (!membership) {
        return sendForbidden(reply);
      }

      // Find all mitigations marked as shared in models belonging to this org
      // ThreatModel → Project → Organization (navigate via project.organizationId)
      // Hard-capped at 500 rows — this is an org-wide rollup with no
      // pagination contract; without the cap a large org could pull tens of
      // thousands of rows in a single response.
      const SHARED_MITIGATION_CAP = 500;
      const shared = await prisma.mitigation.findMany({
        where: {
          isSharedControl: true,
          threat: {
            threatModel: {
              deletedAt: null,
              project: { organizationId: orgId },
            },
          },
        },
        select: {
          id: true,
          description: true,
          status: true,
          priority: true,
          controlCategory: true,
          effectivenessScore: true,
          testCriteria: true,
          threatId: true,
          threat: {
            select: {
              threatModel: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: { description: "asc" },
        take: SHARED_MITIGATION_CAP,
      });

      if (shared.length === SHARED_MITIGATION_CAP) {
        logger.warn(
          { orgId, returned: shared.length },
          "shared-mitigations hit hard cap; older results truncated",
        );
        reply.header("X-Result-Truncated", "true");
      }

      return sendSuccess(reply, shared);
    },
  );
}

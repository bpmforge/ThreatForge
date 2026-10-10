/**
 * Architectural Mitigation API Routes
 *
 *   POST   /api/threat-models/:id/architectural-mitigations/analyze → enqueue job
 *   GET    /api/threat-models/:id/architectural-mitigations         → list
 *   POST   /api/threat-models/:id/architectural-mitigations         → human-authored
 *   PATCH  /api/threat-models/:id/architectural-mitigations/:mid    → accept/reject/modify
 *   DELETE /api/threat-models/:id/architectural-mitigations/:mid    → delete
 *
 * Review flow mirrors threats/attack chains: AI_SUGGESTED → ACCEPTED /
 * REJECTED / MODIFIED. Any content edit marks the row MODIFIED and
 * source=HUMAN, after which no AI run may overwrite or delete it.
 */
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { getPrisma } from "../db.js";
import { getAuthUser } from "../utils/auth-helpers.js";
import {
  sendSuccess,
  sendCreated,
  sendNotFound,
  sendBadRequest,
  sendNoContent,
  sendConflict,
} from "../utils/api-response.js";
import { authorizeModelAction } from "./threat-models/helpers.js";
import { dispatchAiJob } from "../jobs/start-suggest-threats-job.js";
import { routeAuthz } from "../middleware/authz-policy.js";
import { requireScopes } from "../middleware/auth.js";
import {
  assertWithinSpendCap,
  SpendCapExceededError,
} from "../services/ai/spend-guard.js";
import { ARCHITECTURAL_KINDS } from "../services/ai/architectural-mitigation-service.js";
import { getOrgIdFromModel } from "../services/access-control/access-control-service.js";

const PRIORITIES = ["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const;
const idList = z.array(z.string().min(1)).default([]);

const CreateZ = z.object({
  kind: z.enum(ARCHITECTURAL_KINDS),
  title: z.string().min(1),
  proposedChange: z.string().min(1),
  rationale: z.string().nullish(),
  affectedComponentIds: idList,
  affectedConnectionIds: idList,
  threatIds: idList,
  priority: z.enum(PRIORITIES).default("MEDIUM"),
});

const PatchZ = z
  .object({
    status: z.enum(["ACCEPTED", "REJECTED", "MODIFIED"]),
    kind: z.enum(ARCHITECTURAL_KINDS),
    title: z.string().min(1),
    proposedChange: z.string().min(1),
    rationale: z.string().nullable(),
    affectedComponentIds: z.array(z.string().min(1)),
    affectedConnectionIds: z.array(z.string().min(1)),
    priority: z.enum(PRIORITIES),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, "No fields to update");

const CONTENT_FIELDS = [
  "kind",
  "title",
  "proposedChange",
  "rationale",
  "affectedComponentIds",
  "affectedConnectionIds",
  "priority",
] as const;

/** Decode the JSON-array columns for API consumers. */
function serialize<
  T extends {
    affectedComponentIds: string;
    affectedConnectionIds: string;
    threatIds: string;
    attackChainIds: string;
  },
>(row: T) {
  const arr = (s: string): string[] => {
    try {
      const v: unknown = JSON.parse(s);
      return Array.isArray(v) ? (v as string[]) : [];
    } catch {
      return [];
    }
  };
  return {
    ...row,
    affectedComponentIds: arr(row.affectedComponentIds),
    affectedConnectionIds: arr(row.affectedConnectionIds),
    threatIds: arr(row.threatIds),
    attackChainIds: arr(row.attackChainIds),
  };
}

export const architecturalMitigationRoutes: FastifyPluginAsync = async (
  server,
) => {
  const base = "/api/threat-models/:id/architectural-mitigations";

  server.post<{ Params: { id: string } }>(
    `${base}/analyze`,
    {
      config: { authz: { model: "edit" } },
      preHandler: [requireScopes(["write:models"])],
    },
    async (request, reply) => {
      const user = getAuthUser(request);
      const { id } = request.params;
      if (!(await authorizeModelAction(reply, user.id, id, "edit"))) {
        return reply;
      }

      const orgId = await getOrgIdFromModel(id);
      if (!orgId) return sendNotFound(reply, "Threat model", id);
      const prisma = await getPrisma();

      // Spend cap is checked up front so the in-process (no-Redis) path is
      // gated too; enqueueAiJob re-checks on the Redis path.
      try {
        await assertWithinSpendCap(prisma, orgId);
      } catch (err) {
        if (err instanceof SpendCapExceededError) {
          return reply.status(429).send({ error: err.message });
        }
        throw err;
      }

      const active = await prisma.aiJob.findFirst({
        where: {
          threatModelId: id,
          type: "ARCHITECTURAL_MITIGATIONS",
          status: { in: ["QUEUED", "PROCESSING"] },
        },
        select: { id: true },
      });
      if (active) {
        return sendConflict(reply, "Analysis already running", {
          existingJobId: active.id,
        });
      }

      const input = JSON.stringify({ modelId: id });
      const job = await prisma.aiJob.create({
        data: {
          userId: user.id,
          organizationId: orgId,
          type: "ARCHITECTURAL_MITIGATIONS",
          threatModelId: id,
          input,
        },
      });
      const jobData = {
        type: "ARCHITECTURAL_MITIGATIONS" as const,
        userId: user.id,
        organizationId: orgId,
        threatModelId: id,
        input,
        dbJobId: job.id,
      };
      await dispatchAiJob(jobData, request.log);

      return reply.status(202).send({
        data: {
          jobId: job.id,
          status: "QUEUED",
          type: "ARCHITECTURAL_MITIGATIONS",
          statusUrl: `/api/ai-jobs/${job.id}`,
        },
      });
    },
  );

  server.get<{ Params: { id: string } }>(
    base,
    routeAuthz({ model: "view" }),
    async (request, reply) => {
      const user = getAuthUser(request);
      const { id } = request.params;
      if (!(await authorizeModelAction(reply, user.id, id, "view"))) {
        return reply;
      }
      const prisma = await getPrisma();
      const rows = await prisma.architecturalMitigation.findMany({
        where: { threatModelId: id },
        orderBy: { createdAt: "desc" },
      });
      return sendSuccess(reply, rows.map(serialize));
    },
  );

  server.post<{ Params: { id: string }; Body: unknown }>(
    base,
    {
      config: { authz: { model: "edit" } },
      preHandler: [requireScopes(["write:models"])],
    },
    async (request, reply) => {
      const user = getAuthUser(request);
      const { id } = request.params;
      if (!(await authorizeModelAction(reply, user.id, id, "edit"))) {
        return reply;
      }
      const parsed = CreateZ.safeParse(request.body);
      if (!parsed.success) {
        return sendBadRequest(reply, "Invalid architectural mitigation", {
          issues: parsed.error.issues,
        });
      }
      const prisma = await getPrisma();
      const model = await prisma.threatModel.findUnique({
        where: { id },
        select: { id: true },
      });
      if (!model) return sendNotFound(reply, "Threat model", id);
      const d = parsed.data;
      const row = await prisma.architecturalMitigation.create({
        data: {
          threatModelId: id,
          kind: d.kind,
          title: d.title,
          proposedChange: d.proposedChange,
          rationale: d.rationale ?? null,
          affectedComponentIds: JSON.stringify(d.affectedComponentIds),
          affectedConnectionIds: JSON.stringify(d.affectedConnectionIds),
          threatIds: JSON.stringify(d.threatIds),
          priority: d.priority,
          status: "MODIFIED",
          source: "HUMAN",
        },
      });
      return sendCreated(reply, serialize(row));
    },
  );

  server.patch<{ Params: { id: string; mid: string }; Body: unknown }>(
    `${base}/:mid`,
    {
      config: { authz: { model: "edit" } },
      preHandler: [requireScopes(["write:models"])],
    },
    async (request, reply) => {
      const user = getAuthUser(request);
      const { id, mid } = request.params;
      if (!(await authorizeModelAction(reply, user.id, id, "edit"))) {
        return reply;
      }
      const parsed = PatchZ.safeParse(request.body ?? {});
      if (!parsed.success) {
        return sendBadRequest(reply, "Invalid update", {
          issues: parsed.error.issues,
        });
      }
      const prisma = await getPrisma();
      const existing = await prisma.architecturalMitigation.findFirst({
        where: { id: mid, threatModelId: id },
      });
      if (!existing)
        return sendNotFound(reply, "Architectural mitigation", mid);

      const d = parsed.data;
      const edited = CONTENT_FIELDS.some((f) => d[f] !== undefined);
      const updated = await prisma.architecturalMitigation.update({
        where: { id: mid },
        data: {
          ...(d.kind !== undefined && { kind: d.kind }),
          ...(d.title !== undefined && { title: d.title }),
          ...(d.proposedChange !== undefined && {
            proposedChange: d.proposedChange,
          }),
          ...(d.rationale !== undefined && { rationale: d.rationale }),
          ...(d.affectedComponentIds !== undefined && {
            affectedComponentIds: JSON.stringify(d.affectedComponentIds),
          }),
          ...(d.affectedConnectionIds !== undefined && {
            affectedConnectionIds: JSON.stringify(d.affectedConnectionIds),
          }),
          ...(d.priority !== undefined && { priority: d.priority }),
          // A content edit is a human claim on the row: MODIFIED unless the
          // caller explicitly accepts/rejects it in the same request.
          ...(edited && { source: "HUMAN" }),
          ...((d.status !== undefined || edited) && {
            status: d.status ?? "MODIFIED",
          }),
        },
      });
      return sendSuccess(reply, serialize(updated));
    },
  );

  server.delete<{ Params: { id: string; mid: string } }>(
    `${base}/:mid`,
    {
      config: { authz: { model: "edit" } },
      preHandler: [requireScopes(["write:models"])],
    },
    async (request, reply) => {
      const user = getAuthUser(request);
      const { id, mid } = request.params;
      if (!(await authorizeModelAction(reply, user.id, id, "edit"))) {
        return reply;
      }
      const prisma = await getPrisma();
      const existing = await prisma.architecturalMitigation.findFirst({
        where: { id: mid, threatModelId: id },
      });
      if (!existing)
        return sendNotFound(reply, "Architectural mitigation", mid);
      await prisma.architecturalMitigation.delete({ where: { id: mid } });
      return sendNoContent(reply);
    },
  );
};

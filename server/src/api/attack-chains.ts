/**
 * Attack Chain API Routes
 *
 * CRUD + analyze endpoints for AI-generated attack chains.
 *
 *   POST   /api/threat-models/:id/attack-chains/analyze  → enqueue job
 *   GET    /api/threat-models/:id/attack-chains           → list chains
 *   GET    /api/threat-models/:id/attack-chains/:chainId  → get single chain
 *   PATCH  /api/threat-models/:id/attack-chains/:chainId  → update status
 *   DELETE /api/threat-models/:id/attack-chains/:chainId  → delete
 */
import { replyIfOverSpendCap } from "../services/ai/spend-guard.js";
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
} from "../utils/api-response.js";
import { authorizeModelAction } from "./threat-models/helpers.js";
import { requireScopes } from "../middleware/auth.js";
import { routeAuthz } from "../middleware/authz-policy.js";
import { getOrgIdFromModel } from "../services/access-control/access-control-service.js";

const MODEL_VIEW = routeAuthz({ model: "view" });

const CHAIN_STATUSES = [
  "AI_SUGGESTED",
  "ACCEPTED",
  "REJECTED",
  "MODIFIED",
] as const;
const VALID_STATUSES = new Set<string>(CHAIN_STATUSES);
const SEVERITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL", "INFO"] as const;

// Capability tokens (preconditions/yields) and mitigationIds are stored as
// JSON-encoded string arrays — the datasource is SQLite (no native String[]),
// so we serialize array fields at the boundary. See 29-attack-chains.prisma.
const HopInputZ = z.object({
  position: z.number().int().min(0),
  componentId: z.string().min(1),
  componentName: z.string().min(1),
  connectionId: z.string().nullish(),
  threatId: z.string().nullish(),
  description: z.string().min(1),
  technique: z.string().nullish(),
  preconditions: z.array(z.string()).default([]),
  yields: z.array(z.string()).default([]),
});

const CreateChainZ = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  severity: z.enum(SEVERITIES),
  residualSeverity: z.enum(SEVERITIES).nullish(),
  likelihood: z.number().nullish(),
  sessionId: z.string().min(1),
  entryPointId: z.string().min(1),
  entryPointName: z.string().min(1),
  targetAssetId: z.string().min(1),
  targetAssetName: z.string().min(1),
  hops: z.array(HopInputZ).min(1),
});

const UpdateStatusZ = z.object({
  status: z.enum(CHAIN_STATUSES),
});

export const attackChainRoutes: FastifyPluginAsync = async (server) => {
  /** POST /api/threat-models/:id/attack-chains/analyze — enqueue AI analysis job */
  server.post<{ Params: { id: string } }>(
    "/api/threat-models/:id/attack-chains/analyze",
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
      if (!orgId) return sendNotFound(reply, "Threat model");
      const prisma = await getPrisma();

      if (await replyIfOverSpendCap(reply, prisma, orgId)) return reply;
      const job = await prisma.aiJob.create({
        data: {
          userId: user.id,
          organizationId: orgId,
          type: "ATTACK_CHAIN_ANALYSIS",
          threatModelId: id,
          input: JSON.stringify({ modelId: id }),
        },
      });

      if (process.env.REDIS_URL) {
        const { enqueueAiJob } = await import("../jobs/ai-queue.js");
        await enqueueAiJob({
          type: "ATTACK_CHAIN_ANALYSIS",
          userId: user.id,
          organizationId: orgId,
          threatModelId: id,
          input: JSON.stringify({ modelId: id }),
          dbJobId: job.id,
        });
      }

      return reply.status(202).send({
        data: {
          jobId: job.id,
          status: "QUEUED",
          type: "ATTACK_CHAIN_ANALYSIS",
          statusUrl: `/api/ai-jobs/${job.id}`,
        },
      });
    },
  );

  /** POST /api/threat-models/:id/attack-chains — manually create a chain + hops */
  server.post<{ Params: { id: string }; Body: unknown }>(
    "/api/threat-models/:id/attack-chains",
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

      const parsed = CreateChainZ.safeParse(request.body);
      if (!parsed.success) {
        return sendBadRequest(reply, "Invalid attack chain payload", {
          issues: parsed.error.issues,
        });
      }
      const input = parsed.data;

      const prisma = await getPrisma();
      const model = await prisma.threatModel.findUnique({
        where: { id },
        select: { id: true },
      });
      if (!model) return sendNotFound(reply, "Threat model", id);

      const chain = await prisma.attackChain.create({
        data: {
          threatModelId: id,
          name: input.name,
          description: input.description,
          severity: input.severity,
          residualSeverity: input.residualSeverity ?? null,
          likelihood: input.likelihood ?? null,
          sessionId: input.sessionId,
          entryPointId: input.entryPointId,
          entryPointName: input.entryPointName,
          targetAssetId: input.targetAssetId,
          targetAssetName: input.targetAssetName,
          hops: {
            create: input.hops.map((hop) => ({
              position: hop.position,
              componentId: hop.componentId,
              componentName: hop.componentName,
              connectionId: hop.connectionId ?? null,
              threatId: hop.threatId ?? null,
              description: hop.description,
              technique: hop.technique ?? null,
              // Serialize capability tokens as JSON for SQLite/Postgres parity.
              preconditions: JSON.stringify(hop.preconditions),
              yields: JSON.stringify(hop.yields),
            })),
          },
        },
        include: { hops: { orderBy: { position: "asc" } } },
      });

      return sendCreated(reply, chain);
    },
  );

  /** GET /api/threat-models/:id/attack-chains — list chains with hops */
  server.get<{ Params: { id: string } }>(
    "/api/threat-models/:id/attack-chains",
    MODEL_VIEW,
    async (request, reply) => {
      const user = getAuthUser(request);
      const { id } = request.params;

      if (!(await authorizeModelAction(reply, user.id, id, "view"))) {
        return reply;
      }

      const prisma = await getPrisma();
      const chains = await prisma.attackChain.findMany({
        where: { threatModelId: id },
        include: { hops: { orderBy: { position: "asc" } } },
        orderBy: { createdAt: "desc" },
      });

      return sendSuccess(reply, chains);
    },
  );

  /** GET /api/threat-models/:id/attack-chains/:chainId — get single chain */
  server.get<{ Params: { id: string; chainId: string } }>(
    "/api/threat-models/:id/attack-chains/:chainId",
    MODEL_VIEW,
    async (request, reply) => {
      const user = getAuthUser(request);
      const { id, chainId } = request.params;

      if (!(await authorizeModelAction(reply, user.id, id, "view"))) {
        return reply;
      }

      const prisma = await getPrisma();
      const chain = await prisma.attackChain.findFirst({
        where: { id: chainId, threatModelId: id },
        include: { hops: { orderBy: { position: "asc" } } },
      });

      if (!chain) return sendNotFound(reply, "Attack chain");
      return sendSuccess(reply, chain);
    },
  );

  /** PATCH /api/threat-models/:id/attack-chains/:chainId — update status */
  server.patch<{
    Params: { id: string; chainId: string };
    Body: unknown;
  }>(
    "/api/threat-models/:id/attack-chains/:chainId",
    {
      config: { authz: { model: "edit" } },
      preHandler: [requireScopes(["write:models"])],
    },
    async (request, reply) => {
      const user = getAuthUser(request);
      const { id, chainId } = request.params;
      if (!(await authorizeModelAction(reply, user.id, id, "edit"))) {
        return reply;
      }

      const parsed = UpdateStatusZ.safeParse(request.body ?? {});
      if (!parsed.success) {
        return sendBadRequest(
          reply,
          `status must be one of: ${[...VALID_STATUSES].join(", ")}`,
          { issues: parsed.error.issues },
        );
      }
      const { status } = parsed.data;

      const prisma = await getPrisma();
      const existing = await prisma.attackChain.findFirst({
        where: { id: chainId, threatModelId: id },
      });
      if (!existing) return sendNotFound(reply, "Attack chain");

      const updated = await prisma.attackChain.update({
        where: { id: chainId },
        data: { status },
        include: { hops: { orderBy: { position: "asc" } } },
      });

      return sendSuccess(reply, updated);
    },
  );

  /** DELETE /api/threat-models/:id/attack-chains/:chainId — delete chain */
  server.delete<{ Params: { id: string; chainId: string } }>(
    "/api/threat-models/:id/attack-chains/:chainId",
    {
      config: { authz: { model: "edit" } },
      preHandler: [requireScopes(["write:models"])],
    },
    async (request, reply) => {
      const user = getAuthUser(request);
      const { id, chainId } = request.params;

      if (!(await authorizeModelAction(reply, user.id, id, "edit"))) {
        return reply;
      }

      const prisma = await getPrisma();
      const existing = await prisma.attackChain.findFirst({
        where: { id: chainId, threatModelId: id },
      });
      if (!existing) return sendNotFound(reply, "Attack chain");

      await prisma.attackChain.delete({ where: { id: chainId } });
      return sendNoContent(reply);
    },
  );
};

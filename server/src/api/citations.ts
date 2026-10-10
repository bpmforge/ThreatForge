/**
 * Citation Verifier API routes.
 *
 * Provides read access to citations attached to threats and mitigations,
 * and allows reviewers to manually override the verification status.
 */
import { replyIfOverSpendCap } from "../services/ai/spend-guard.js";
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { getPrisma } from "../db.js";
import { getAuthUser } from "../utils/auth-helpers.js";
import {
  sendSuccess,
  sendNotFound,
  sendBadRequest,
} from "../utils/api-response.js";
import { computeRollup } from "../services/citation/index.js";
import { authorizeModelAction } from "./threat-models/helpers.js";
import { enqueueAiJob } from "../jobs/ai-queue.js";
import { routeAuthz } from "../middleware/authz-policy.js";

const MODEL_VIEW = routeAuthz({ model: "view" });
const MODEL_EDIT = routeAuthz({ model: "edit" });

type Prisma = Awaited<ReturnType<typeof getPrisma>>;

/** The threat / mitigation named in the URL must belong to the model in the URL. */
async function ownerInModel(
  prisma: Prisma,
  modelId: string,
  owner: { threatId: string } | { mitigationId: string },
): Promise<boolean> {
  const row =
    "threatId" in owner
      ? await prisma.threat.findFirst({
          where: { id: owner.threatId, threatModelId: modelId },
          select: { id: true },
        })
      : await prisma.mitigation.findFirst({
          where: { id: owner.mitigationId, threat: { threatModelId: modelId } },
          select: { id: true },
        });
  return row !== null;
}

const citationSelect = {
  id: true,
  kind: true,
  citationType: true,
  documentId: true,
  sectionId: true,
  pageNumber: true,
  excerpt: true,
  referenceKind: true,
  referenceId: true,
  componentNodeId: true,
  requirementId: true,
  verificationStatus: true,
  verifiedAt: true,
  verifierConfidence: true,
  verifierRationale: true,
  verifierProvider: true,
  overriddenById: true,
  overrideRationale: true,
  overriddenAt: true,
  createdAt: true,
  section: {
    select: {
      anchor: true,
      header: true,
    },
  },
} as const;

const overrideBodySchema = z.object({
  status: z.enum(["VERIFIED", "EXEMPT", "UNVERIFIED"]),
  rationale: z.string().optional(),
});

/**
 * Shared body of the threat / mitigation citation override routes: verifies the
 * owner belongs to the model, applies the manual verification override, then
 * recomputes the rollup on the parent. Caller has already authorized the edit.
 */
async function overrideCitation(
  request: FastifyRequest,
  reply: FastifyReply,
  userId: string,
  modelId: string,
  owner: { threatId: string } | { mitigationId: string },
  citationId: string,
) {
  const isThreat = "threatId" in owner;
  const ownerId = isThreat ? owner.threatId : owner.mitigationId;

  if (!(await ownerInModel(await getPrisma(), modelId, owner))) {
    return sendNotFound(reply, isThreat ? "Threat" : "Mitigation", ownerId);
  }

  const parsed = overrideBodySchema.safeParse(request.body);
  if (!parsed.success) {
    return sendBadRequest(reply, "Invalid request body");
  }
  const body = parsed.data;

  if (body.status === "EXEMPT" && !body.rationale) {
    return sendBadRequest(reply, "rationale is required when status is EXEMPT");
  }

  const prisma = await getPrisma();
  const citation = await prisma.citation.findUnique({
    where: { id: citationId },
  });

  if (
    !citation ||
    (isThreat ? citation.threatId : citation.mitigationId) !== ownerId
  ) {
    return sendNotFound(reply, "Citation", citationId);
  }

  const updated = await prisma.citation.update({
    where: { id: citationId },
    data: {
      verificationStatus: body.status,
      overriddenById: userId,
      overrideRationale: body.rationale ?? null,
      overriddenAt: new Date(),
    },
    select: citationSelect,
  });

  // Recompute rollup on parent threat / mitigation
  const allCitations = await prisma.citation.findMany({
    where: owner,
    select: { verificationStatus: true },
  });
  const rollup = computeRollup(allCitations.map((c) => c.verificationStatus));
  if (isThreat) {
    await prisma.threat.update({
      where: { id: ownerId },
      data: { verificationStatus: rollup },
    });
  } else {
    await prisma.mitigation.update({
      where: { id: ownerId },
      data: { verificationStatus: rollup },
    });
  }

  return sendSuccess(reply, updated);
}

export const citationRoutes: FastifyPluginAsync = async (server) => {
  // GET /api/threat-models/:modelId/threats/:threatId/citations
  server.get(
    "/api/threat-models/:modelId/threats/:threatId/citations",
    MODEL_VIEW,
    async (request, reply) => {
      const user = getAuthUser(request);

      const { modelId, threatId } = request.params as {
        modelId: string;
        threatId: string;
      };

      if (!(await authorizeModelAction(reply, user.id, modelId, "view"))) {
        return reply;
      }
      if (!(await ownerInModel(await getPrisma(), modelId, { threatId }))) {
        return sendNotFound(reply, "Threat", threatId);
      }

      const prisma = await getPrisma();
      const citations = await prisma.citation.findMany({
        where: { threatId },
        select: citationSelect,
      });

      return sendSuccess(reply, citations);
    },
  );

  // GET /api/threat-models/:modelId/mitigations/:mitigationId/citations
  server.get(
    "/api/threat-models/:modelId/mitigations/:mitigationId/citations",
    MODEL_VIEW,
    async (request, reply) => {
      const user = getAuthUser(request);

      const { modelId, mitigationId } = request.params as {
        modelId: string;
        mitigationId: string;
      };

      if (!(await authorizeModelAction(reply, user.id, modelId, "view"))) {
        return reply;
      }
      if (!(await ownerInModel(await getPrisma(), modelId, { mitigationId }))) {
        return sendNotFound(reply, "Mitigation", mitigationId);
      }

      const prisma = await getPrisma();
      const citations = await prisma.citation.findMany({
        where: { mitigationId },
        select: citationSelect,
      });

      return sendSuccess(reply, citations);
    },
  );

  // PATCH /api/threat-models/:modelId/threats/:threatId/citations/:citationId
  server.patch(
    "/api/threat-models/:modelId/threats/:threatId/citations/:citationId",
    MODEL_EDIT,
    async (request, reply) => {
      const user = getAuthUser(request);

      const { modelId, threatId, citationId } = request.params as {
        modelId: string;
        threatId: string;
        citationId: string;
      };

      if (!(await authorizeModelAction(reply, user.id, modelId, "edit"))) {
        return reply;
      }
      return overrideCitation(
        request,
        reply,
        user.id,
        modelId,
        { threatId },
        citationId,
      );
    },
  );

  // PATCH /api/threat-models/:modelId/mitigations/:mitigationId/citations/:citationId
  server.patch(
    "/api/threat-models/:modelId/mitigations/:mitigationId/citations/:citationId",
    MODEL_EDIT,
    async (request, reply) => {
      const user = getAuthUser(request);

      const { modelId, mitigationId, citationId } = request.params as {
        modelId: string;
        mitigationId: string;
        citationId: string;
      };

      if (!(await authorizeModelAction(reply, user.id, modelId, "edit"))) {
        return reply;
      }
      return overrideCitation(
        request,
        reply,
        user.id,
        modelId,
        { mitigationId },
        citationId,
      );
    },
  );

  // POST /api/threat-models/:modelId/citations/verify-batch
  server.post(
    "/api/threat-models/:modelId/citations/verify-batch",
    MODEL_EDIT,
    async (request, reply) => {
      const user = getAuthUser(request);
      const { modelId } = request.params as { modelId: string };

      if (!(await authorizeModelAction(reply, user.id, modelId, "edit"))) {
        return reply;
      }

      const prisma = await getPrisma();
      const model = await prisma.threatModel.findUnique({
        where: { id: modelId },
        include: {
          project: { include: { organization: { select: { id: true } } } },
        },
      });

      if (!model) {
        return sendNotFound(reply, "Threat model", modelId);
      }

      const organizationId = model.project.organization.id;

      if (await replyIfOverSpendCap(reply, prisma, organizationId))
        return reply;
      const job = await prisma.aiJob.create({
        data: {
          type: "VERIFY_CITATIONS",
          status: "QUEUED",
          userId: user.id,
          organizationId,
          threatModelId: modelId,
          input: JSON.stringify({ threatModelId: modelId }),
          progress: 0,
        },
      });

      try {
        await enqueueAiJob({
          type: "VERIFY_CITATIONS",
          userId: user.id,
          organizationId,
          threatModelId: modelId,
          input: JSON.stringify({ threatModelId: modelId }),
          dbJobId: job.id,
        });
        return reply
          .code(202)
          .send({ success: true, jobId: job.id, async: true });
      } catch {
        // Redis unavailable — run synchronously
        const { batchVerifyCitations } = await import(
          "../services/citation/batch-verifier.js"
        );
        const { createAIClient } = await import(
          "../services/ai/client-factory.js"
        );
        const org = await prisma.organization.findUnique({
          where: { id: organizationId },
          select: { aiSettings: true },
        });
        const orgSettings = org?.aiSettings ? JSON.parse(org.aiSettings) : null;
        if (!orgSettings?.enabled) {
          return sendBadRequest(
            reply,
            "AI is not configured for this organization",
          );
        }
        const client = createAIClient(orgSettings, organizationId);
        if (!client) {
          return sendBadRequest(reply, "Could not create AI client");
        }
        const summary = await batchVerifyCitations(prisma, client, modelId, {
          providerName: orgSettings.provider,
        });
        await prisma.aiJob.update({
          where: { id: job.id },
          data: {
            status: "COMPLETED",
            result: JSON.stringify(summary),
            completedAt: new Date(),
            progress: 100,
          },
        });
        return sendSuccess(reply, { jobId: job.id, async: false, summary });
      }
    },
  );
};

/**
 * AI API - Attack Tree Generation
 *
 * POST /api/threat-models/:modelId/ai/attack-tree
 *
 * Given a threat, generates an attack tree showing how an attacker
 * could achieve the threat goal through sub-goals and leaf attacks.
 */
import { replyIfOverSpendCap } from "../../../services/ai/spend-guard.js";
import type { FastifyPluginAsync } from "fastify";
import {
  getAIServiceForModel,
  buildThreatModelContext,
  sendSuccess,
  sendBadRequest,
  sendInternalError,
} from "../helpers.js";
import { authorizeModelAction } from "../../threat-models/helpers.js";
import { routeAuthz } from "../../../middleware/authz-policy.js";

const MODEL_EDIT = routeAuthz({ model: "edit" });

const ATTACK_TREE_PROMPT = `You are a security expert generating attack trees for threat modeling.

Given a threat and its context, produce an attack tree as JSON:

{
  "goal": "Top-level attack goal (what the attacker wants to achieve)",
  "operator": "OR",
  "children": [
    {
      "label": "Sub-goal or attack step",
      "operator": "AND",
      "difficulty": "LOW",
      "children": [
        {
          "label": "Leaf attack (specific technique)",
          "difficulty": "MEDIUM",
          "mitigation": "How to prevent this",
          "likelihood": "HIGH",
          "cwe": "CWE-89"
        }
      ]
    }
  ]
}

Rules:
- Root node is the attacker's goal (derived from the threat)
- Use "OR" for alternative attack paths, "AND" for required steps
- Leaf nodes have no children — they are specific, actionable attack techniques
- difficulty: LOW (script kiddie), MEDIUM (skilled attacker), HIGH (nation-state)
- likelihood: LOW, MEDIUM, HIGH
- Include CWE IDs where applicable
- Include mitigation for each leaf
- Produce 2-4 top-level branches (attack paths)
- Each branch should have 2-3 levels of depth
- Return ONLY the JSON object, no markdown.`;

export const attackTreeRoutes: FastifyPluginAsync = async (server) => {
  server.post<{
    Params: { modelId: string };
    Querystring: { async?: string };
    Body: {
      threatId?: string;
      threatName: string;
      threatDescription?: string;
      strideCategory?: string;
      componentName?: string;
      componentType?: string;
    };
  }>(
    "/api/threat-models/:modelId/ai/attack-tree",
    MODEL_EDIT,
    async (request, reply) => {
      const { modelId } = request.params;
      const {
        threatId,
        threatName,
        threatDescription,
        strideCategory,
        componentName,
        componentType,
      } = request.body;

      if (!threatName) {
        return sendBadRequest(reply, "Threat name is required");
      }

      // Authorize before either branch: the async branch creates a billed
      // AiJob against the model's org, so it must not run for outsiders.
      const authUser = (request as unknown as Record<string, unknown>)
        .authUser as { id: string } | undefined;
      if (!authUser) {
        return reply.status(401).send({ error: "Authentication required" });
      }
      // Queues a job that writes the model / spends its AI budget: edit.
      if (!(await authorizeModelAction(reply, authUser.id, modelId, "edit"))) {
        return reply;
      }

      // Async mode: enqueue as background job
      const isAsync = request.query.async === "true";
      if (isAsync && process.env.REDIS_URL) {
        const { getPrisma } = await import("../../../db.js");
        const prisma = await getPrisma();
        const model = await prisma.threatModel.findUnique({
          where: { id: modelId },
          include: { project: { select: { organizationId: true } } },
        });
        if (!model) return sendBadRequest(reply, "Threat model not found");

        const orgId = model.project.organizationId;
        if (await replyIfOverSpendCap(reply, prisma, orgId)) return reply;
        const job = await prisma.aiJob.create({
          data: {
            userId: authUser.id,
            organizationId: orgId,
            type: "ATTACK_TREE",
            threatModelId: modelId,
            threatId: threatId || null,
            input: JSON.stringify({
              threatName,
              threatDescription,
              strideCategory,
              componentName,
              componentType,
            }),
          },
        });

        const { enqueueAiJob } = await import("../../../jobs/ai-queue.js");
        await enqueueAiJob({
          type: "ATTACK_TREE",
          userId: authUser.id,
          organizationId: orgId,
          threatModelId: modelId,
          threatId: threatId || undefined,
          input: JSON.stringify({
            threatName,
            threatDescription,
            strideCategory,
            componentName,
            componentType,
          }),
          dbJobId: job.id,
        });

        return reply.status(202).send({
          data: {
            jobId: job.id,
            status: "QUEUED",
            type: "ATTACK_TREE",
            statusUrl: `/api/ai-jobs/${job.id}`,
          },
        });
      }

      const aiService = await getAIServiceForModel(modelId);
      if (!aiService) {
        return sendBadRequest(reply, "AI not configured for this model");
      }

      const context = await buildThreatModelContext(modelId);
      const contextInfo = context
        ? `\nModel components: ${context.components.map((c) => `${c.name} (${c.type})`).join(", ")}`
        : "";

      try {
        const response = await aiService.complete([
          { role: "system", content: ATTACK_TREE_PROMPT },
          {
            role: "user",
            content: [
              `Generate an attack tree for this threat:`,
              `Threat: ${threatName}`,
              threatDescription ? `Description: ${threatDescription}` : "",
              strideCategory ? `STRIDE Category: ${strideCategory}` : "",
              componentName
                ? `Target Component: ${componentName} (${componentType || "unknown"})`
                : "",
              contextInfo,
            ]
              .filter(Boolean)
              .join("\n"),
          },
        ]);

        let tree: Record<string, unknown>;
        try {
          let content = response.content.trim();
          if (content.startsWith("```")) {
            content = content
              .replace(/^```(?:json)?\n?/, "")
              .replace(/\n?```$/, "");
          }
          tree = JSON.parse(content);
        } catch {
          return sendBadRequest(
            reply,
            "AI returned invalid format. Try again.",
          );
        }

        return sendSuccess(reply, {
          threatName,
          attackTree: tree,
          usage: response.usage,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "AI generation failed";
        return sendInternalError(reply, msg);
      }
    },
  );
};

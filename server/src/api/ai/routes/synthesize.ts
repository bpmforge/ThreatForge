/**
 * POST /api/threat-models/:modelId/ai/synthesize
 *
 * Import-Flow Orchestrator endpoint.
 *
 * One trigger: Plan → Defend → Extract → Synthesize HLA → Manifest check.
 * Returns the full structured result from each stage.
 *
 * Opt-in / explicit: default mode requires user to click "Synthesize".
 * Auto-triggering on the Nth doc upload is not implemented.
 */
import { authorizeModelAction } from "../../threat-models/helpers.js";
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import { getPrisma } from "../../../db.js";
import { createAIClient } from "../../../services/ai/client-factory.js";
import { orchestrateImport } from "../../../services/ai/import-orchestrator.js";
import { sendSuccess, sendBadRequest, sendNotFound } from "../helpers.js";
import type { AISettings } from "../../../types/settings.js";
import { aiGuarded } from "../guards.js";

const MODEL_EDIT = aiGuarded({ model: "edit" });

/** What both synthesize routes need before calling the LLM. */
export interface SynthesisInputs {
  documents: { id: string; name: string; content: string; type: string }[];
  client: NonNullable<ReturnType<typeof createAIClient>>;
}

/**
 * Edit on the model (synthesis spends the org's AI budget), its current
 * documents and an AI client. Sends the refusal and returns null otherwise.
 */
export async function loadSynthesisInputs(
  request: FastifyRequest<{ Params: { modelId: string } }>,
  reply: FastifyReply,
  what: string,
): Promise<SynthesisInputs | null> {
  const user = request.authUser as { id: string } | undefined;
  if (!user) {
    reply.status(401).send({ error: "Authentication required" });
    return null;
  }
  const { modelId } = request.params;
  if (!(await authorizeModelAction(reply, user.id, modelId, "edit"))) {
    return null;
  }
  const prisma = await getPrisma();
  const model = await prisma.threatModel.findUnique({
    where: { id: modelId },
    include: {
      project: {
        include: {
          organization: { select: { id: true, aiSettings: true } },
        },
      },
    },
  });
  if (!model?.project?.organization) {
    sendNotFound(reply, "Threat model");
    return null;
  }
  const documents = await prisma.document.findMany({
    where: { threatModelId: modelId, supersededAt: null },
    select: { id: true, name: true, content: true, type: true },
  });
  if (documents.length === 0) {
    sendBadRequest(
      reply,
      `No documents found. Upload at least one document before ${what}.`,
    );
    return null;
  }
  const settings: AISettings = model.project.organization.aiSettings
    ? JSON.parse(model.project.organization.aiSettings)
    : null;
  if (!settings?.enabled) {
    sendBadRequest(reply, "AI not configured");
    return null;
  }
  const client = createAIClient(settings, model.project.organizationId);
  if (!client) {
    sendBadRequest(reply, "Could not create AI client");
    return null;
  }
  return { documents, client };
}

export const synthesizeRoutes: FastifyPluginAsync = async (server) => {
  server.post<{ Params: { modelId: string } }>(
    "/api/threat-models/:modelId/ai/synthesize",
    MODEL_EDIT,
    async (request, reply) => {
      const inputs = await loadSynthesisInputs(request, reply, "synthesizing");
      if (!inputs) return reply;
      const { documents, client } = inputs;

      const result = await orchestrateImport(
        client,
        documents.map((d) => ({
          id: d.id,
          name: d.name,
          content: d.content,
          type: d.type,
        })),
        (stage, detail) => {
          request.log.info({ stage, detail }, "synthesize progress");
        },
      );

      return sendSuccess(reply, result);
    },
  );
};

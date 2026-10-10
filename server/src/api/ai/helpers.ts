/**
 * AI API - Shared helpers, service factory, and types.
 */
import { getPrisma } from "../../db.js";
import { AIService } from "../../services/ai/index.js";
import { type AISettings, parseAISettings } from "../../types/settings.js";
import type { ThreatModelContext } from "../../types/ai.js";
import { decryptValue, getKeyConfig } from "../../services/encryption/index.js";
import type { ExtractionResult } from "../../services/ai/extraction-agent.js";
import logger from "../../utils/logger.js";
import type { FastifyReply, FastifyRequest } from "fastify";
import { canEditThreatModel } from "../threat-models/helpers.js";
import { sendBadRequest } from "../../utils/api-response.js";

// Re-export commonly used utilities for sub-routes
export { getPrisma } from "../../db.js";
export { AIService } from "../../services/ai/index.js";
export { AIProviderManager } from "../../services/ai/provider-manager.js";
export { StreamingHandler } from "../../services/ai/streaming-handler.js";
export { type AISettings, parseAISettings } from "../../types/settings.js";
export type { ThreatModelContext, AIMessage } from "../../types/ai.js";
export type { AuthUser } from "../../middleware/auth.js";
export {
  sanitizeMessage,
  sanitizeMessages,
  sanitizeObject,
} from "../../utils/sanitize.js";
export { decryptValue, getKeyConfig } from "../../services/encryption/index.js";
export {
  sendSuccess,
  sendBadRequest,
  sendNotFound,
  sendInternalError,
} from "../../utils/api-response.js";

/** Provider data residency metadata */
const PROVIDER_META: Record<
  string,
  { name: string; isLocal: boolean; destination: string }
> = {
  claude: {
    name: "Anthropic Claude",
    isLocal: false,
    destination: "Anthropic API (US)",
  },
  openai: { name: "OpenAI", isLocal: false, destination: "OpenAI API (US)" },
  gemini: {
    name: "Google Gemini",
    isLocal: false,
    destination: "Google AI (US)",
  },
  vertexai: {
    name: "Google Vertex AI",
    isLocal: false,
    destination: "Google Cloud (configurable region)",
  },
  ollama: { name: "Ollama", isLocal: true, destination: "Local server" },
  lmstudio: { name: "LM Studio", isLocal: true, destination: "Local server" },
  none: { name: "None", isLocal: true, destination: "N/A" },
};

/** Get data residency info for the AI provider configured for a model */
export async function getProviderMeta(modelId: string): Promise<{
  provider: string;
  name: string;
  isLocal: boolean;
  destination: string;
} | null> {
  const prisma = await getPrisma();
  const model = await prisma.threatModel.findUnique({
    where: { id: modelId },
    include: {
      project: {
        include: { organization: { select: { aiSettings: true } } },
      },
    },
  });

  if (!model?.project?.organization) return null;

  const settings: AISettings = parseAISettings(
    model.project.organization.aiSettings,
  );

  const meta = PROVIDER_META[settings.provider] || {
    name: settings.provider,
    isLocal: false,
    destination: "External API",
  };

  return { provider: settings.provider, ...meta };
}

/**
 * Helper to get AI service from a threat model ID.
 *
 * TODO(tech-debt): This reads AI config from `organization.aiSettings` — a JSON
 * blob. The newer `ai_providers` table is the eventual replacement but the
 * `getAIServiceForModel` call path (used by `/ai/available`, `/ai/suggest-threats`,
 * `/ai/micro-analysis`, `/ai/attack-tree`) still reads from the legacy field.
 *
 * Impact: Seeding a provider via the `AIProvider` model alone won't enable AI
 * features for a threat model. You also need to set `organization.aiSettings`.
 * Discovered while seeding the demo environment 2026-04-11 — two sources of
 * truth for the same concept. Consolidate in a follow-up.
 */
export async function getAIServiceForModel(
  modelId: string,
): Promise<AIService | null> {
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

  if (!model?.project?.organization) return null;

  const orgId = model.project.organization.id;
  const settings: AISettings = parseAISettings(
    model.project.organization.aiSettings,
  );

  if (!settings.enabled || settings.provider === "none") return null;

  // Decrypt API key if encrypted
  if (settings.encryptedApiKey && !settings.apiKey) {
    try {
      const keyConfig = await getKeyConfig(orgId);
      const decryptedKey = decryptValue(
        settings.encryptedApiKey,
        keyConfig ?? undefined,
      );
      if (decryptedKey) {
        settings.apiKey = decryptedKey;
      }
    } catch (error) {
      logger.error({ err: error }, "Failed to decrypt API key:");
      return null;
    }
  }

  return new AIService(settings, orgId);
}

/**
 * Build threat model context from database.
 *
 * @param synthesizedHLA — Optional synthesized HLA output. When provided, enriches
 *   canvas components with verificationStatus, technology, dataClassification,
 *   and trust level from the defended HLA, and injects HLA data flows as
 *   additional connections. All three threat pipelines (expert, agentic, micro)
 *   gain a consistent, document-grounded view without per-pipeline changes.
 */
export async function buildThreatModelContext(
  modelId: string,
  synthesizedHLA?: ExtractionResult,
): Promise<ThreatModelContext | null> {
  const prisma = await getPrisma();
  const model = await prisma.threatModel.findUnique({
    where: { id: modelId },
    include: {
      components: true,
      connections: true,
      boundaries: true,
      sequenceDiagrams: {
        include: {
          participants: true,
          messages: { include: { fromParticipant: true, toParticipant: true } },
        },
      },
      project: {
        include: {
          organization: {
            select: { threatMethodology: true },
          },
        },
      },
    },
  });

  if (!model) return null;

  const methodology =
    model.project?.organization?.threatMethodology ?? "STRIDE";

  // Load imported requirements for traceability injection into AI prompts.
  const requirements = await prisma.requirement.findMany({
    where: { threatModelId: modelId, supersededAt: null },
    select: { reqId: true, text: true, category: true, docId: true },
    orderBy: { reqId: "asc" },
  });

  // Build an HLA lookup keyed by normalized name for enrichment.
  type HLAComponent = NonNullable<typeof synthesizedHLA>["components"][number];
  const hlaByName = new Map<string, HLAComponent>();
  if (synthesizedHLA) {
    for (const hc of synthesizedHLA.components) {
      hlaByName.set(hc.name.toLowerCase().trim(), hc);
    }
  }

  const components = model.components.map((c) => {
    const hla = hlaByName.get(c.name.toLowerCase().trim());
    return {
      id: c.id,
      type: c.type,
      name: c.name,
      description: c.description || undefined,
      trustZone: c.trustLevel || hla?.trustLevel || undefined,
      properties: {
        ...(c.properties ? JSON.parse(c.properties) : {}),
        technology: c.technology || hla?.technology || undefined,
        dataClassification:
          c.dataClassification ||
          hla?.dataClassification?.join(",") ||
          undefined,
        dataHandled: c.dataHandled
          ? JSON.parse(c.dataHandled)
          : (hla?.dataHandled ?? []),
        accessPattern: c.accessPattern || undefined,
        aiNotes: c.aiNotes || undefined,
        engineerNotes: c.engineerNotes || undefined,
        confidence: c.confidence ?? hla?.confidence ?? undefined,
        // HLA provenance — surfaced in prompts so the LLM knows which claims are document-backed
        verificationStatus: hla?.verificationStatus ?? undefined,
        sourceQuote: hla?.sourceText ?? undefined,
        sourceDocument: hla?.sourceDocument ?? undefined,
      },
    };
  });

  // Index canvas component IDs by name for HLA flow injection.
  const canvasIdByName = new Map<string, string>(
    model.components.map((c) => [c.name.toLowerCase().trim(), c.id]),
  );

  const canvasConnections = model.connections.map((c) => ({
    id: c.id,
    source: c.sourceComponentId,
    target: c.targetComponentId,
    label: c.label || undefined,
    protocol: c.protocol || undefined,
    authentication: c.authentication || undefined,
    encrypted: c.encrypted,
  }));

  // Inject HLA data flows as supplemental connections (best-effort —
  // only include flows where both endpoints exist on the canvas).
  if (synthesizedHLA) {
    const existingPairs = new Set(
      canvasConnections.map((c) => `${c.source}→${c.target}`),
    );
    for (const flow of synthesizedHLA.dataFlows) {
      // HLA flows reference component IDs from extraction, not canvas IDs.
      // Try to resolve via name index.
      const srcComp = synthesizedHLA.components.find(
        (c) => c.id === flow.sourceId,
      );
      const tgtComp = synthesizedHLA.components.find(
        (c) => c.id === flow.targetId,
      );
      const srcCanvasId = srcComp
        ? canvasIdByName.get(srcComp.name.toLowerCase().trim())
        : undefined;
      const tgtCanvasId = tgtComp
        ? canvasIdByName.get(tgtComp.name.toLowerCase().trim())
        : undefined;
      if (!srcCanvasId || !tgtCanvasId) continue;
      const pair = `${srcCanvasId}→${tgtCanvasId}`;
      if (existingPairs.has(pair)) continue;
      existingPairs.add(pair);
      canvasConnections.push({
        id: `hla-${flow.id}`,
        source: srcCanvasId,
        target: tgtCanvasId,
        label: flow.label,
        protocol: undefined, // HLA protocol is plain string, not Prisma enum — omit to avoid type mismatch
        authentication: undefined, // ExtractedDataFlow carries no auth field; absent, not "none"
        encrypted: flow.encrypted ?? false,
      });
    }
  }

  return {
    name: model.name,
    methodology,
    requirements,
    components,
    connections: canvasConnections,
    boundaries: model.boundaries.map((b) => ({
      id: b.id,
      name: b.name,
      trustLevel: b.trustLevel || undefined,
    })),
    sequenceFlows: model.sequenceDiagrams?.map((sd) => ({
      diagramName: sd.name,
      messages: sd.messages.map((m) => ({
        from: m.fromParticipant?.label || m.fromId,
        to: m.toParticipant?.label || m.toId,
        label: m.label,
        protocol: m.protocol || undefined,
        authentication: m.authentication || undefined,
        notes: m.notes || undefined,
      })),
    })),
  };
}

/**
 * The model's AI service for an instant-suggestion route, after checking the
 * caller may edit the model (these calls spend its org's AI budget). Sends
 * 401/403/400 and returns null when the request cannot proceed.
 */
export async function aiServiceForModelEditor(
  request: FastifyRequest,
  reply: FastifyReply,
  modelId: string,
): Promise<AIService | null> {
  const userId = request.authUser?.id;
  if (!userId) {
    reply.status(401).send({ error: "Authentication required" });
    return null;
  }
  if (!(await canEditThreatModel(userId, modelId))) {
    reply.status(403).send({ error: "Access denied" });
    return null;
  }
  const aiService = await getAIServiceForModel(modelId);
  if (!aiService) {
    sendBadRequest(reply, "AI not configured for this model");
    return null;
  }
  return aiService;
}

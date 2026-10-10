/**
 * AI API - Model Refinement Route
 *
 * POST /api/threat-models/:modelId/ai/suggest-questions
 *
 * After initial AI extraction, suggests follow-up questions to
 * enrich the threat model. Based on what's missing or unclear.
 */
import type { FastifyPluginAsync } from "fastify";
import {
  getAIServiceForModel,
  buildThreatModelContext,
  getPrisma,
  sanitizeMessage,
  sanitizeMessages,
  sendSuccess,
  sendBadRequest,
  sendNotFound,
  sendInternalError,
} from "../helpers.js";
import type { AIMessage } from "../helpers.js";
import { canEditThreatModel } from "../../threat-models/helpers.js";
import { aiGuarded } from "../guards.js";

const MODEL_EDIT = aiGuarded({ model: "edit" });

const REFINEMENT_PROMPT = `You are a security architect reviewing a threat model that was just auto-generated from a document or description. Your job is to identify what's MISSING or UNCLEAR so the model can be improved.

Given the current model state, generate 3-5 specific follow-up questions that would improve the threat model. Focus on:

1. Authentication & authorization details (how do users authenticate?)
2. Data sensitivity (what kind of data is stored/processed?)
3. Network boundaries (what's internet-facing vs internal?)
4. Encryption (is data encrypted at rest and in transit?)
5. Third-party integrations (what external services are called?)
6. Deployment environment (cloud provider, container orchestration?)

Return JSON:
{
  "questions": [
    {
      "question": "The specific question to ask",
      "category": "authentication|data|network|encryption|integration|deployment",
      "impact": "How this answer would improve the threat model"
    }
  ],
  "completeness": 0-100,
  "summary": "Brief assessment of what the model is missing"
}

Return ONLY the JSON object.`;

export const refinementRoutes: FastifyPluginAsync = async (server) => {
  server.post<{ Params: { modelId: string } }>(
    "/api/threat-models/:modelId/ai/suggest-questions",
    MODEL_EDIT,
    async (request, reply) => {
      const { modelId } = request.params;

      const authUser = (request as unknown as Record<string, unknown>)
        .authUser as { id: string } | undefined;
      if (!authUser) {
        return reply.status(401).send({ error: "Authentication required" });
      }
      const hasAccess = await canEditThreatModel(authUser.id, modelId);
      if (!hasAccess) {
        return reply.status(403).send({ error: "Access denied" });
      }

      const aiService = await getAIServiceForModel(modelId);
      if (!aiService) {
        return sendBadRequest(reply, "AI not configured for this model");
      }

      const context = await buildThreatModelContext(modelId);
      if (!context) {
        return sendBadRequest(reply, "Threat model not found or empty");
      }

      const modelSummary = [
        `Model: ${context.name}`,
        `Components (${context.components.length}): ${context.components.map((c) => `${c.name} (${c.type})`).join(", ") || "none"}`,
        `Connections (${context.connections.length}): ${context.connections.map((c) => `${c.source} → ${c.target} [${c.protocol || "unknown"}]`).join(", ") || "none"}`,
        `Boundaries (${context.boundaries.length}): ${context.boundaries.map((b) => b.name).join(", ") || "none"}`,
      ].join("\n");

      try {
        const response = await aiService.complete([
          { role: "system", content: REFINEMENT_PROMPT },
          { role: "user", content: modelSummary },
        ]);

        let parsed: Record<string, unknown>;
        try {
          let content = response.content.trim();
          if (content.startsWith("```")) {
            content = content
              .replace(/^```(?:json)?\n?/, "")
              .replace(/\n?```$/, "");
          }
          parsed = JSON.parse(content);
        } catch {
          // parse fallback — returns hardcoded default questions
          return sendSuccess(reply, {
            questions: [
              {
                question: "What authentication method does your system use?",
                category: "authentication",
                impact: "Identifies auth-related threats",
              },
              {
                question: "What sensitive data does this system process?",
                category: "data",
                impact: "Determines data classification and compliance needs",
              },
              {
                question: "Which components are internet-facing?",
                category: "network",
                impact: "Identifies attack surface boundaries",
              },
            ],
            completeness: 30,
            summary:
              "Model needs more detail for comprehensive threat analysis",
          });
        }

        return sendSuccess(reply, parsed);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "AI request failed";
        return sendInternalError(reply, msg);
      }
    },
  );

  /**
   * POST /api/threat-models/:modelId/ai/refine-threat
   *
   * Context-aware chat for iterative refinement of a specific threat.
   * AI is briefed on the threat details and can suggest structured updates
   * via <threatUpdate>{ "name"?, "description"?, "severity"? }</threatUpdate> blocks.
   */
  server.post<{
    Params: { modelId: string };
    Body: { threatId: string; message: string; history?: AIMessage[] };
  }>(
    "/api/threat-models/:modelId/ai/refine-threat",
    MODEL_EDIT,
    async (request, reply) => {
      const { modelId } = request.params;
      const { threatId, message, history = [] } = request.body;

      const authUser = (request as unknown as Record<string, unknown>)
        .authUser as { id: string } | undefined;
      if (!authUser) {
        return reply.status(401).send({ error: "Authentication required" });
      }
      const hasAccess = await canEditThreatModel(authUser.id, modelId);
      if (!hasAccess) {
        return reply.status(403).send({ error: "Access denied" });
      }

      const aiService = await getAIServiceForModel(modelId);
      if (!aiService) {
        return sendBadRequest(reply, "AI not configured for this model");
      }

      // Load the specific threat + mitigations
      const prisma = await getPrisma();
      const threat = await prisma.threat.findFirst({
        where: { id: threatId, threatModelId: modelId },
        include: { mitigations: true },
      });
      if (!threat) return sendNotFound(reply, "Threat");

      const context = await buildThreatModelContext(modelId);

      // Build threat-specific system prompt
      const mitigationSummary =
        threat.mitigations.length > 0
          ? threat.mitigations
              .map(
                (m) =>
                  `  - ${m.description} [${m.status}]${m.priority ? ` (${m.priority})` : ""}`,
              )
              .join("\n")
          : "  None yet";

      const componentSummary = context
        ? context.components
            .map(
              (c) =>
                `  - ${c.name} (${c.type})${c.description ? `: ${c.description}` : ""}`,
            )
            .join("\n")
        : "  Not available";

      const connectionSummary = context
        ? context.connections
            .map(
              (c) =>
                `  - ${c.source} → ${c.target}${c.protocol ? ` [${c.protocol}${c.encrypted ? ", encrypted" : ", unencrypted"}]` : ""}`,
            )
            .join("\n")
        : "  Not available";

      const categories = (() => {
        try {
          return JSON.parse(threat.strideCategories as string) as string[];
        } catch {
          return [];
        }
      })();

      const systemPrompt = `You are a senior security engineer helping to iteratively refine a specific threat in a threat model.

THREAT BEING REFINED:
Name: ${threat.name}
Description: ${threat.description || "(none)"}
STRIDE Categories: ${categories.join(", ") || "(none)"}
Severity: ${threat.severity}
Status: ${threat.status}

EXISTING MITIGATIONS:
${mitigationSummary}

SYSTEM ARCHITECTURE:
Components:
${componentSummary}
Connections:
${connectionSummary}

YOUR ROLE:
- Answer questions about this specific threat with expert depth
- Help clarify attack vectors, blast radius, and exploitability
- Suggest how to improve the threat name, description, or severity rating
- If you want to propose specific field updates, include a structured block at the END of your response:
  <threatUpdate>{"name": "...", "description": "...", "severity": "CRITICAL"}</threatUpdate>
- Only include fields you are actually changing in the update block
- Valid severity values: INFO, LOW, MEDIUM, HIGH, CRITICAL
- Keep responses focused and practical for this threat model context`;

      const sanitizedMessage = sanitizeMessage(message);
      const sanitizedHistory = sanitizeMessages(
        history as { content: string; role: string }[],
      );

      try {
        const messages: AIMessage[] = [
          { role: "system", content: systemPrompt },
          ...(sanitizedHistory as AIMessage[]),
          { role: "user", content: sanitizedMessage },
        ];
        const response = await aiService.complete(messages);
        return sendSuccess(reply, {
          message: response.content,
          usage: response.usage,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "AI request failed";
        return sendInternalError(reply, msg);
      }
    },
  );
};

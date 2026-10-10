/**
 * Sequence Diagrams - AI Generation Route
 *
 * POST /api/threat-models/:id/sequences/generate
 *
 * Generates a sequence diagram from a text description using AI.
 * The LLM returns participants and messages, which are saved to the DB.
 */
import type { FastifyPluginAsync } from "fastify";
import {
  getPrisma,
  getAuthUser,
  requireThreatModelEdit,
  sendCreated,
  sendBadRequest,
  sendInternalError,
} from "../helpers.js";
import {
  getAIServiceForModel,
  buildThreatModelContext,
} from "../../ai/helpers.js";
import { routeAuthz } from "../../../middleware/authz-policy.js";

const SYSTEM_PROMPT = `You are a security architect generating sequence diagrams for threat modeling.

Given a description of a workflow or interaction, produce a sequence diagram as JSON:

{
  "name": "Diagram title",
  "description": "Brief summary",
  "participants": [
    { "label": "Participant Name", "order": 0 }
  ],
  "messages": [
    {
      "from": "Participant Name",
      "to": "Other Participant",
      "label": "Action description",
      "order": 0,
      "type": "SYNC",
      "isReturn": false,
      "protocol": null,
      "authentication": null,
      "notes": null
    }
  ]
}

Rules:
- Use exact participant names in message from/to fields
- Order messages sequentially (0, 1, 2, ...)
- Order participants left-to-right (0, 1, 2, ...)
- Use type: "SYNC" for request, "ASYNC" for async, "SYNC" with isReturn:true for responses
- Include protocol (HTTPS, gRPC, TCP, etc.) when relevant
- Include authentication (OAuth2, JWT, API_KEY, etc.) when relevant
- Add security-relevant notes (e.g., "Token validated", "Rate limited")
- For auth flows, show token exchange, validation, and error paths
- For data flows, show encryption and access control checks
- Return ONLY the JSON object, no markdown or explanation.`;

interface GenerateBody {
  description: string;
  name?: string;
}

const AUTO_GENERATE_PROMPT = `You are a security architect generating sequence diagrams from a system architecture. Analyze the components and connections to identify the most important security-relevant workflows.

Generate 2-3 sequence diagrams for the MOST CRITICAL data flows:
1. The main data ingestion/processing flow (from external input to storage)
2. The authentication/authorization flow (if auth components exist)
3. The most security-sensitive data flow (PII, credentials, or cross-boundary)

For EACH diagram, return:
{
  "diagrams": [
    {
      "name": "Flow name",
      "description": "What this flow does and why it matters for security",
      "participants": [{"label": "Component Name", "order": 0}],
      "messages": [
        {"from": "Component A", "to": "Component B", "label": "Action", "order": 0, "type": "SYNC", "isReturn": false, "protocol": "HTTPS", "authentication": "JWT", "notes": "Security note"}
      ]
    }
  ]
}

Rules:
- Use EXACT component names from the architecture
- Include protocol and authentication on every message
- Add security-relevant notes (validation, encryption, access checks)
- Show both request and response messages where relevant
- Return ONLY the JSON object.`;

const MODEL_EDIT = routeAuthz({ model: "edit" });

export const generateRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * POST /api/threat-models/:id/sequences/generate
   * Generate a sequence diagram from AI description
   */
  fastify.post<{ Params: { id: string }; Body: GenerateBody }>(
    "/api/threat-models/:id/sequences/generate",
    MODEL_EDIT,
    async (request, reply) => {
      const user = getAuthUser(request);
      const prisma = await getPrisma();
      const { id } = request.params;
      const { description, name } = request.body;

      if (!description?.trim()) {
        return sendBadRequest(reply, "Description is required");
      }

      if (!(await requireThreatModelEdit(user.id, id, reply))) return reply;

      const aiService = await getAIServiceForModel(id);
      if (!aiService) {
        return sendBadRequest(reply, "AI not configured for this model");
      }

      // Build context from the threat model for richer generation
      const context = await buildThreatModelContext(id);
      const contextInfo = context
        ? `\n\nThreat model context:\n- Components: ${context.components.map((c) => `${c.name} (${c.type})`).join(", ")}\n- Connections: ${context.connections.map((c) => `${c.source} → ${c.target}`).join(", ")}`
        : "";

      try {
        const response = await aiService.complete([
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: `Generate a sequence diagram for: ${description}${contextInfo}`,
          },
        ]);

        // Parse the LLM response
        let parsed: {
          name: string;
          description?: string;
          participants: Array<{ label: string; order: number }>;
          messages: Array<{
            from: string;
            to: string;
            label: string;
            order: number;
            type?: string;
            isReturn?: boolean;
            protocol?: string;
            authentication?: string;
            notes?: string;
          }>;
        };

        try {
          // Strip markdown code fences if present
          let content = response.content.trim();
          if (content.startsWith("```")) {
            content = content
              .replace(/^```(?:json)?\n?/, "")
              .replace(/\n?```$/, "");
          }
          parsed = JSON.parse(content);
        } catch {
          return sendBadRequest(
            reply,
            "AI returned invalid format. Try rephrasing your description.",
          );
        }

        if (!parsed.participants?.length || !parsed.messages?.length) {
          return sendBadRequest(
            reply,
            "AI could not generate a meaningful diagram. Try a more specific description.",
          );
        }

        // Get current diagram count for ordering
        const existingCount = await prisma.sequenceDiagram.count({
          where: { threatModelId: id },
        });

        // Create the diagram
        const diagram = await prisma.sequenceDiagram.create({
          data: {
            name: name || parsed.name || "AI Generated Diagram",
            description: parsed.description || description,
            order: existingCount,
            threatModelId: id,
            createdById: user.id,
          },
        });

        // Create participants
        const participantMap = new Map<string, string>(); // label → DB id
        for (const p of parsed.participants) {
          const participant = await prisma.sequenceParticipant.create({
            data: {
              label: p.label,
              order: p.order,
              sequenceDiagramId: diagram.id,
            },
          });
          participantMap.set(p.label, participant.id);
        }

        // Create messages
        const messages = [];
        for (const m of parsed.messages) {
          const fromId = participantMap.get(m.from);
          const toId = participantMap.get(m.to);
          if (!fromId || !toId) continue; // Skip messages with unknown participants

          const msg = await prisma.sequenceMessage.create({
            data: {
              label: m.label,
              order: m.order,
              messageType: (m.type === "ASYNC" ? "ASYNC" : "SYNC") as
                | "SYNC"
                | "ASYNC",
              isReturn: m.isReturn || false,
              protocol: (m.protocol || null) as
                | import("@prisma/client").Protocol
                | null,
              authentication: (m.authentication || null) as
                | import("@prisma/client").AuthMethod
                | null,
              notes: m.notes || null,
              sequenceDiagramId: diagram.id,
              fromId,
              toId,
            },
          });
          messages.push(msg);
        }

        return sendCreated(reply, {
          diagramId: diagram.id,
          name: diagram.name,
          description: diagram.description,
          participantCount: parsed.participants.length,
          messageCount: messages.length,
          participants: parsed.participants.map((p) => p.label),
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "AI generation failed";
        return sendInternalError(reply, msg);
      }
    },
  );

  /**
   * POST /api/threat-models/:id/sequences/auto-generate
   * Auto-generate sequence diagrams from architecture (no description needed).
   * AI analyzes components + connections and generates 2-3 critical flow diagrams.
   */
  fastify.post<{ Params: { id: string } }>(
    "/api/threat-models/:id/sequences/auto-generate",
    MODEL_EDIT,
    async (request, reply) => {
      const user = getAuthUser(request);
      const prisma = await getPrisma();
      const { id } = request.params;

      if (!(await requireThreatModelEdit(user.id, id, reply))) return reply;

      const aiService = await getAIServiceForModel(id);
      if (!aiService) return sendBadRequest(reply, "AI not configured");

      const context = await buildThreatModelContext(id);
      if (!context || context.components.length === 0) {
        return sendBadRequest(
          reply,
          "Add components before generating sequence diagrams",
        );
      }

      const archContext = `## Architecture
Components: ${context.components.map((c) => `${c.name} (${c.type})`).join(", ")}

Connections:
${context.connections.map((c) => `- ${c.source} → ${c.target} [${c.protocol || "?"}] ${c.encrypted ? "encrypted" : "unencrypted"}`).join("\n")}

Boundaries:
${context.boundaries.map((b) => `- ${b.name} (${b.trustLevel || "?"})`).join("\n")}`;

      try {
        const response = await aiService.complete([
          { role: "system", content: AUTO_GENERATE_PROMPT },
          { role: "user", content: archContext },
        ]);

        let content = response.content.trim();
        content = content.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
        if (content.startsWith("```")) {
          content = content
            .replace(/^```(?:json)?\n?/, "")
            .replace(/\n?```$/, "");
        }
        // Find JSON object
        const start = content.indexOf("{");
        const end = content.lastIndexOf("}");
        if (start !== -1 && end > start)
          content = content.slice(start, end + 1);
        content = content.replace(/,\s*([}\]])/g, "$1");

        const parsed = JSON.parse(content) as {
          diagrams: Array<{
            name: string;
            description?: string;
            participants: Array<{ label: string; order: number }>;
            messages: Array<{
              from: string;
              to: string;
              label: string;
              order: number;
              type?: string;
              isReturn?: boolean;
              protocol?: string;
              authentication?: string;
              notes?: string;
            }>;
          }>;
        };

        if (!parsed.diagrams?.length) {
          return sendBadRequest(reply, "AI could not identify key workflows");
        }

        const results = [];
        const existingCount = await prisma.sequenceDiagram.count({
          where: { threatModelId: id },
        });

        for (let i = 0; i < parsed.diagrams.length; i++) {
          const d = parsed.diagrams[i];
          if (!d.participants?.length || !d.messages?.length) continue;

          const diagram = await prisma.sequenceDiagram.create({
            data: {
              name: d.name || `Auto-Generated Flow ${i + 1}`,
              description: d.description || null,
              order: existingCount + i,
              threatModelId: id,
              createdById: user.id,
            },
          });

          const pMap = new Map<string, string>();
          for (const p of d.participants) {
            const rec = await prisma.sequenceParticipant.create({
              data: {
                label: p.label,
                order: p.order,
                sequenceDiagramId: diagram.id,
              },
            });
            pMap.set(p.label, rec.id);
          }

          let msgCount = 0;
          for (const m of d.messages) {
            const fromId = pMap.get(m.from);
            const toId = pMap.get(m.to);
            if (!fromId || !toId) continue;
            await prisma.sequenceMessage.create({
              data: {
                label: m.label,
                order: m.order,
                messageType: (m.type === "ASYNC" ? "ASYNC" : "SYNC") as
                  | "SYNC"
                  | "ASYNC",
                isReturn: m.isReturn || false,
                protocol: (m.protocol || null) as
                  | import("@prisma/client").Protocol
                  | null,
                authentication: (m.authentication || null) as
                  | import("@prisma/client").AuthMethod
                  | null,
                notes: m.notes || null,
                sequenceDiagramId: diagram.id,
                fromId,
                toId,
              },
            });
            msgCount++;
          }

          results.push({
            diagramId: diagram.id,
            name: diagram.name,
            participantCount: d.participants.length,
            messageCount: msgCount,
          });
        }

        return sendCreated(reply, { diagrams: results, total: results.length });
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Auto-generation failed";
        return sendInternalError(reply, msg);
      }
    },
  );
};

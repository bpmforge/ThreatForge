/**
 * Streaming Handler for AI Chat
 * Provides Server-Sent Events (SSE) streaming for AI responses.
 */

import type { FastifyReply } from "fastify";
import { AIProviderManager } from "./provider-manager.js";
import { AIService } from "./index.js";
import { getPrisma } from "../../db.js";
import { decryptValue, getKeyConfig } from "../encryption/index.js";
import type { AISettings } from "../../types/settings.js";
import type { ThreatModelContext } from "../../types/ai.js";
import { parseAISettings } from "../../types/settings.js";

export class StreamingHandler {
  constructor(private providerManager: AIProviderManager) {}

  createSSEResponse(reply: FastifyReply): void {
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
    });
  }

  async streamChat(
    modelId: string,
    message: string,
    history: Array<{ role: string; content: string }>,
    reply: FastifyReply,
  ): Promise<void> {
    const prisma = await getPrisma();

    // Get model with org settings and canvas context
    const model = await prisma.threatModel.findUnique({
      where: { id: modelId },
      include: {
        project: {
          include: {
            organization: {
              select: { id: true, aiSettings: true, threatMethodology: true },
            },
          },
        },
        components: true,
        connections: true,
        boundaries: true,
      },
    });

    if (!model?.project?.organization) {
      this.sendError(reply, "Model not found");
      return;
    }

    const orgId = model.project.organization.id;
    const settings: AISettings = parseAISettings(
      model.project.organization.aiSettings,
    );

    if (!settings.enabled || settings.provider === "none") {
      this.sendError(reply, "AI not configured");
      return;
    }

    // Decrypt API key if needed
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
      } catch (_error) {
        this.sendError(reply, "Failed to decrypt API key");
        return;
      }
    }

    try {
      // Build architecture context so AI knows about this specific model
      const context: ThreatModelContext = {
        name: model.name,
        methodology: model.project?.organization?.threatMethodology ?? "STRIDE",
        components: (model.components ?? []).map((c) => ({
          id: c.id,
          type: c.type,
          name: c.name,
          description: c.description || undefined,
          properties: c.properties ? JSON.parse(c.properties) : undefined,
        })),
        connections: (model.connections ?? []).map((c) => ({
          id: c.id,
          source: c.sourceComponentId,
          target: c.targetComponentId,
          label: c.label || undefined,
          protocol: c.protocol || undefined,
          encrypted: c.encrypted,
        })),
        boundaries: (model.boundaries ?? []).map((b) => ({
          id: b.id,
          name: b.name,
          trustLevel: b.trustLevel || undefined,
        })),
      };

      const aiService = new AIService(settings, orgId);
      const response = await aiService.chat(
        message,
        history.map((h) => ({
          role: h.role as "user" | "assistant",
          content: h.content,
        })),
        context,
      );

      // Send response as SSE chunks (simulated streaming)
      const words = response.content.split(" ");
      for (let i = 0; i < words.length; i++) {
        const chunk = {
          type: "content",
          content: words[i] + (i < words.length - 1 ? " " : ""),
        };
        reply.raw.write(`data: ${JSON.stringify(chunk)}\n\n`);
      }

      // Send completion
      reply.raw.write(
        `data: ${JSON.stringify({ type: "done", usage: response.usage })}\n\n`,
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "AI request failed";
      this.sendError(reply, message);
    }
  }

  private sendError(reply: FastifyReply, message: string): void {
    reply.raw.write(
      `data: ${JSON.stringify({ type: "error", error: message })}\n\n`,
    );
  }
}

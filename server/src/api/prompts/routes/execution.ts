/**
 * AI Prompts API - Execution Routes
 *
 * Security: All executions use the universal system prompt.
 * Per-template systemPrompt fields are ignored at execution time.
 * Preview endpoint does not return system prompt content.
 */
import type { FastifyPluginAsync } from "fastify";
import { getPrisma } from "../../../db.js";
import {
  getPromptById,
  interpolatePrompt,
  logExecution,
} from "../../../services/ai/prompt-service.js";
import { getUniversalSystemPrompt } from "../../../services/ai/universal-system-prompt.js";
import { getAuthUser, isOrgMember } from "../helpers.js";
import {
  sendSuccess,
  sendNotFound,
  sendBadRequest,
  sendInternalError,
} from "../../../utils/api-response.js";
import { routeAuthz } from "../../../middleware/authz-policy.js";
import { aiGuarded } from "../../ai/guards.js";

const ORG_VIEWER = routeAuthz({ org: "VIEWER" });
const ORG_VIEWER_AI = aiGuarded({ org: "VIEWER" });

export const executionRoutes: FastifyPluginAsync = async (server) => {
  /** Execute a prompt with provided variables */
  server.post<{
    Params: { orgId: string };
    Body: { promptId: string; variables: Record<string, unknown> };
  }>(
    "/api/organizations/:orgId/prompts/execute",
    ORG_VIEWER_AI,
    async (request, reply) => {
      const authUser = getAuthUser(request);
      const { orgId } = request.params;
      const { promptId, variables } = request.body;

      if (!(await isOrgMember(authUser.id, orgId))) {
        return sendNotFound(reply, "Organization");
      }

      const prompt = await getPromptById(promptId);
      if (!prompt) return sendNotFound(reply, "Prompt");
      if (prompt.organizationId && prompt.organizationId !== orgId) {
        return sendNotFound(reply, "Prompt");
      }

      const startTime = Date.now();

      try {
        const taskAddendum = prompt.systemPrompt || undefined;
        const systemPrompt = getUniversalSystemPrompt(taskAddendum);
        const userPrompt = interpolatePrompt(
          prompt.userPromptTemplate,
          variables,
        );

        const prisma = await getPrisma();
        const org = await prisma.organization.findUnique({
          where: { id: orgId },
          select: { aiSettings: true },
        });

        if (!org?.aiSettings) {
          return sendBadRequest(
            reply,
            "AI not configured for this organization",
          );
        }

        const aiSettings = JSON.parse(org.aiSettings);
        if (!aiSettings.enabled) {
          return sendBadRequest(reply, "AI is disabled for this organization");
        }

        const { AIService } = await import(
          "../../../services/ai/ai-service.js"
        );
        const aiService = new AIService(aiSettings, orgId);

        if (!(await aiService.isAvailable())) {
          return reply.status(503).send({ error: "AI service unavailable" });
        }

        const response = await aiService.complete([
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ]);

        const durationMs = Date.now() - startTime;

        await logExecution({
          promptId: prompt.id,
          promptName: prompt.name,
          userId: authUser.id,
          organizationId: orgId,
          inputVariables: variables,
          outputResult: response.content,
          status: "COMPLETED",
          durationMs,
          provider: aiSettings.provider,
          model: aiSettings.model,
        });

        let parsed = null;
        if (prompt.outputFormat === "JSON") {
          try {
            const jsonMatch = response.content.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
            if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
          } catch {
            // Parsing failed
          }
        }

        return sendSuccess(reply, {
          content: response.content,
          parsed,
          promptName: prompt.name,
          durationMs,
        });
      } catch (err) {
        const durationMs = Date.now() - startTime;

        await logExecution({
          promptId: prompt.id,
          promptName: prompt.name,
          userId: authUser.id,
          organizationId: orgId,
          inputVariables: variables,
          status: "FAILED",
          durationMs,
          errorMessage: err instanceof Error ? err.message : "Unknown error",
        });

        return sendInternalError(reply, "Prompt execution failed");
      }
    },
  );

  /** Preview a prompt with variable interpolation (no execution) */
  server.post<{
    Params: { orgId: string };
    Body: { promptId: string; variables: Record<string, unknown> };
  }>(
    "/api/organizations/:orgId/prompts/preview",
    ORG_VIEWER,
    async (request, reply) => {
      const authUser = getAuthUser(request);
      const { orgId } = request.params;
      const { promptId, variables } = request.body;

      if (!(await isOrgMember(authUser.id, orgId))) {
        return sendNotFound(reply, "Organization");
      }

      const prompt = await getPromptById(promptId);
      if (!prompt) return sendNotFound(reply, "Prompt");
      if (prompt.organizationId && prompt.organizationId !== orgId) {
        return sendNotFound(reply, "Prompt");
      }

      const userPrompt = interpolatePrompt(
        prompt.userPromptTemplate,
        variables,
      );

      return sendSuccess(reply, {
        promptName: prompt.name,
        userPrompt,
        temperature: prompt.temperature,
        maxTokens: prompt.maxTokens,
        outputFormat: prompt.outputFormat,
      });
    },
  );
};

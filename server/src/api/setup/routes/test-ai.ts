/**
 * Setup test-ai route
 *
 * Test AI provider connection during setup.
 */
import type { FastifyPluginAsync } from "fastify";
import { getPrisma } from "../../../db.js";
import {
  sendSuccess,
  sendBadRequest,
  sendUnauthorized,
} from "../../../utils/api-response.js";
import { hasValidSetupToken, type AIConfigRequest } from "../index.js";
import { checkAIBaseUrl } from "../../../utils/outbound-url.js";

export const setupTestAiRoutes: FastifyPluginAsync = async (server) => {
  /**
   * POST /api/setup/test-ai
   * Test AI provider connection during setup.
   * PUBLIC - no authentication required (only works if setup not complete).
   * Rate limited: 10 attempts per minute.
   */
  server.post<{ Body: AIConfigRequest }>(
    "/api/setup/test-ai",
    {
      config: {
        rateLimit: {
          max: 10,
          timeWindow: "1 minute",
        },
        authz: {
          public:
            "first-run setup only; needs the setup token in production, refused once setupComplete, rate-limited",
        },
      },
    },
    async (request, reply) => {
      if (!hasValidSetupToken(request)) {
        return sendUnauthorized(
          reply,
          "Enter the setup token from the server log to test the connection.",
        );
      }
      const prisma = await getPrisma();
      const { provider, apiKey, baseUrl } = request.body;

      // Check if setup is already complete
      const settings = await prisma.systemSettings.findUnique({
        where: { id: "default" },
        select: { setupComplete: true },
      });

      if (settings?.setupComplete) {
        return sendBadRequest(
          reply,
          "Use the settings page to test AI connections",
        );
      }

      // Setup often points at a local model server, so private hosts are
      // allowed here; link-local and cloud metadata addresses never are.
      if (baseUrl) {
        const urlError = await checkAIBaseUrl(baseUrl, {
          allowAll: true,
          entries: [],
        });
        if (urlError) return sendBadRequest(reply, urlError);
      }

      // Test connection based on provider
      try {
        if (provider === "ollama") {
          const url = baseUrl || "http://localhost:11434";
          const response = await fetch(`${url}/api/tags`, {
            redirect: "manual",
            signal: AbortSignal.timeout(5000),
          });
          if (!response.ok) {
            return sendSuccess(reply, {
              success: false,
              error: "Ollama not reachable",
            });
          }
          const data = (await response.json()) as {
            models?: Array<{ name: string }>;
          };
          return sendSuccess(reply, {
            success: true,
            models: data.models?.map((m) => m.name) || [],
          });
        }

        if (provider === "lmstudio") {
          const url = baseUrl || "http://localhost:1234/v1";
          const response = await fetch(`${url}/models`, {
            redirect: "manual",
            signal: AbortSignal.timeout(5000),
          });
          if (!response.ok) {
            return sendSuccess(reply, {
              success: false,
              error: "LM Studio not reachable",
            });
          }
          const data = (await response.json()) as {
            data?: Array<{ id: string }>;
          };
          return sendSuccess(reply, {
            success: true,
            models: data.data?.map((m) => m.id) || [],
          });
        }

        if (provider === "anthropic" && apiKey) {
          // Simple validation - check API key format
          if (!apiKey.startsWith("sk-ant-")) {
            return sendSuccess(reply, {
              success: false,
              error: "Invalid Anthropic API key format",
            });
          }
          // In a real implementation, we'd make a test API call
          return sendSuccess(reply, {
            success: true,
            message: "API key format valid",
          });
        }

        if (provider === "openai" && apiKey) {
          // Simple validation - check API key format
          if (!apiKey.startsWith("sk-")) {
            return sendSuccess(reply, {
              success: false,
              error: "Invalid OpenAI API key format",
            });
          }
          return sendSuccess(reply, {
            success: true,
            message: "API key format valid",
          });
        }

        if ((provider === "google" || provider === "vertexai") && apiKey) {
          // Google API keys have various formats, just check minimum length
          if (apiKey.length < 20) {
            return sendSuccess(reply, {
              success: false,
              error: "Invalid Google API key format",
            });
          }
          return sendSuccess(reply, {
            success: true,
            message: "API key format valid",
          });
        }

        if (provider === "none") {
          return sendSuccess(reply, { success: true, message: "AI disabled" });
        }

        return sendSuccess(reply, {
          success: false,
          error: "Unknown provider or missing API key",
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown error";
        return sendSuccess(reply, { success: false, error: message });
      }
    },
  );
};

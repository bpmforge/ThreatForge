/**
 * AI Client Factory
 *
 * Creates AI provider clients based on settings.
 */
import type { AISettings } from "../../types/settings.js";
import type { AIProviderClient } from "../../types/ai.js";
import { ClaudeClient } from "./providers/claude.js";
import { OpenAIClient } from "./providers/openai.js";
import { OllamaClient } from "./providers/ollama.js";
import { GeminiClient } from "./providers/gemini.js";
import { VertexAIClient } from "./providers/vertexai.js";
import { LMStudioClient } from "./providers/lmstudio.js";
import { limitInflight } from "./providers/inflight-limiter.js";
import { meterUsage } from "./providers/usage-meter.js";
import { overrideClient } from "./providers/override-client.js";
import { assertAIEndpointAllowed } from "./private-host-policy.js";

/**
 * Create an AI provider client based on settings. Local endpoints are
 * wrapped so at most MAX_INFLIGHT_PER_PROVIDER (default 1) requests are open.
 * AI-SPEND: every client is metered — each completion's tokens and estimated
 * cost are recorded against `organizationId` (the spend cap reads them).
 * A configured base URL is re-checked against the AI private-host allowlist
 * before each call (it may have been saved before the allowlist existed).
 */
export function createAIClient(
  settings: AISettings,
  organizationId: string,
): AIProviderClient | null {
  const client = createRawClient(settings);
  if (!client) return null;
  const metered = meterUsage(limitInflight(client, settings.baseUrl), {
    organizationId,
    model: settings.model,
    baseUrl: settings.baseUrl,
  });
  return guardEndpoint(metered, settings.baseUrl);
}

/** Refuse calls to a base URL the private-host policy does not allow. */
function guardEndpoint(
  client: AIProviderClient,
  baseUrl: string | undefined,
): AIProviderClient {
  if (!baseUrl) return client;
  return overrideClient(client, {
    complete: async (options) => {
      await assertAIEndpointAllowed(baseUrl);
      return client.complete(options);
    },
    isAvailable: async () => {
      try {
        await assertAIEndpointAllowed(baseUrl);
      } catch {
        return false;
      }
      return client.isAvailable();
    },
  });
}

function createRawClient(settings: AISettings): AIProviderClient | null {
  if (!settings.enabled || settings.provider === "none") {
    return null;
  }

  switch (settings.provider) {
    case "claude":
      if (!settings.apiKey) throw new Error("Claude API key required");
      return new ClaudeClient(
        settings.apiKey,
        settings.model,
        settings.baseUrl,
      );

    case "openai":
      if (!settings.apiKey) throw new Error("OpenAI API key required");
      return new OpenAIClient(
        settings.apiKey,
        settings.model,
        settings.baseUrl,
      );

    case "ollama":
      return new OllamaClient(settings.model, settings.baseUrl);

    case "gemini":
      if (!settings.apiKey) throw new Error("Gemini API key required");
      return new GeminiClient(
        settings.apiKey,
        settings.model,
        settings.baseUrl,
      );

    case "vertexai":
      if (!settings.projectId)
        throw new Error("Google Cloud Project ID required for Vertex AI");
      return new VertexAIClient(settings.projectId, {
        location: settings.region,
        model: settings.model,
      });

    case "lmstudio":
      return new LMStudioClient(settings.baseUrl, settings.model);

    default:
      return null;
  }
}

/** Check if a provider supports vision/image analysis. */
export function supportsVision(provider: string): boolean {
  const visionProviders = ["claude", "openai", "gemini", "vertexai"];
  return visionProviders.includes(provider);
}

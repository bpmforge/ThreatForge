/**
 * LM Studio Provider Client
 *
 * LM Studio provides an OpenAI-compatible API for local LLMs.
 * Default endpoint: http://localhost:1234/v1
 */
import { ProviderRetriesExhaustedError } from "../provider-errors.js";
import type {
  AIProviderClient,
  AICompletionOptions,
  AICompletionResponse,
} from "../../../types/ai.js";
import { completionSignal, isAbortError } from "../provider-timeout.js";
import { normalizeFinishReason } from "./finish-reason.js";

interface LMStudioMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface LMStudioResponse {
  id?: string;
  object?: string;
  created?: number;
  model?: string;
  choices?: Array<{
    index?: number;
    message?: { role?: string; content?: string };
    finish_reason?: string;
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  error?: { message?: string; type?: string; code?: string };
}

interface LMStudioModel {
  id: string;
  object: string;
  owned_by: string;
}

interface LMStudioModelsResponse {
  object: string;
  data: LMStudioModel[];
}

export class LMStudioClient implements AIProviderClient {
  readonly provider = "lmstudio" as const;
  private baseUrl: string;
  private model: string;

  constructor(baseUrl?: string, model?: string) {
    this.baseUrl = baseUrl || "http://localhost:1234/v1";
    // LM Studio uses the loaded model, but we can specify preference
    this.model = model || "local-model";
  }

  async complete(options: AICompletionOptions): Promise<AICompletionResponse> {
    // Convert to OpenAI-compatible format (LM Studio supports this natively)
    const messages: LMStudioMessage[] = options.messages.map((m) => ({
      role: m.role,
      content: String(m.content),
    }));

    const requestBody = {
      model: this.model,
      messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens || 4096,
      stream: false,
    };

    return this.completeWithRetry(requestBody, 1, options.signal);
  }

  /**
   * Call /chat/completions with retry on transient LM Studio errors.
   *
   * LM Studio's local model loader periodically reports the model as
   * crashed on first inference after a long idle (Exit code: null) — the
   * model is then automatically reloaded and the next call succeeds. We
   * retry up to MAX_RETRIES times with linear backoff for known transient
   * patterns; non-transient errors (auth, schema, true OOM) bubble out
   * immediately on the first response.
   */
  private async completeWithRetry(
    requestBody: unknown,
    attempt = 1,
    callerSignal?: AbortSignal,
  ): Promise<AICompletionResponse> {
    const MAX_RETRIES = 3;
    const BASE_BACKOFF_MS = 5_000;

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/chat/completions`, {
        redirect: "manual",
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
        signal: completionSignal(callerSignal),
      });
    } catch (err) {
      // An abort is NOT transient. This catch treats every network-level
      // throw as retryable, so without this guard the timeout would be
      // multiplied by MAX_RETRIES (plus backoff) and then again by the
      // pipeline's own retry loop — strictly worse than having no timeout.
      if (isAbortError(err)) throw err;
      // Network-level failure (ECONNREFUSED / channel closed) — treat as
      // transient. Retry until exhausted.
      if (attempt < MAX_RETRIES) {
        await sleep(BASE_BACKOFF_MS * attempt);
        return this.completeWithRetry(requestBody, attempt + 1, callerSignal);
      }
      throw new ProviderRetriesExhaustedError(
        `LM Studio unreachable after ${MAX_RETRIES} attempts: ${err instanceof Error ? err.message : String(err)}`,
        { cause: err },
      );
    }

    if (!response.ok) {
      const errorText = await response.text();
      const message = `LM Studio error: ${response.status} - ${errorText}`;
      if (isTransientLmStudioError(response.status, errorText)) {
        if (attempt < MAX_RETRIES) {
          await sleep(BASE_BACKOFF_MS * attempt);
          return this.completeWithRetry(requestBody, attempt + 1, callerSignal);
        }
        // Already retried here; callers must not retry (or shrink the prompt).
        throw new ProviderRetriesExhaustedError(message);
      }
      throw new Error(message);
    }

    const data = (await response.json()) as LMStudioResponse;

    if (data.error) {
      throw new Error(`LM Studio error: ${data.error.message}`);
    }

    const content = data.choices?.[0]?.message?.content || "";
    const actualModel = data.model || this.model;

    return {
      content,
      usage: data.usage
        ? {
            promptTokens: data.usage.prompt_tokens || 0,
            completionTokens: data.usage.completion_tokens || 0,
            totalTokens: data.usage.total_tokens || 0,
          }
        : undefined,
      provider: "lmstudio",
      model: actualModel,
      finishReason: normalizeFinishReason(data.choices?.[0]?.finish_reason),
    };
  }

  async isAvailable(): Promise<boolean> {
    try {
      // LM Studio exposes OpenAI-compatible /models endpoint
      const response = await fetch(`${this.baseUrl}/models`, {
        redirect: "manual",
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) {
        return false;
      }

      // Check if at least one model is loaded
      const data = (await response.json()) as LMStudioModelsResponse;
      return Array.isArray(data.data) && data.data.length > 0;
    } catch {
      return false;
    }
  }

  /**
   * List available models loaded in LM Studio
   */
  async listModels(): Promise<string[]> {
    try {
      const response = await fetch(`${this.baseUrl}/models`, {
        redirect: "manual",
      });
      if (!response.ok) {
        return [];
      }
      const data = (await response.json()) as LMStudioModelsResponse;
      return data.data?.map((m) => m.id) || [];
    } catch {
      return [];
    }
  }

  /**
   * Warm-up call. Sends a tiny throwaway completion so the model is loaded
   * and stable before throughput work. Uses the same retry path so a cold
   * "model crashed" on the first ping doesn't fail the warm-up.
   * Safe to call repeatedly; latency-sensitive callers should run this
   * once at process start.
   */
  async warmUp(): Promise<void> {
    try {
      await this.complete({
        messages: [{ role: "user", content: "ping" }],
        temperature: 0,
        maxTokens: 4,
      });
    } catch {
      // Warm-up is best-effort — if the model can't load, the next real
      // call will surface the error normally.
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * LM Studio surfaces transient model-loader failures as HTTP 400 with one
 * of these signatures in the response body. The model is auto-reloaded by
 * the server after the failure, so the next attempt usually succeeds.
 */
function isTransientLmStudioError(status: number, body: string): boolean {
  // 5xx → server-side transient
  if (status >= 500) return true;
  // 408 / 429 → timeout / rate-limit, retry-friendly
  if (status === 408 || status === 429) return true;
  // 400 only when the body matches a known transient pattern. A genuine
  // schema error returns 400 too — those should NOT retry.
  if (status === 400) {
    const lc = body.toLowerCase();
    return (
      lc.includes("model has crashed") ||
      lc.includes("exit code: null") ||
      lc.includes("model is loading") ||
      lc.includes("channel closed") ||
      lc.includes("no model loaded")
    );
  }
  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

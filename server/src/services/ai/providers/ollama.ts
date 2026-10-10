/**
 * Ollama Provider Client (local LLM)
 */
import type {
  AIProviderClient,
  AICompletionOptions,
  AICompletionResponse,
} from "../../../types/ai.js";
import { completionSignal } from "../provider-timeout.js";
import { normalizeFinishReason } from "./finish-reason.js";

interface OllamaResponse {
  message?: { content: string };
  eval_count?: number;
  prompt_eval_count?: number;
  done_reason?: string;
}

export class OllamaClient implements AIProviderClient {
  readonly provider = "ollama" as const;
  private baseUrl: string;
  private model: string;

  constructor(model?: string, baseUrl?: string) {
    this.model = model || "llama3";
    this.baseUrl = baseUrl || "http://localhost:11434";
  }

  async complete(options: AICompletionOptions): Promise<AICompletionResponse> {
    const systemMessage = options.messages.find((m) => m.role === "system");
    const otherMessages = options.messages.filter((m) => m.role !== "system");

    const response = await fetch(`${this.baseUrl}/api/chat`, {
      redirect: "manual",
      method: "POST",
      signal: completionSignal(options.signal),
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: this.model,
        messages: [
          ...(systemMessage
            ? [{ role: "system", content: systemMessage.content }]
            : []),
          ...otherMessages.map((m) => ({ role: m.role, content: m.content })),
        ],
        stream: false,
        options: {
          temperature: options.temperature ?? 0.7,
          num_predict: options.maxTokens || 4096,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Ollama API error: ${response.status} - ${error}`);
    }

    const data = (await response.json()) as OllamaResponse;

    return {
      content: data.message?.content || "",
      usage: data.eval_count
        ? {
            promptTokens: data.prompt_eval_count || 0,
            completionTokens: data.eval_count || 0,
            totalTokens: (data.prompt_eval_count || 0) + (data.eval_count || 0),
          }
        : undefined,
      provider: "ollama",
      model: this.model,
      finishReason: normalizeFinishReason(data.done_reason),
    };
  }

  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        redirect: "manual",
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}

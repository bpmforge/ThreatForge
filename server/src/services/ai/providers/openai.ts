/**
 * OpenAI Provider Client
 *
 * Supports both text and multimodal (vision) requests.
 * Vision models: gpt-4o, gpt-4-turbo, gpt-4-vision-preview
 */
import type {
  AIProviderClient,
  AICompletionOptions,
  AICompletionResponse,
  AIMessage,
  MultimodalContent,
} from "../../../types/ai.js";
import { completionSignal } from "../provider-timeout.js";
import { normalizeFinishReason } from "./finish-reason.js";

interface OpenAIResponse {
  choices?: Array<{
    message?: { content: string };
    finish_reason?: string | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/** OpenAI content block format */
type OpenAIContentBlock =
  | { type: "text"; text: string }
  | {
      type: "image_url";
      image_url: { url: string; detail?: "auto" | "low" | "high" };
    };

export class OpenAIClient implements AIProviderClient {
  readonly provider = "openai" as const;
  private apiKey: string;
  private baseUrl: string;
  private model: string;

  constructor(apiKey: string, model?: string, baseUrl?: string) {
    this.apiKey = apiKey;
    this.model = model || "gpt-4o";
    this.baseUrl = baseUrl || "https://api.openai.com";
  }

  /**
   * Convert our message format to OpenAI's format
   * OpenAI expects: { role, content: string | ContentBlock[] }
   */
  private formatMessageForOpenAI(message: AIMessage): {
    role: string;
    content: string | OpenAIContentBlock[];
  } {
    const { role, content } = message;

    // If content is a simple string, return as-is
    if (typeof content === "string") {
      return { role, content };
    }

    // Convert multimodal content blocks to OpenAI format
    const openaiContent: OpenAIContentBlock[] = content.map((block) => {
      if (block.type === "text") {
        return { type: "text", text: block.text };
      }
      if (block.type === "image") {
        // Convert base64 to data URL format that OpenAI expects
        const dataUrl = `data:${block.source.media_type};base64,${block.source.data}`;
        return {
          type: "image_url",
          image_url: { url: dataUrl, detail: "auto" },
        };
      }
      if (block.type === "image_url") {
        // OpenAI native format
        return {
          type: "image_url",
          image_url: {
            url: block.image_url.url,
            detail: block.image_url.detail || "auto",
          },
        };
      }
      throw new Error(
        `Unknown content block type: ${(block as MultimodalContent).type}`,
      );
    });

    return { role, content: openaiContent };
  }

  async complete(options: AICompletionOptions): Promise<AICompletionResponse> {
    // Format messages for OpenAI API
    const formattedMessages = options.messages.map((m) =>
      this.formatMessageForOpenAI(m),
    );

    const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      redirect: "manual",
      method: "POST",
      signal: completionSignal(options.signal),
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: options.maxTokens || 4096,
        messages: formattedMessages,
        temperature: options.temperature ?? 0.7,
        ...(options.thinking === undefined
          ? {}
          : { enable_thinking: options.thinking }),
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${error}`);
    }

    const data = (await response.json()) as OpenAIResponse;
    const content = data.choices?.[0]?.message?.content || "";

    return {
      content,
      usage: data.usage
        ? {
            promptTokens: data.usage.prompt_tokens,
            completionTokens: data.usage.completion_tokens,
            totalTokens: data.usage.total_tokens,
          }
        : undefined,
      provider: "openai",
      model: this.model,
      finishReason: normalizeFinishReason(data.choices?.[0]?.finish_reason),
    };
  }

  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/v1/models`, {
        redirect: "manual",
        headers: { Authorization: `Bearer ${this.apiKey}` },
      });
      return response.ok;
    } catch {
      // best-effort — intentionally silent
      return false;
    }
  }
}

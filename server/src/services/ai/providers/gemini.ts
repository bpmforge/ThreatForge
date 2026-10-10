/**
 * Google Gemini Provider Client
 *
 * Supports both Gemini API (ai.google.dev) and Vertex AI (cloud.google.com)
 * Vision models: gemini-1.5-pro, gemini-1.5-flash, gemini-pro-vision
 */
import type {
  AIProviderClient,
  AICompletionOptions,
  AICompletionResponse,
  AIMessage,
  MultimodalContent,
} from "../../../types/ai.js";
import { extractTextFromContent } from "../../../types/ai.js";
import { completionSignal } from "../provider-timeout.js";
import { normalizeFinishReason } from "./finish-reason.js";

/** Gemini part types */
type GeminiPart =
  | { text: string }
  | { inline_data: { mime_type: string; data: string } };

interface GeminiContent {
  parts: GeminiPart[];
  role: "user" | "model";
}

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    finishReason?: string;
  }>;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
  error?: { message?: string; code?: number };
}

export class GeminiClient implements AIProviderClient {
  readonly provider = "gemini" as const;
  private apiKey: string;
  private model: string;
  private baseUrl: string;

  constructor(apiKey: string, model?: string, baseUrl?: string) {
    this.apiKey = apiKey;
    this.model = model || "gemini-1.5-flash";
    // Default to Google AI Studio API
    this.baseUrl =
      baseUrl || "https://generativelanguage.googleapis.com/v1beta";
  }

  /**
   * Convert our message format to Gemini's format
   * Gemini uses: { role, parts: [{ text } | { inline_data: { mime_type, data } }] }
   */
  private formatMessageForGemini(message: AIMessage): GeminiContent {
    const role = message.role === "assistant" ? "model" : "user";
    const content = message.content;

    // If content is a simple string, wrap in parts array
    if (typeof content === "string") {
      return { role, parts: [{ text: content }] };
    }

    // Convert multimodal content blocks to Gemini format
    const parts: GeminiPart[] = content.map((block) => {
      if (block.type === "text") {
        return { text: block.text };
      }
      if (block.type === "image") {
        // Gemini native format
        return {
          inline_data: {
            mime_type: block.source.media_type,
            data: block.source.data,
          },
        };
      }
      if (block.type === "image_url") {
        // Convert data URL to inline_data
        const url = block.image_url.url;
        if (url.startsWith("data:")) {
          const [header, data] = url.split(",");
          const mimeType = header.match(/data:([^;]+)/)?.[1] || "image/png";
          return {
            inline_data: {
              mime_type: mimeType,
              data,
            },
          };
        }
        // Gemini doesn't support remote URLs directly
        throw new Error(
          "Gemini does not support remote image URLs. Use base64 encoding.",
        );
      }
      throw new Error(
        `Unknown content block type: ${(block as MultimodalContent).type}`,
      );
    });

    return { role, parts };
  }

  async complete(options: AICompletionOptions): Promise<AICompletionResponse> {
    // Convert messages to Gemini format
    const systemMessage = options.messages.find((m) => m.role === "system");
    const conversationMessages = options.messages.filter(
      (m) => m.role !== "system",
    );

    // Format conversation messages (supports multimodal)
    const contents: GeminiContent[] = conversationMessages.map((m) =>
      this.formatMessageForGemini(m),
    );

    // System instruction is separate in Gemini API (text only)
    const requestBody: Record<string, unknown> = {
      contents,
      generationConfig: {
        temperature: options.temperature ?? 0.7,
        maxOutputTokens: options.maxTokens || 8192,
        topP: 0.95,
      },
    };

    if (systemMessage) {
      const systemText =
        typeof systemMessage.content === "string"
          ? systemMessage.content
          : extractTextFromContent(systemMessage.content);
      requestBody.systemInstruction = {
        parts: [{ text: systemText }],
      };
    }

    const url = `${this.baseUrl}/models/${this.model}:generateContent?key=${this.apiKey}`;

    const response = await fetch(url, {
      redirect: "manual",
      method: "POST",
      signal: completionSignal(options.signal),
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
    }

    const data = (await response.json()) as GeminiResponse;

    if (data.error) {
      throw new Error(`Gemini error: ${data.error.message}`);
    }

    const content = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

    return {
      content,
      usage: data.usageMetadata
        ? {
            promptTokens: data.usageMetadata.promptTokenCount || 0,
            completionTokens: data.usageMetadata.candidatesTokenCount || 0,
            totalTokens: data.usageMetadata.totalTokenCount || 0,
          }
        : undefined,
      provider: "gemini",
      model: this.model,
      finishReason: normalizeFinishReason(data.candidates?.[0]?.finishReason),
    };
  }

  async isAvailable(): Promise<boolean> {
    try {
      // Simple health check - list models
      const response = await fetch(
        `${this.baseUrl}/models?key=${this.apiKey}`,
        { redirect: "manual" },
      );
      return response.ok;
    } catch {
      // best-effort — intentionally silent
      return false;
    }
  }
}

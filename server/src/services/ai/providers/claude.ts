/**
 * Claude AI Provider Client
 *
 * Supports both text and multimodal (vision) requests.
 * Claude Vision models: claude-3-opus, claude-3-sonnet, claude-3-haiku, claude-sonnet-4
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

interface ClaudeResponse {
  content?: Array<{ type: string; text?: string }>;
  usage?: { input_tokens: number; output_tokens: number };
  stop_reason?: string | null;
}

/** Claude content block format */
type ClaudeContentBlock =
  | { type: "text"; text: string }
  | {
      type: "image";
      source: { type: "base64"; media_type: string; data: string };
    };

export class ClaudeClient implements AIProviderClient {
  readonly provider = "claude" as const;
  private apiKey: string;
  private baseUrl: string;
  private model: string;

  constructor(apiKey: string, model?: string, baseUrl?: string) {
    this.apiKey = apiKey;
    this.model = model || "claude-sonnet-4-20250514";
    this.baseUrl = baseUrl || "https://api.anthropic.com";
  }

  /**
   * Convert our message format to Claude's format
   * Claude expects: { role, content: string | ContentBlock[] }
   */
  private formatMessageForClaude(message: AIMessage): {
    role: string;
    content: string | ClaudeContentBlock[];
  } {
    const { role, content } = message;

    // If content is a simple string, return as-is
    if (typeof content === "string") {
      return { role, content };
    }

    // Convert multimodal content blocks to Claude format
    const claudeContent: ClaudeContentBlock[] = content.map((block) => {
      if (block.type === "text") {
        return { type: "text", text: block.text };
      }
      if (block.type === "image") {
        // Claude native format
        return {
          type: "image",
          source: {
            type: "base64",
            media_type: block.source.media_type,
            data: block.source.data,
          },
        };
      }
      if (block.type === "image_url") {
        // Convert image_url to base64 if it's a data URL
        const url = block.image_url.url;
        if (url.startsWith("data:")) {
          const [header, data] = url.split(",");
          const mediaType = header.match(/data:([^;]+)/)?.[1] || "image/png";
          return {
            type: "image",
            source: {
              type: "base64",
              media_type: mediaType,
              data,
            },
          };
        }
        // For remote URLs, Claude doesn't support them directly
        // Would need to fetch and convert - for now, skip
        throw new Error(
          "Claude does not support remote image URLs. Use base64 encoding.",
        );
      }
      throw new Error(
        `Unknown content block type: ${(block as MultimodalContent).type}`,
      );
    });

    return { role, content: claudeContent };
  }

  async complete(options: AICompletionOptions): Promise<AICompletionResponse> {
    const systemMessage = options.messages.find((m) => m.role === "system");
    const otherMessages = options.messages.filter((m) => m.role !== "system");

    // Extract system content as string (system messages don't support images)
    const systemContent = systemMessage
      ? typeof systemMessage.content === "string"
        ? systemMessage.content
        : extractTextFromContent(systemMessage.content)
      : undefined;

    // Format messages for Claude API
    const formattedMessages = otherMessages.map((m) =>
      this.formatMessageForClaude(m),
    );

    const response = await fetch(`${this.baseUrl}/v1/messages`, {
      redirect: "manual",
      method: "POST",
      signal: completionSignal(options.signal),
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: options.maxTokens || 4096,
        system: systemContent,
        messages: formattedMessages,
        temperature: options.temperature ?? 0.7,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Claude API error: ${response.status} - ${error}`);
    }

    const data = (await response.json()) as ClaudeResponse;
    const content = data.content?.find((c) => c.type === "text")?.text || "";

    return {
      content,
      usage: data.usage
        ? {
            promptTokens: data.usage.input_tokens,
            completionTokens: data.usage.output_tokens,
            totalTokens: data.usage.input_tokens + data.usage.output_tokens,
          }
        : undefined,
      provider: "claude",
      model: this.model,
      finishReason: normalizeFinishReason(data.stop_reason),
    };
  }

  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/v1/messages`, {
        redirect: "manual",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": this.apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: 10,
          messages: [{ role: "user", content: "ping" }],
        }),
      });
      return response.ok || response.status === 400; // 400 means valid auth
    } catch {
      // best-effort — intentionally silent
      return false;
    }
  }
}

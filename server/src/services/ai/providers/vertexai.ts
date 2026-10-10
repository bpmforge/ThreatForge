/**
 * Google Vertex AI Provider Client
 *
 * Uses Google Cloud Vertex AI with service account authentication.
 * Requires GOOGLE_APPLICATION_CREDENTIALS or explicit credentials.
 */
import type {
  AIProviderClient,
  AICompletionOptions,
  AICompletionResponse,
} from "../../../types/ai.js";
import { completionSignal } from "../provider-timeout.js";
import { normalizeFinishReason } from "./finish-reason.js";

interface VertexAIContent {
  parts: Array<{ text: string }>;
  role: "user" | "model";
}

interface VertexAIResponse {
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

export class VertexAIClient implements AIProviderClient {
  readonly provider = "vertexai" as const;
  private projectId: string;
  private location: string;
  private model: string;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  constructor(
    projectId: string,
    options?: {
      location?: string;
      model?: string;
    },
  ) {
    const location = options?.location || "us-central1";
    // Both values are interpolated into the request URL that carries the
    // platform's Google credentials, so only well-formed identifiers pass.
    if (!/^[a-z]+(-[a-z]+)*\d+$/.test(location)) {
      throw new Error(`Invalid Vertex AI region: ${location}`);
    }
    if (!/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(projectId)) {
      throw new Error("Invalid Google Cloud project ID");
    }
    const model = options?.model || "gemini-1.5-flash";
    if (!/^[a-z0-9][a-z0-9.@-]*$/.test(model)) {
      throw new Error(`Invalid Vertex AI model: ${model}`);
    }
    this.projectId = projectId;
    this.location = location;
    this.model = model;
  }

  /**
   * Get access token using Application Default Credentials (ADC).
   * In production, this uses the service account from GOOGLE_APPLICATION_CREDENTIALS.
   * Locally, use `gcloud auth application-default login`.
   */
  private async getAccessToken(): Promise<string> {
    // Return cached token if still valid (with 5 min buffer)
    if (this.accessToken && Date.now() < this.tokenExpiry - 300000) {
      return this.accessToken;
    }

    // Use Google Auth Library pattern via metadata server or ADC
    const metadataUrl =
      "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token";

    try {
      // Try metadata server first (works in GCP)
      const response = await fetch(metadataUrl, {
        headers: { "Metadata-Flavor": "Google" },
      });

      if (response.ok) {
        const data = (await response.json()) as {
          access_token: string;
          expires_in: number;
        };
        this.accessToken = data.access_token;
        this.tokenExpiry = Date.now() + data.expires_in * 1000;
        return this.accessToken;
      }
    } catch {
      // Not running on GCP, fall through to ADC
    }

    // Fall back to gcloud CLI token (for local development)
    try {
      const { execSync } = await import("child_process");
      const token = execSync(
        "gcloud auth application-default print-access-token",
        {
          encoding: "utf-8",
        },
      ).trim();
      this.accessToken = token;
      // Assume 1 hour expiry for CLI tokens
      this.tokenExpiry = Date.now() + 3600000;
      return this.accessToken;
    } catch {
      throw new Error(
        "Failed to obtain Google Cloud access token. " +
          'Set GOOGLE_APPLICATION_CREDENTIALS or run "gcloud auth application-default login"',
      );
    }
  }

  async complete(options: AICompletionOptions): Promise<AICompletionResponse> {
    const accessToken = await this.getAccessToken();

    // Convert messages to Vertex AI format
    const systemMessage = options.messages.find((m) => m.role === "system");
    const conversationMessages = options.messages.filter(
      (m) => m.role !== "system",
    );

    // Vertex AI uses 'user' and 'model' roles
    const contents: VertexAIContent[] = conversationMessages.map((m) => ({
      parts: [{ text: String(m.content) }],
      role: m.role === "assistant" ? "model" : "user",
    }));

    // System instruction is separate in Vertex AI
    const requestBody: Record<string, unknown> = {
      contents,
      generationConfig: {
        temperature: options.temperature ?? 0.7,
        maxOutputTokens: options.maxTokens || 8192,
        topP: 0.95,
      },
    };

    if (systemMessage) {
      requestBody.systemInstruction = {
        parts: [{ text: systemMessage.content }],
      };
    }

    const url = `https://${this.location}-aiplatform.googleapis.com/v1/projects/${this.projectId}/locations/${this.location}/publishers/google/models/${this.model}:generateContent`;

    const response = await fetch(url, {
      method: "POST",
      signal: completionSignal(options.signal),
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Vertex AI error: ${response.status} - ${errorText}`);
    }

    const data = (await response.json()) as VertexAIResponse;

    if (data.error) {
      throw new Error(`Vertex AI error: ${data.error.message}`);
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
      provider: "vertexai",
      model: this.model,
      finishReason: normalizeFinishReason(data.candidates?.[0]?.finishReason),
    };
  }

  async isAvailable(): Promise<boolean> {
    try {
      await this.getAccessToken();
      return true;
    } catch {
      return false;
    }
  }
}

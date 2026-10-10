/**
 * AI Service Types
 */
import type { AIProvider } from "./settings.js";

// =============================================================================
// Multimodal Content Types
// =============================================================================

/** Text content block */
interface TextContent {
  type: "text";
  text: string;
}

/** Image content block (base64 encoded) */
interface ImageContent {
  type: "image";
  source: {
    type: "base64";
    media_type: "image/png" | "image/jpeg" | "image/gif" | "image/webp";
    data: string; // Base64 encoded image data (without data URL prefix)
  };
}

/** Image content block (URL) */
interface ImageUrlContent {
  type: "image_url";
  image_url: {
    url: string; // URL or data URL
    detail?: "auto" | "low" | "high";
  };
}

/** Multimodal content can be text, base64 image, or image URL */
export type MultimodalContent = TextContent | ImageContent | ImageUrlContent;

/** Message content can be a simple string or array of multimodal blocks */
export type MessageContent = string | MultimodalContent[];

// =============================================================================
// Message Types
// =============================================================================

/** Message format for AI conversations (supports multimodal) */
export interface AIMessage {
  role: "system" | "user" | "assistant";
  content: MessageContent;
}

// =============================================================================
// Completion Options
// =============================================================================

/** Options for AI completion requests */
export interface AICompletionOptions {
  messages: AIMessage[];
  temperature?: number;
  maxTokens?: number;
  /**
   * Request thinking on/off. OpenAI-compatible servers that support it
   * (MTPLX) read top-level `enable_thinking`; unset keeps the server default.
   */
  thinking?: boolean;
  stream?: boolean;
  /**
   * Caller's cancellation signal. Combined with the per-call timeout in
   * `provider-timeout.ts` so a cancelled job aborts the in-flight request
   * instead of waiting the request out. Optional — callers that don't thread a
   * signal still get the timeout.
   */
  signal?: AbortSignal;
}

/** Extract text from multimodal content */
export function extractTextFromContent(content: MessageContent): string {
  if (typeof content === "string") {
    return content;
  }
  return content
    .filter((block): block is TextContent => block.type === "text")
    .map((block) => block.text)
    .join("\n");
}

/** Response from AI completion */
export interface AICompletionResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  provider: AIProvider;
  model: string;
  /**
   * Why generation stopped, normalised across providers. `length` means the
   * reply hit the max-tokens cap and may be a truncated (partial) list.
   * Optional: mock / replay providers need not set it.
   */
  finishReason?: FinishReason;
}

/** Normalised completion stop reason. */
export type FinishReason = "stop" | "length" | "other";

/** Context about a component for threat analysis */
export interface ComponentContext {
  id: string;
  type: string;
  name: string;
  description?: string;
  properties?: Record<string, unknown>;
  trustZone?: string;
}

/** Context about a connection for threat analysis */
interface ConnectionContext {
  id: string;
  source: string;
  target: string;
  label?: string;
  protocol?: string;
  /**
   * How the caller authenticates on this hop (Prisma `AuthMethod`, as a string).
   * Prompt-visible: without it every connection renders `auth=none` and the LLM
   * is told the architecture is unauthenticated.
   */
  authentication?: string;
  dataTypes?: string[];
  encrypted?: boolean;
}

/** Sequence diagram data for enriching threat analysis */
export interface SequenceFlowContext {
  diagramName: string;
  messages: Array<{
    from: string;
    to: string;
    label: string;
    protocol?: string;
    authentication?: string;
    notes?: string;
  }>;
}

/** Threat model context for AI analysis */
export interface ThreatModelContext {
  name: string;
  components: ComponentContext[];
  connections: ConnectionContext[];
  boundaries: Array<{ id: string; name: string; trustLevel?: string }>;
  /** Sequence diagram flows for richer analysis */
  sequenceFlows?: SequenceFlowContext[];
  /** Threat modeling methodology configured for the organization */
  methodology?: string;
  /** Imported requirements (SRS/SAD/CSV/framework) — injected into mitigation prompts for traceability. */
  requirements?: Array<{
    reqId: string;
    text: string;
    category?: string | null;
    docId?: string | null;
  }>;
}

/** Suggested threat from AI */
export interface AISuggestedThreat {
  title: string;
  description: string;
  category:
    | "SPOOFING"
    | "TAMPERING"
    | "REPUDIATION"
    | "INFO_DISCLOSURE"
    | "DENIAL_OF_SERVICE"
    | "ELEVATION_OF_PRIVILEGE";
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";
  targetComponentId?: string;
  /** Legacy prompt asks for the component NAME; resolved to targetComponentId server-side. */
  targetComponent?: string;
  targetConnectionId?: string;
  mitigation?: string;
  confidence: number;
  /**
   * Citation-verifier preview attached server-side after suggestion is
   * generated. Present only when threat-model documents exist and the
   * suggest endpoint ran preview verification. Persisted later when the
   * user accepts the suggestion.
   */
  verification?: {
    status: "PENDING" | "VERIFIED" | "UNVERIFIED" | "PHANTOM" | "EXEMPT";
    citations: Array<{
      type: "DOCUMENT" | "REFERENCE" | "COMPONENT" | "REQUIREMENT" | "NONE";
      documentName?: string;
      sectionAnchor?: string;
      pageNumber?: number;
      referenceId?: string;
      componentNodeId?: string;
      requirementId?: string;
      confidence?: number;
      rationale: string;
    }>;
  };
}

/** Suggested mitigation from AI */
export interface AISuggestedMitigation {
  title: string;
  description: string;
  implementation?: string;
  effectivenessScore: number;
  /**
   * Populated ONLY when no imported requirement matched this mitigation.
   * The LLM proposes a one-sentence policy-grade requirement the user
   * can accept/reject/modify; persistence writes it with source=AI_SUGGESTED
   * and reviewStatus=PENDING.
   */
  suggestedRequirement?: {
    text: string;
    category?: string;
  } | null;
}

/** Interface for AI provider implementations */
export interface AIProviderClient {
  readonly provider: AIProvider;
  complete(options: AICompletionOptions): Promise<AICompletionResponse>;
  isAvailable(): Promise<boolean>;
}

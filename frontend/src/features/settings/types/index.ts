/**
 * Settings type definitions - mirrored from server.
 */

/** Supported AI providers (legacy single-provider) */
export type AIProvider = "claude" | "openai" | "ollama" | "lmstudio" | "none";

/** AI Provider types for multi-provider support */
export type AIProviderType =
  | "ANTHROPIC"
  | "OPENAI"
  | "AZURE_OPENAI"
  | "GOOGLE"
  | "OLLAMA"
  | "LMSTUDIO"
  | "OPENROUTER"
  | "CUSTOM";

type AIAuthType = "API_KEY" | "OAUTH" | "NONE";
type AITestStatus = "SUCCESS" | "FAILED" | "PENDING";

/** Configured AI provider instance */
export interface AIProviderConfig {
  id: string;
  name: string;
  type: AIProviderType;
  isDefault: boolean;
  priority: number;
  isEnabled: boolean;
  authType: AIAuthType;
  hasApiKey: boolean;
  baseUrl: string | null;
  model: string | null;
  lastTestedAt: string | null;
  lastTestStatus: AITestStatus | null;
  lastTestError: string | null;
  totalRequests: number;
  totalTokens: number;
  estimatedCost: number;
  usageResetAt: string;
  createdAt: string;
  updatedAt: string;
}

/** Create/update provider request */
export interface AIProviderInput {
  name: string;
  type: AIProviderType;
  authType?: AIAuthType;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  isDefault?: boolean;
  isEnabled?: boolean;
  priority?: number;
}

/** Provider type display info */
export const AI_PROVIDER_TYPES: {
  value: AIProviderType;
  label: string;
  description: string;
}[] = [
  {
    value: "ANTHROPIC",
    label: "Anthropic Claude",
    description: "Claude 4, Claude 3.5 Sonnet/Haiku",
  },
  { value: "OPENAI", label: "OpenAI", description: "GPT-4o, GPT-4o-mini" },
  {
    value: "AZURE_OPENAI",
    label: "Azure OpenAI",
    description: "OpenAI models via Azure",
  },
  {
    value: "GOOGLE",
    label: "Google Gemini",
    description: "Gemini Pro, Gemini Flash",
  },
  {
    value: "OLLAMA",
    label: "Ollama (Local)",
    description: "Self-hosted, runs locally",
  },
  {
    value: "LMSTUDIO",
    label: "LM Studio (Local)",
    description: "Local LLM via LM Studio",
  },
  {
    value: "OPENROUTER",
    label: "OpenRouter",
    description: "Access multiple providers via API",
  },
  {
    value: "CUSTOM",
    label: "Custom Endpoint",
    description: "OpenAI-compatible API",
  },
];

/** AI configuration at organization level */
export interface AISettings {
  enabled: boolean;
  provider: AIProvider;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  features: {
    autoSuggestThreats: boolean;
    autoSuggestMitigations: boolean;
    enableChat: boolean;
    /**
     * agent-chain-v2: route SUGGEST_THREATS through the unified
     * 8-stage orchestrator instead of the legacy micro-analysis path. Per-org,
     * default OFF during rollout.
     */
    agentChainV2?: boolean;
  };
  guardrails: {
    monthlyBudget: number;
    anonymizeData: boolean;
    logInteractions: boolean;
  };
}

/** AI status response from server */
export interface AIStatus {
  enabled: boolean;
  configured: boolean;
  provider: AIProvider;
  features: AISettings["features"];
}

/** Default AI settings */
export const DEFAULT_AI_SETTINGS: AISettings = {
  enabled: false,
  provider: "none",
  features: {
    autoSuggestThreats: false,
    autoSuggestMitigations: false,
    enableChat: false,
    agentChainV2: true,
  },
  guardrails: {
    monthlyBudget: 0,
    anonymizeData: false,
    logInteractions: true,
  },
};

/** Provider display info */
export const AI_PROVIDERS: {
  value: AIProvider;
  label: string;
  description: string;
}[] = [
  { value: "none", label: "None", description: "AI features disabled" },
  {
    value: "claude",
    label: "Anthropic Claude",
    description: "Claude 3.5 Sonnet, Haiku",
  },
  { value: "openai", label: "OpenAI", description: "GPT-4o, GPT-4o-mini" },
  {
    value: "ollama",
    label: "Ollama (Local)",
    description: "Self-hosted, runs locally",
  },
  {
    value: "lmstudio",
    label: "LM Studio (Local)",
    description: "Local LLM via LM Studio",
  },
];

/** Model options by provider */
export const AI_MODELS: Record<AIProvider, { value: string; label: string }[]> =
  {
    none: [],
    claude: [
      {
        value: "claude-sonnet-4-20250514",
        label: "Claude Sonnet 4 (Recommended)",
      },
      { value: "claude-3-5-sonnet-20241022", label: "Claude 3.5 Sonnet" },
      { value: "claude-3-5-haiku-20241022", label: "Claude 3.5 Haiku (Fast)" },
    ],
    openai: [
      { value: "gpt-4o", label: "GPT-4o (Recommended)" },
      { value: "gpt-4o-mini", label: "GPT-4o Mini (Fast)" },
      { value: "gpt-4-turbo", label: "GPT-4 Turbo" },
    ],
    ollama: [
      { value: "llama3.2", label: "Llama 3.2" },
      { value: "mistral", label: "Mistral" },
      { value: "codellama", label: "Code Llama" },
    ],
    lmstudio: [
      // LM Studio models are dynamically loaded from the running server
      // These are common defaults that will work if the model is loaded
      { value: "local-model", label: "Currently Loaded Model" },
    ],
  };

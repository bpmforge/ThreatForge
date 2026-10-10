/**
 * Settings type definitions for Organization and User preferences.
 */

/** Supported AI providers */
export type AIProvider =
  | "claude"
  | "openai"
  | "ollama"
  | "gemini"
  | "vertexai"
  | "lmstudio"
  | "none";

/** AI configuration at organization level */
export interface AISettings {
  /** Master toggle for AI features */
  enabled: boolean;

  /** Selected AI provider */
  provider: AIProvider;

  /** API key (stored encrypted when BYOK is enabled) */
  apiKey?: string;

  /** Encrypted API key data (internal use - set when encryption is applied) */
  encryptedApiKey?: string;

  /** Custom base URL for Ollama, LM Studio, or self-hosted */
  baseUrl?: string;

  /** Model identifier (e.g., 'claude-3-sonnet', 'gpt-4o', 'gemini-1.5-flash') */
  model?: string;

  /** Google Cloud Project ID (required for Vertex AI) */
  projectId?: string;

  /** Google Cloud region (for Vertex AI, default: us-central1) */
  region?: string;

  /** Feature toggles */
  features: {
    /** Auto-suggest threats when component selected */
    autoSuggestThreats: boolean;
    /** Auto-suggest mitigations when threat selected */
    autoSuggestMitigations: boolean;
    /** Enable AI chat panel */
    enableChat: boolean;
    /**
     * Org flag "agent-chain-v2": route AI analysis through the unified
     * 8-stage orchestrator. Default OFF. Optional
     * because settings blobs stored before this flag existed lack the key — treat
     * undefined as false (see services/ai/agent-chain-flag.ts).
     */
    agentChainV2?: boolean;
  };

  /** Security and cost controls */
  guardrails: {
    /** Monthly budget limit in USD (0 = unlimited) */
    monthlyBudget: number;
    /** Anonymize component names before sending to AI */
    anonymizeData: boolean;
    /** Log all AI interactions for audit */
    logInteractions: boolean;
  };
}

/** User-level AI preferences (overrides org defaults where allowed) */
interface UserAIPreferences {
  /** User's personal AI toggle (only if org allows) */
  enabled?: boolean;
  /** Preferred suggestion style */
  suggestionStyle: "brief" | "detailed";
  /** Show rationale for AI suggestions */
  showRationale: boolean;
  /** Auto-dismiss suggestions after accepting */
  autoDismiss: boolean;
}

/** Tutorial progress tracking */
interface TutorialProgress {
  /** Whether the STRIDE tutorial has been completed */
  strideTutorialCompleted: boolean;
  /** Score achieved (out of 6) */
  strideTutorialScore?: number;
  /** When the tutorial was completed */
  strideTutorialCompletedAt?: string;
  /** Other tutorials can be added here */
}

/** General user preferences */
export interface UserPreferences {
  /** Theme preference */
  theme: "light" | "dark" | "system";
  /** AI-specific preferences */
  ai: UserAIPreferences;
  /** Canvas preferences */
  canvas: {
    showGrid: boolean;
    snapToGrid: boolean;
    showMinimap: boolean;
  };
  /** Tutorial progress */
  tutorials?: TutorialProgress;
}

/** Default AI settings for new organizations */
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

/**
 * Parse a stored `organization.aiSettings` JSON blob into full `AISettings`,
 * merging over `DEFAULT_AI_SETTINGS` rather than replacing it wholesale.
 *
 * The column defaults to the literal string `"{}"` for every new
 * organization (`server/prisma/schema/02-organization.prisma`), so the
 * common `raw ? JSON.parse(raw) : DEFAULT_AI_SETTINGS` pattern never falls
 * back to defaults for an untouched org — it parses `"{}"` and returns an
 * empty object, dropping `enabled`, `provider`, `features`, `guardrails`
 * entirely. Merging (rather than an emptiness check) also covers a settings
 * blob saved before a field like `features.agentChainV2` existed.
 */
export function parseAISettings(raw: string | null | undefined): AISettings {
  let parsed: Partial<AISettings> = {};
  if (raw) {
    try {
      const candidate = JSON.parse(raw);
      if (candidate && typeof candidate === "object") parsed = candidate;
    } catch {
      // fall through to defaults
    }
  }
  // Always spread through DEFAULT_AI_SETTINGS rather than returning it
  // directly — callers (e.g. the settings routes) mutate the result
  // in place (`settings.apiKey = ...`, `delete settings.encryptedApiKey`),
  // and DEFAULT_AI_SETTINGS is a shared module-level const.
  return {
    ...DEFAULT_AI_SETTINGS,
    ...parsed,
    features: { ...DEFAULT_AI_SETTINGS.features, ...parsed.features },
    guardrails: { ...DEFAULT_AI_SETTINGS.guardrails, ...parsed.guardrails },
  };
}

/** Default tutorial progress */
const DEFAULT_TUTORIAL_PROGRESS: TutorialProgress = {
  strideTutorialCompleted: false,
};

/** Default user preferences */
export const DEFAULT_USER_PREFERENCES: UserPreferences = {
  theme: "system",
  ai: {
    suggestionStyle: "detailed",
    showRationale: true,
    autoDismiss: false,
  },
  canvas: {
    showGrid: true,
    snapToGrid: true,
    showMinimap: true,
  },
  tutorials: DEFAULT_TUTORIAL_PROGRESS,
};

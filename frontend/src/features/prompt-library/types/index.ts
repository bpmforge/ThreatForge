/**
 * Prompt Library Types
 */

export type PromptCategory =
  | "CLASSIFICATION"
  | "EXTRACTION"
  | "ANALYSIS"
  | "TRANSFORMATION"
  | "VALIDATION"
  | "VISION"
  | "THREAT_IDENTIFICATION"
  | "MITIGATION"
  | "CHAT";

export type PromptOutputFormat = "JSON" | "TEXT" | "MARKDOWN";

export type ExecutionStatus =
  | "PENDING"
  | "RUNNING"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED";

export interface PromptVariable {
  name: string;
  displayName?: string;
  type: "text" | "json" | "number" | "boolean";
  required?: boolean;
  defaultValue?: string;
  description?: string;
}

export interface PromptTemplate {
  id: string;
  name: string;
  description?: string;
  category: PromptCategory;
  userPromptTemplate: string;
  variables: string; // JSON string of PromptVariable[]
  outputFormat: PromptOutputFormat;
  outputSchema?: string;
  temperature: number;
  maxTokens: number;
  requiresVision: boolean;
  tags: string; // JSON string of string[]
  version: number;
  isBuiltIn: boolean;
  isActive: boolean;
  organizationId?: string;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PromptTemplateSummary {
  id: string;
  name: string;
  description?: string;
  category: PromptCategory;
  outputFormat: PromptOutputFormat;
  temperature: number;
  maxTokens: number;
  requiresVision: boolean;
  tags: string;
  version: number;
  isBuiltIn: boolean;
  isActive: boolean;
  organizationId?: string;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DetectionRule {
  type: "keyword" | "pattern" | "structure" | "extension";
  value: string;
  weight: number;
}

export interface DocumentTypeConfig {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  detectionRules: string; // JSON string of DetectionRule[]
  detectionThreshold: number;
  priority: number;
  promptTemplateId: string;
  promptTemplate?: {
    id: string;
    name: string;
    category: PromptCategory;
  };
  supportedFormats: string; // JSON string of string[]
  organizationId?: string;
  isBuiltIn: boolean;
  isActive: boolean;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PromptExecutionLog {
  id: string;
  promptTemplateId: string;
  promptTemplateName: string;
  documentTypeId?: string;
  documentTypeName?: string;
  userId: string;
  inputDocument?: string;
  inputVariables?: string;
  outputResult?: string;
  outputParsed?: string;
  status: ExecutionStatus;
  tokensUsed?: number;
  durationMs?: number;
  model?: string;
  provider?: string;
  errorMessage?: string;
  errorCode?: string;
  createdAt: string;
  completedAt?: string;
}

export interface PromptExecutionStats {
  totalExecutions: number;
  completedExecutions: number;
  failedExecutions: number;
  successRate: number;
  totalTokensUsed: number;
  avgDurationMs: number;
  avgTokensPerExecution: number;
}

export interface PromptUsageByPrompt {
  promptId: string;
  promptName: string;
  count: number;
}

export interface CreatePromptInput {
  name: string;
  description?: string;
  category: PromptCategory;
  systemPrompt?: string;
  userPromptTemplate: string;
  variables?: string;
  outputFormat?: PromptOutputFormat;
  outputSchema?: string;
  temperature?: number;
  maxTokens?: number;
  requiresVision?: boolean;
  tags?: string;
}

export type UpdatePromptInput = Partial<CreatePromptInput>;

export interface PreviewPromptResult {
  promptName: string;
  userPrompt: string;
  temperature: number;
  maxTokens: number;
  outputFormat: PromptOutputFormat;
}

// Helper functions
export function parseVariables(prompt: PromptTemplate): PromptVariable[] {
  try {
    return JSON.parse(prompt.variables || "[]");
  } catch {
    return [];
  }
}

export function parseTags(
  prompt: PromptTemplate | PromptTemplateSummary,
): string[] {
  try {
    return JSON.parse(prompt.tags || "[]");
  } catch {
    return [];
  }
}

export function parseDetectionRules(
  docType: DocumentTypeConfig,
): DetectionRule[] {
  try {
    return JSON.parse(docType.detectionRules || "[]");
  } catch {
    return [];
  }
}

export function parseSupportedFormats(docType: DocumentTypeConfig): string[] {
  try {
    return JSON.parse(docType.supportedFormats || "[]");
  } catch {
    return [];
  }
}

export const CATEGORY_LABELS: Record<PromptCategory, string> = {
  CLASSIFICATION: "Classification",
  EXTRACTION: "Extraction",
  ANALYSIS: "Analysis",
  TRANSFORMATION: "Transformation",
  VALIDATION: "Validation",
  VISION: "Vision",
  THREAT_IDENTIFICATION: "Threat Identification",
  MITIGATION: "Mitigation",
  CHAT: "Chat",
};

export interface PipelineStageExecution {
  id: string;
  stageId: string;
  order: number;
  status: ExecutionStatus;
  input?: Record<string, unknown>;
  output?: string;
  outputParsed?: unknown;
  durationMs?: number;
  tokensUsed?: number;
  retryAttempts: number;
  errorMessage?: string;
  startedAt?: string;
  completedAt?: string;
}

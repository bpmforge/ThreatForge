/**
 * Prompt Service - Loads and manages AI prompt templates from the database
 *
 * Features:
 * - Load prompts from database with organization scoping
 * - Cache prompts for performance
 * - Interpolate template variables
 * - Detect document types and select appropriate prompts
 * - Log prompt executions for analytics
 */
import { getPrisma } from "../../db.js";
import logger from "../../utils/logger.js";
import type {
  PromptTemplate,
  DocumentTypeConfig,
  ExecutionStatus,
} from "@prisma/client";

// Cache configuration
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

// In-memory cache
const promptCache = new Map<string, CacheEntry<PromptTemplate>>();
const documentTypeCache = new Map<string, CacheEntry<DocumentTypeConfig[]>>();

/**
 * Detection rule for document type matching
 */
interface DetectionRule {
  type: "keyword" | "pattern" | "structure" | "extension";
  value: string;
  weight: number;
}

/**
 * Prepared prompt ready for AI execution
 */
export interface PreparedPrompt {
  systemPrompt: string;
  userPrompt: string;
  temperature: number;
  maxTokens: number;
  requiresVision: boolean;
  promptId: string;
  promptName: string;
}

/**
 * Prompt execution context for logging
 */
export interface ExecutionContext {
  userId: string;
  organizationId?: string;
  documentTypeId?: string;
  documentTypeName?: string;
  inputDocument?: string;
  inputVariables?: Record<string, unknown>;
}

/**
 * Get a prompt template by ID
 */
export async function getPromptById(
  id: string,
): Promise<PromptTemplate | null> {
  // Check cache first
  const cached = promptCache.get(id);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  const prisma = await getPrisma();
  const prompt = await prisma.promptTemplate.findUnique({
    where: { id, isActive: true },
  });

  if (prompt) {
    promptCache.set(id, { data: prompt, timestamp: Date.now() });
  }

  return prompt;
}

/**
 * Get all document type configurations with organization scoping
 */
export async function getDocumentTypes(
  organizationId?: string,
): Promise<DocumentTypeConfig[]> {
  const cacheKey = organizationId || "__global__";
  const cached = documentTypeCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  const prisma = await getPrisma();

  const docTypes = await prisma.documentTypeConfig.findMany({
    where: {
      isActive: true,
      OR: [
        { organizationId: null }, // Built-in types
        ...(organizationId ? [{ organizationId }] : []),
      ],
    },
    include: {
      promptTemplate: true,
    },
    orderBy: [{ priority: "desc" }, { name: "asc" }],
  });

  documentTypeCache.set(cacheKey, { data: docTypes, timestamp: Date.now() });
  return docTypes;
}

/**
 * Detect document type based on content and return the matching prompt
 */
async function detectDocumentTypeAndPrompt(
  content: string,
  organizationId?: string,
): Promise<{
  documentType: DocumentTypeConfig;
  prompt: PromptTemplate;
} | null> {
  const documentTypes = await getDocumentTypes(organizationId);

  let bestMatch: { type: DocumentTypeConfig; score: number } | null = null;

  for (const docType of documentTypes) {
    const rules: DetectionRule[] = JSON.parse(docType.detectionRules || "[]");
    const score = calculateDetectionScore(content, rules);

    if (score >= docType.detectionThreshold) {
      if (!bestMatch || score > bestMatch.score) {
        bestMatch = { type: docType, score };
      }
    }
  }

  if (bestMatch) {
    const prompt = await getPromptById(bestMatch.type.promptTemplateId);
    if (prompt) {
      return { documentType: bestMatch.type, prompt };
    }
  }

  // Fall back to generic document type
  const genericType = documentTypes.find(
    (t) => t.id === "doctype-generic" || t.name === "Generic Document",
  );
  if (genericType) {
    const prompt = await getPromptById(genericType.promptTemplateId);
    if (prompt) {
      return { documentType: genericType, prompt };
    }
  }

  return null;
}

/**
 * Calculate detection score for a document against a set of rules
 */
function calculateDetectionScore(
  content: string,
  rules: DetectionRule[],
): number {
  if (rules.length === 0) return 0;

  const lowerContent = content.toLowerCase();
  let score = 0;

  for (const rule of rules) {
    switch (rule.type) {
      case "keyword":
        if (lowerContent.includes(rule.value.toLowerCase())) {
          score += rule.weight;
        }
        break;

      case "pattern":
        try {
          if (rule.value.length > 200) break; // Prevent ReDoS from overly complex patterns
          const regex = new RegExp(rule.value, "i");
          if (regex.test(content)) {
            score += rule.weight;
          }
        } catch {
          // Invalid regex, skip
        }
        break;

      case "structure":
        // Check for structural patterns (JSON keys, YAML sections, etc.)
        if (
          lowerContent.includes(`"${rule.value.toLowerCase()}"`) ||
          lowerContent.includes(`${rule.value.toLowerCase()}:`)
        ) {
          score += rule.weight;
        }
        break;

      case "extension":
        // Extension detection would be done at file upload level
        break;
    }
  }

  return score;
}

/**
 * Interpolate variables into a prompt template
 */
export function interpolatePrompt(
  template: string,
  variables: Record<string, unknown>,
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
    const value = variables[varName];
    if (value === undefined || value === null) {
      return match; // Leave placeholder if no value
    }
    if (typeof value === "object") {
      return JSON.stringify(value, null, 2);
    }
    const str = String(value);
    // Strip control chars and null bytes from user-supplied values
    // eslint-disable-next-line no-control-regex
    return str.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, " ").trim();
  });
}

/**
 * Prepare a prompt for execution with interpolated variables
 */
export async function preparePrompt(
  promptId: string,
  variables: Record<string, unknown>,
): Promise<PreparedPrompt | null> {
  const prompt = await getPromptById(promptId);
  if (!prompt) return null;

  const systemPrompt = interpolatePrompt(prompt.systemPrompt, variables);
  const userPrompt = interpolatePrompt(prompt.userPromptTemplate, variables);

  return {
    systemPrompt,
    userPrompt,
    temperature: prompt.temperature,
    maxTokens: prompt.maxTokens,
    requiresVision: prompt.requiresVision,
    promptId: prompt.id,
    promptName: prompt.name,
  };
}

/**
 * Prepare a prompt from document type detection
 */
export async function preparePromptFromDocument(
  documentContent: string,
  additionalVariables: Record<string, unknown> = {},
  organizationId?: string,
): Promise<{
  prepared: PreparedPrompt;
  documentType: DocumentTypeConfig;
} | null> {
  const detected = await detectDocumentTypeAndPrompt(
    documentContent,
    organizationId,
  );
  if (!detected) return null;

  const { documentType, prompt } = detected;

  const variables = {
    documentText: documentContent,
    ...additionalVariables,
  };

  const systemPrompt = interpolatePrompt(prompt.systemPrompt, variables);
  const userPrompt = interpolatePrompt(prompt.userPromptTemplate, variables);

  return {
    prepared: {
      systemPrompt,
      userPrompt,
      temperature: prompt.temperature,
      maxTokens: prompt.maxTokens,
      requiresVision: prompt.requiresVision,
      promptId: prompt.id,
      promptName: prompt.name,
    },
    documentType,
  };
}

/**
 * Log a prompt execution for analytics
 */
export async function logExecution(
  context: ExecutionContext & {
    promptId: string;
    promptName: string;
    status: ExecutionStatus;
    outputResult?: string;
    outputParsed?: string;
    tokensUsed?: number;
    durationMs?: number;
    model?: string;
    provider?: string;
    errorMessage?: string;
    errorCode?: string;
  },
): Promise<void> {
  try {
    const prisma = await getPrisma();

    await prisma.promptExecutionLog.create({
      data: {
        promptTemplateId: context.promptId,
        promptTemplateName: context.promptName,
        documentTypeId: context.documentTypeId,
        documentTypeName: context.documentTypeName,
        organizationId: context.organizationId,
        userId: context.userId,
        inputDocument: context.inputDocument
          ? context.inputDocument.slice(0, 5000)
          : undefined, // Truncate
        inputVariables: context.inputVariables
          ? JSON.stringify(context.inputVariables)
          : undefined,
        outputResult: context.outputResult?.slice(0, 10000), // Truncate
        outputParsed: context.outputParsed?.slice(0, 10000),
        status: context.status,
        tokensUsed: context.tokensUsed,
        durationMs: context.durationMs,
        model: context.model,
        provider: context.provider,
        errorMessage: context.errorMessage,
        errorCode: context.errorCode,
        completedAt:
          context.status === "COMPLETED" || context.status === "FAILED"
            ? new Date()
            : undefined,
      },
    });
  } catch (error) {
    // Don't fail the main operation if logging fails
    logger.error({ err: error }, "Failed to log prompt execution");
  }
}

/**
 * Get built-in prompt by well-known ID
 */
export async function getBuiltInPrompt(
  promptType:
    | "threat-analysis"
    | "mitigation-suggestions"
    | "architecture-extraction"
    | "srs-extraction"
    | "diagram-extraction"
    | "quick-scan"
    | "openapi-extraction"
    | "iac-extraction",
): Promise<PromptTemplate | null> {
  const idMap: Record<string, string> = {
    "threat-analysis": "builtin-threat-analysis",
    "mitigation-suggestions": "builtin-mitigation-suggestions",
    "architecture-extraction": "builtin-architecture-extraction",
    "srs-extraction": "builtin-srs-extraction",
    "diagram-extraction": "builtin-diagram-extraction",
    "quick-scan": "builtin-quick-scan",
    "openapi-extraction": "builtin-openapi-extraction",
    "iac-extraction": "builtin-iac-extraction",
  };

  return getPromptById(idMap[promptType]);
}

/**
 * Clear the prompt cache (useful for testing or after prompt updates)
 */
export function clearCache(): void {
  promptCache.clear();
  documentTypeCache.clear();
}

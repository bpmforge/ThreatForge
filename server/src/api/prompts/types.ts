/**
 * AI Prompts API - Type Definitions
 */
import type { PromptCategory, PromptOutputFormat } from "@prisma/client";

export interface PromptTemplateInput {
  name: string;
  description?: string;
  category: PromptCategory;
  systemPrompt: string;
  userPromptTemplate: string;
  variables?: string;
  outputFormat?: PromptOutputFormat;
  outputSchema?: string;
  temperature?: number;
  maxTokens?: number;
  requiresVision?: boolean;
  tags?: string;
}

export interface DocumentTypeInput {
  name: string;
  description?: string;
  icon?: string;
  detectionRules?: string;
  detectionThreshold?: number;
  priority?: number;
  promptTemplateId: string;
  supportedFormats?: string;
}

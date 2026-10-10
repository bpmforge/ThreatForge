/**
 * AI Providers API Types
 */
import type { AIProviderType, AIAuthType } from "@prisma/client";

export interface CreateProviderBody {
  name: string;
  type: AIProviderType;
  authType?: AIAuthType;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  isDefault?: boolean;
  priority?: number;
}

export interface UpdateProviderBody {
  name?: string;
  authType?: AIAuthType;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  isDefault?: boolean;
  isEnabled?: boolean;
  priority?: number;
}

export interface ReorderProvidersBody {
  providerIds: string[];
}

export interface TestResult {
  success: boolean;
  error?: string;
  latencyMs?: number;
}

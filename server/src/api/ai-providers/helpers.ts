/**
 * AI Providers Helpers
 *
 * Authentication, encryption, and connection testing utilities.
 */
import type { AIProviderType } from "@prisma/client";
import { getPrisma } from "../../db.js";
import {
  encryptValue,
  decryptValue,
  getKeyConfig,
} from "../../services/encryption/index.js";
import type { TestResult } from "./types.js";
import logger from "../../utils/logger.js";
import { checkTenantBaseUrl } from "../../services/ai/private-host-policy.js";

export { getAuthUser } from "../../utils/auth-helpers.js";

// ACTIVE memberships only (suspended members get nothing).
export {
  isActiveOrgAdmin as hasOrgAdminAccess,
  isActiveOrgMember as isOrgMember,
} from "../../services/access-control/access-control-service.js";

/** Encrypt an API key for storage */
export async function encryptApiKey(
  orgId: string,
  apiKey: string,
): Promise<string | null> {
  try {
    const keyConfig = await getKeyConfig(orgId);
    return encryptValue(apiKey, keyConfig ?? undefined);
  } catch (error) {
    logger.error({ err: error }, "Failed to encrypt API key:");
    return null;
  }
}

/** Decrypt a stored API key */
export async function decryptApiKey(
  orgId: string,
  encryptedKey: string,
): Promise<string | null> {
  try {
    const keyConfig = await getKeyConfig(orgId);
    return decryptValue(encryptedKey, keyConfig ?? undefined);
  } catch (error) {
    logger.error({ err: error }, "Failed to decrypt API key:");
    return null;
  }
}

/** Test connection to a provider */
export async function testProviderConnection(
  type: AIProviderType,
  apiKey: string | null,
  baseUrl: string | null,
  model: string | null,
): Promise<TestResult> {
  const startTime = Date.now();

  // A stored URL may predate the private-host allowlist; never call it unchecked.
  if (baseUrl) {
    const refused = await checkTenantBaseUrl(baseUrl);
    if (refused) return { success: false, error: refused };
  }

  try {
    switch (type) {
      case "ANTHROPIC":
        return await testAnthropic(apiKey, baseUrl, model, startTime);

      case "OPENAI":
      case "AZURE_OPENAI":
        return await testOpenAI(apiKey, baseUrl, model, startTime);

      case "GOOGLE":
        return await testGoogle(apiKey, baseUrl, model, startTime);

      case "OLLAMA":
        return await testOllama(baseUrl, startTime);

      case "LMSTUDIO":
        return await testLMStudio(baseUrl, startTime);

      case "OPENROUTER":
        return await testOpenRouter(apiKey, baseUrl, startTime);

      case "CUSTOM":
        return await testCustom(baseUrl, startTime);

      default:
        return { success: false, error: "Unknown provider type" };
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Connection failed";
    return { success: false, error: message };
  }
}

async function testAnthropic(
  apiKey: string | null,
  baseUrl: string | null,
  model: string | null,
  startTime: number,
): Promise<TestResult> {
  const url = baseUrl || "https://api.anthropic.com";
  const response = await fetch(`${url}/v1/messages`, {
    redirect: "manual",
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey || "",
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: model || "claude-3-haiku-20240307",
      max_tokens: 10,
      messages: [{ role: "user", content: "Hi" }],
    }),
    signal: AbortSignal.timeout(10000),
  });

  if (response.status === 401) {
    return { success: false, error: "Invalid API key" };
  }
  if (!response.ok && response.status !== 400) {
    const text = await response.text();
    return { success: false, error: `API error: ${response.status} - ${text}` };
  }
  return { success: true, latencyMs: Date.now() - startTime };
}

async function testOpenAI(
  apiKey: string | null,
  baseUrl: string | null,
  model: string | null,
  startTime: number,
): Promise<TestResult> {
  const url = baseUrl || "https://api.openai.com/v1";
  const response = await fetch(`${url}/chat/completions`, {
    redirect: "manual",
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey || ""}`,
    },
    body: JSON.stringify({
      model: model || "gpt-3.5-turbo",
      max_tokens: 10,
      messages: [{ role: "user", content: "Hi" }],
    }),
    signal: AbortSignal.timeout(10000),
  });

  if (response.status === 401) {
    return { success: false, error: "Invalid API key" };
  }
  if (!response.ok && response.status !== 400) {
    const text = await response.text();
    return { success: false, error: `API error: ${response.status} - ${text}` };
  }
  return { success: true, latencyMs: Date.now() - startTime };
}

async function testGoogle(
  apiKey: string | null,
  baseUrl: string | null,
  model: string | null,
  startTime: number,
): Promise<TestResult> {
  const url = baseUrl || "https://generativelanguage.googleapis.com/v1beta";
  const modelId = model || "gemini-pro";
  const response = await fetch(
    `${url}/models/${modelId}:generateContent?key=${apiKey || ""}`,
    {
      redirect: "manual",
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: "Hi" }] }],
      }),
      signal: AbortSignal.timeout(10000),
    },
  );

  if (response.status === 400 || response.status === 401) {
    return { success: false, error: "Invalid API key" };
  }
  if (!response.ok) {
    const text = await response.text();
    return { success: false, error: `API error: ${response.status} - ${text}` };
  }
  return { success: true, latencyMs: Date.now() - startTime };
}

async function testOllama(
  baseUrl: string | null,
  startTime: number,
): Promise<TestResult> {
  const url = baseUrl || "http://localhost:11434";
  const response = await fetch(`${url}/api/tags`, {
    redirect: "manual",
    signal: AbortSignal.timeout(5000),
  });

  if (!response.ok) {
    return { success: false, error: "Ollama not reachable" };
  }
  return { success: true, latencyMs: Date.now() - startTime };
}

async function testLMStudio(
  baseUrl: string | null,
  startTime: number,
): Promise<TestResult> {
  const url = baseUrl || "http://localhost:1234/v1";
  const response = await fetch(`${url}/models`, {
    redirect: "manual",
    signal: AbortSignal.timeout(5000),
  });

  if (!response.ok) {
    return { success: false, error: "LM Studio not reachable" };
  }
  return { success: true, latencyMs: Date.now() - startTime };
}

async function testOpenRouter(
  apiKey: string | null,
  baseUrl: string | null,
  startTime: number,
): Promise<TestResult> {
  const url = baseUrl || "https://openrouter.ai/api/v1";
  const response = await fetch(`${url}/models`, {
    redirect: "manual",
    headers: { Authorization: `Bearer ${apiKey || ""}` },
    signal: AbortSignal.timeout(10000),
  });

  if (response.status === 401) {
    return { success: false, error: "Invalid API key" };
  }
  if (!response.ok) {
    return { success: false, error: "OpenRouter not reachable" };
  }
  return { success: true, latencyMs: Date.now() - startTime };
}

async function testCustom(
  baseUrl: string | null,
  startTime: number,
): Promise<TestResult> {
  if (!baseUrl) {
    return { success: false, error: "Base URL required for custom provider" };
  }
  const response = await fetch(baseUrl, {
    redirect: "manual",
    signal: AbortSignal.timeout(5000),
  });
  return { success: response.ok, latencyMs: Date.now() - startTime };
}

/**
 * Sync the default AIProvider to the legacy organization.aiSettings field.
 * This bridges the multi-provider UI with the AIService that reads aiSettings.
 */
export async function syncDefaultProviderToLegacy(
  orgId: string,
): Promise<void> {
  const prisma = await getPrisma();

  const defaultProvider = await prisma.aIProvider.findFirst({
    where: { organizationId: orgId, isDefault: true, isEnabled: true },
  });

  if (!defaultProvider) {
    // No default provider — disable AI
    await prisma.organization.update({
      where: { id: orgId },
      data: {
        aiSettings: JSON.stringify({ enabled: false, provider: "none" }),
      },
    });
    return;
  }

  // Map AIProviderType to legacy provider string
  const providerMap: Record<string, string> = {
    ANTHROPIC: "claude",
    OPENAI: "openai",
    GOOGLE: "gemini",
    AZURE_OPENAI: "openai",
    OLLAMA: "ollama",
    LMSTUDIO: "lmstudio",
    OPENROUTER: "openai",
    CUSTOM: "lmstudio",
  };

  // Decrypt API key if present
  let apiKey: string | undefined;
  if (defaultProvider.encryptedApiKey) {
    const keyConfig = await getKeyConfig(orgId);
    apiKey =
      decryptValue(defaultProvider.encryptedApiKey, keyConfig ?? undefined) ??
      undefined;
  }

  const legacySettings = {
    enabled: true,
    provider: providerMap[defaultProvider.type] || "lmstudio",
    apiKey,
    baseUrl: defaultProvider.baseUrl || undefined,
    model: defaultProvider.model || undefined,
    maxTokens: 45000,
    temperature: 0.3,
    features: {
      autoSuggestThreats: true,
      autoSuggestMitigations: true,
      severityCalculation: true,
      enableChat: true,
    },
  };

  // Remove apiKey from stored settings if we have encrypted version
  const toStore = { ...legacySettings };
  if (defaultProvider.encryptedApiKey) {
    toStore.apiKey = undefined;
    (toStore as Record<string, unknown>).encryptedApiKey =
      defaultProvider.encryptedApiKey;
  }

  await prisma.organization.update({
    where: { id: orgId },
    data: { aiSettings: JSON.stringify(toStore) },
  });
}

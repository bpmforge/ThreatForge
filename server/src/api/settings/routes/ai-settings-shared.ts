/**
 * Shared logic for the org-level and threat-model-level AI settings routes.
 */
import { getPrisma } from "../../../db.js";
import { AISettings, parseAISettings } from "../../../types/settings.js";
import logger from "../../../utils/logger.js";
import {
  canAccessOrganization,
  isModelOrgMember,
  encryptApiKey,
  decryptApiKey,
} from "../helpers.js";

const maskApiKey = (key: string) => key.slice(0, 8) + "••••••••";

/** Org AI settings for a member, or null when not found / not accessible. */
export async function loadOrgAISettings(
  userId: string,
  orgId: string,
): Promise<AISettings | null> {
  if (!(await canAccessOrganization(userId, orgId))) return null;
  const prisma = await getPrisma();
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { aiSettings: true },
  });
  return org ? parseAISettings(org.aiSettings) : null;
}

/** Organization (id + raw aiSettings) behind a threat model, or null. */
export async function loadModelOrganization(userId: string, modelId: string) {
  if (!(await isModelOrgMember(userId, modelId))) return null;
  const prisma = await getPrisma();
  const model = await prisma.threatModel.findUnique({
    where: { id: modelId },
    include: {
      project: {
        include: {
          organization: { select: { id: true, aiSettings: true } },
        },
      },
    },
  });
  return model?.project?.organization ?? null;
}

/** Mask the stored API key for a GET response; never expose the encrypted key. */
export async function maskStoredAISettings(
  orgId: string,
  settings: AISettings,
): Promise<AISettings> {
  // If we have an encrypted key, decrypt it to get the prefix for masking
  if (settings.encryptedApiKey && !settings.apiKey) {
    const decrypted = await decryptApiKey(orgId, settings.encryptedApiKey);
    if (decrypted) {
      settings.apiKey = maskApiKey(decrypted);
    }
  } else if (settings.apiKey) {
    settings.apiKey = maskApiKey(settings.apiKey);
  }

  delete settings.encryptedApiKey;
  return settings;
}

/**
 * Merge `updates` into `currentSettings`, persist them (encrypted key only),
 * and return the masked settings for the PATCH response.
 */
export async function saveAISettings(
  orgId: string,
  currentSettings: AISettings,
  updates: Partial<AISettings>,
  encryptedApiKey: string | undefined,
): Promise<AISettings> {
  const prisma = await getPrisma();
  const newSettings: AISettings = {
    ...currentSettings,
    ...updates,
    encryptedApiKey,
    features: {
      ...currentSettings.features,
      ...(updates.features || {}),
    },
    guardrails: {
      ...currentSettings.guardrails,
      ...(updates.guardrails || {}),
    },
  };

  // Remove plaintext API key from stored settings (keep only encrypted)
  const settingsToStore = { ...newSettings };
  if (settingsToStore.encryptedApiKey) {
    delete settingsToStore.apiKey;
  }

  await prisma.organization.update({
    where: { id: orgId },
    data: { aiSettings: JSON.stringify(settingsToStore) },
  });

  // Return masked version, never the encrypted key
  const response = { ...newSettings };
  if (response.encryptedApiKey) {
    const decrypted = await decryptApiKey(orgId, response.encryptedApiKey);
    if (decrypted) {
      response.apiKey = maskApiKey(decrypted);
    }
    delete response.encryptedApiKey;
  } else if (response.apiKey) {
    response.apiKey = maskApiKey(response.apiKey);
  }
  return response;
}

/**
 * Encrypt `keyToEncrypt` (if present and not a masked echo). Returns the
 * encrypted key to store, deleting the plaintext from `updates` on success.
 */
export async function encryptKeyForUpdate(
  orgId: string,
  updates: Partial<AISettings>,
  currentEncrypted: string | undefined,
  keyToEncrypt: string | undefined,
): Promise<string | undefined> {
  let encryptedApiKey = currentEncrypted;
  if (keyToEncrypt && !keyToEncrypt.includes("••••")) {
    const encrypted = await encryptApiKey(orgId, keyToEncrypt);
    if (encrypted) {
      encryptedApiKey = encrypted;
      delete updates.apiKey;
    } else {
      logger.warn(
        `Failed to encrypt API key for org ${orgId}, storing as plaintext`,
      );
    }
  }
  return encryptedApiKey;
}

/** Whether AI has a provider and a usable key (encrypted or plaintext). */
export function isAIConfigured(settings: AISettings): boolean {
  const hasEncryptedKey = Boolean(settings.encryptedApiKey);
  const hasPlaintextKey = Boolean(
    settings.apiKey && settings.apiKey.length > 10,
  );
  return settings.provider !== "none" && (hasEncryptedKey || hasPlaintextKey);
}

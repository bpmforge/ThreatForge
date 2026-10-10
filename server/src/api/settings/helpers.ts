/**
 * Settings API - Shared Helpers
 *
 * Access checks and encryption utilities for settings routes.
 */
import { getPrisma } from "../../db.js";
import logger from "../../utils/logger.js";
import {
  encryptValue,
  decryptValue,
  getKeyConfig,
} from "../../services/encryption/index.js";
import { requireOrgRole } from "../../services/access-control/access-control-service.js";
import { checkTenantBaseUrl } from "../../services/ai/private-host-policy.js";
import type { AISettings } from "../../types/settings.js";
import { checkThreatModelAccess } from "../../services/access-control/access-control-service.js";

/** Check if user is an active member of organization */
export async function canAccessOrganization(
  userId: string,
  orgId: string,
): Promise<boolean> {
  const prisma = await getPrisma();

  const membership = await prisma.membership.findFirst({
    where: { userId, organizationId: orgId, status: "ACTIVE" },
  });

  return membership !== null;
}

/**
 * Changing AI settings decides where the org's decrypted provider key and
 * model contents are sent, so it needs an active OWNER/ADMIN.
 */
export async function canManageOrganizationAI(
  userId: string,
  orgId: string,
): Promise<boolean> {
  return (await requireOrgRole(userId, orgId, "ADMIN")).allowed;
}

/**
 * Validate an AI settings update and bind the stored key to its URL.
 * A private-network base URL needs the super-admin AI private-host allowlist.
 * The Vertex AI provider needs a super admin (`userId`).
 * Returns an error message, or null when the update may be applied.
 * Mutates `current`: when the base URL or provider changes without a new key,
 * the stored key is cleared so it is never sent to a host it was not saved for.
 */
export async function guardAISettingsUpdate(
  current: AISettings,
  updates: Partial<AISettings>,
  userId: string,
): Promise<string | null> {
  // Vertex AI runs on the platform's own Google credentials, not the org's,
  // so only a super admin may point an org at it.
  const touchesVertex =
    updates.provider === "vertexai" ||
    (current.provider === "vertexai" &&
      (updates.projectId !== undefined || updates.region !== undefined));
  if (touchesVertex) {
    const prisma = await getPrisma();
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { isSuperAdmin: true },
    });
    if (!user?.isSuperAdmin) {
      return "Only a super admin can use the Vertex AI provider";
    }
  }
  if (updates.baseUrl) {
    const error = await checkTenantBaseUrl(updates.baseUrl);
    if (error) return error;
  }
  const endpointChanged =
    (updates.baseUrl !== undefined && updates.baseUrl !== current.baseUrl) ||
    (updates.provider !== undefined && updates.provider !== current.provider);
  const newKey = updates.apiKey && !updates.apiKey.includes("••••");
  if (endpointChanged && !newKey) {
    delete current.encryptedApiKey;
    delete current.apiKey;
  }
  return null;
}

/**
 * Encrypt an API key for storage.
 * Uses BYOK key if configured, otherwise system key.
 */
export async function encryptApiKey(
  orgId: string,
  apiKey: string,
  customerKey?: string,
): Promise<string | null> {
  try {
    const keyConfig = await getKeyConfig(orgId, customerKey);
    return encryptValue(apiKey, keyConfig ?? undefined);
  } catch (error) {
    logger.error({ err: error }, "Failed to encrypt API key:");
    return null;
  }
}

/**
 * Decrypt a stored API key.
 * Uses BYOK key if configured, otherwise system key.
 */
export async function decryptApiKey(
  orgId: string,
  encryptedKey: string,
  customerKey?: string,
): Promise<string | null> {
  try {
    const keyConfig = await getKeyConfig(orgId, customerKey);
    return decryptValue(encryptedKey, keyConfig ?? undefined);
  } catch (error) {
    logger.error({ err: error }, "Failed to decrypt API key:");
    return null;
  }
}

/**
 * True when the user is an ACTIVE member of the model's organization (and the
 * organization is not deleted). Guests with a share link are not members: AI
 * settings belong to the organization.
 */
export async function isModelOrgMember(
  userId: string,
  threatModelId: string,
): Promise<boolean> {
  const access = await checkThreatModelAccess(userId, threatModelId);
  return access.hasAccess && !access.isGuest;
}

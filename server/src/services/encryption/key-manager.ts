/**
 * BYOK Key Manager
 *
 * Manages encryption keys for organizations, including:
 * - Key generation and storage (metadata only, not actual keys)
 * - Key rotation
 * - BYOK key registration
 * - Key verification
 */
import { getPrisma } from "../../db.js";
import type {
  EncryptionAlgorithm,
  EncryptionKeyConfig,
  EncryptionKeyMetadata,
  BYOKConfig,
} from "../../types/encryption.js";
import {
  generateEncryptionKey,
  hashKey,
  verifyKeyHash,
  deriveKeyFromPassphrase,
} from "./encryption-service.js";

/** Default BYOK configuration */
const DEFAULT_BYOK_CONFIG: BYOKConfig = {
  enabled: false,
  activeKeyVersion: 0,
  keys: [],
  allowSystemKeyFallback: true,
};

/**
 * Get BYOK configuration for an organization.
 */
export async function getBYOKConfig(
  organizationId: string,
): Promise<BYOKConfig> {
  const prisma = await getPrisma();

  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { settings: true },
  });

  if (!org?.settings) {
    return DEFAULT_BYOK_CONFIG;
  }

  try {
    const settings = JSON.parse(org.settings);
    return settings.byok || DEFAULT_BYOK_CONFIG;
  } catch {
    return DEFAULT_BYOK_CONFIG;
  }
}

/**
 * Update BYOK configuration for an organization.
 */
async function updateBYOKConfig(
  organizationId: string,
  config: Partial<BYOKConfig>,
): Promise<BYOKConfig> {
  const prisma = await getPrisma();

  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { settings: true },
  });

  const currentSettings = org?.settings ? JSON.parse(org.settings) : {};
  const currentBYOK = currentSettings.byok || DEFAULT_BYOK_CONFIG;

  const newBYOK: BYOKConfig = {
    ...currentBYOK,
    ...config,
  };

  const newSettings = {
    ...currentSettings,
    byok: newBYOK,
  };

  await prisma.organization.update({
    where: { id: organizationId },
    data: { settings: JSON.stringify(newSettings) },
  });

  return newBYOK;
}

/**
 * Register a new BYOK key for an organization.
 * The actual key is NOT stored - only metadata and a verification hash.
 *
 * @param organizationId - Organization ID
 * @param keyBase64 - The customer-provided key in base64 format
 * @param description - Optional description for the key
 * @param algorithm - Encryption algorithm (default: aes-256-gcm)
 * @returns Key metadata (without the actual key)
 */
export async function registerBYOKKey(
  organizationId: string,
  keyBase64: string,
  description?: string,
  algorithm: EncryptionAlgorithm = "aes-256-gcm",
): Promise<{
  metadata: EncryptionKeyMetadata;
  success: boolean;
  error?: string;
}> {
  try {
    const keyBuffer = Buffer.from(keyBase64, "base64");

    // Validate key length (256 bits = 32 bytes)
    if (keyBuffer.length !== 32) {
      return {
        metadata: {} as EncryptionKeyMetadata,
        success: false,
        error: "Key must be exactly 256 bits (32 bytes) in length",
      };
    }

    const config = await getBYOKConfig(organizationId);
    const nextVersion = Math.max(0, ...config.keys.map((k) => k.version)) + 1;

    const metadata: EncryptionKeyMetadata = {
      id: `key_${organizationId}_v${nextVersion}`,
      organizationId,
      version: nextVersion,
      algorithm,
      keyHash: hashKey(keyBuffer),
      isActive: true,
      createdAt: new Date(),
      description,
    };

    // Deactivate previous keys
    const updatedKeys = config.keys.map((k) => ({ ...k, isActive: false }));
    updatedKeys.push(metadata);

    await updateBYOKConfig(organizationId, {
      enabled: true,
      activeKeyVersion: nextVersion,
      keys: updatedKeys,
    });

    return { metadata, success: true };
  } catch (error) {
    return {
      metadata: {} as EncryptionKeyMetadata,
      success: false,
      error: error instanceof Error ? error.message : "Failed to register key",
    };
  }
}

/**
 * Register a BYOK key derived from a passphrase.
 * The passphrase is used to derive a key using scrypt.
 */
export async function registerBYOKFromPassphrase(
  organizationId: string,
  passphrase: string,
  description?: string,
): Promise<{
  metadata: EncryptionKeyMetadata;
  salt: string;
  success: boolean;
  error?: string;
}> {
  try {
    if (passphrase.length < 16) {
      return {
        metadata: {} as EncryptionKeyMetadata,
        salt: "",
        success: false,
        error: "Passphrase must be at least 16 characters",
      };
    }

    const { key, salt } = deriveKeyFromPassphrase(passphrase);
    const result = await registerBYOKKey(
      organizationId,
      key.toString("base64"),
      description || "Derived from passphrase",
    );

    return {
      ...result,
      salt: salt.toString("base64"),
    };
  } catch (error) {
    return {
      metadata: {} as EncryptionKeyMetadata,
      salt: "",
      success: false,
      error: error instanceof Error ? error.message : "Failed to register key",
    };
  }
}

/**
 * Verify a customer-provided key matches the registered key hash.
 */
export async function verifyBYOKKey(
  organizationId: string,
  keyBase64: string,
  keyVersion?: number,
): Promise<boolean> {
  const config = await getBYOKConfig(organizationId);

  const targetVersion = keyVersion ?? config.activeKeyVersion;
  const keyMetadata = config.keys.find((k) => k.version === targetVersion);

  if (!keyMetadata) {
    return false;
  }

  const keyBuffer = Buffer.from(keyBase64, "base64");
  return verifyKeyHash(keyBuffer, keyMetadata.keyHash);
}

/**
 * Get the key configuration for an organization.
 * Note: This returns a config object but the actual key must be provided
 * by the customer at runtime (not stored in the system).
 */
export async function getKeyConfig(
  organizationId: string,
  customerKey?: string,
): Promise<EncryptionKeyConfig | null> {
  const config = await getBYOKConfig(organizationId);

  if (!config.enabled || config.activeKeyVersion === 0) {
    // Use system key
    return null;
  }

  if (!customerKey) {
    if (config.allowSystemKeyFallback) {
      return null; // Fall back to system key
    }
    throw new Error("BYOK is enabled but no customer key provided");
  }

  const keyMetadata = config.keys.find(
    (k) => k.version === config.activeKeyVersion && k.isActive,
  );

  if (!keyMetadata) {
    throw new Error("No active encryption key found");
  }

  // Verify the provided key
  const isValid = await verifyBYOKKey(
    organizationId,
    customerKey,
    config.activeKeyVersion,
  );
  if (!isValid) {
    throw new Error("Provided key does not match registered key");
  }

  return {
    key: customerKey,
    algorithm: keyMetadata.algorithm,
    version: keyMetadata.version,
  };
}

/**
 * Rotate to a new key version.
 * This registers a new key and marks it as active.
 */
export async function rotateKey(
  organizationId: string,
  newKeyBase64: string,
  description?: string,
): Promise<{ success: boolean; newVersion: number; error?: string }> {
  const result = await registerBYOKKey(
    organizationId,
    newKeyBase64,
    description || `Key rotation on ${new Date().toISOString()}`,
  );

  if (!result.success) {
    return { success: false, newVersion: 0, error: result.error };
  }

  return {
    success: true,
    newVersion: result.metadata.version,
  };
}

/**
 * Generate a new random key for an organization.
 * Returns the key (to be saved by customer) and registers the metadata.
 *
 * IMPORTANT: The returned key should be displayed to the customer once
 * and never stored by the system.
 */
export async function generateAndRegisterKey(
  organizationId: string,
  description?: string,
): Promise<{
  success: boolean;
  key?: string;
  metadata?: EncryptionKeyMetadata;
  error?: string;
}> {
  const { keyBase64 } = generateEncryptionKey();

  const result = await registerBYOKKey(
    organizationId,
    keyBase64,
    description || "System-generated key",
  );

  if (!result.success) {
    return { success: false, error: result.error };
  }

  return {
    success: true,
    key: keyBase64,
    metadata: result.metadata,
  };
}

/**
 * Disable BYOK for an organization (revert to system key).
 */
export async function disableBYOK(organizationId: string): Promise<void> {
  await updateBYOKConfig(organizationId, {
    enabled: false,
    activeKeyVersion: 0,
  });
}

/**
 * Get all key metadata for an organization (for admin UI).
 */
export async function listKeys(
  organizationId: string,
): Promise<EncryptionKeyMetadata[]> {
  const config = await getBYOKConfig(organizationId);
  return config.keys;
}

/**
 * Revoke a specific key version.
 */
export async function revokeKey(
  organizationId: string,
  keyVersion: number,
): Promise<boolean> {
  const config = await getBYOKConfig(organizationId);

  const keyIndex = config.keys.findIndex((k) => k.version === keyVersion);
  if (keyIndex === -1) {
    return false;
  }

  const updatedKeys = [...config.keys];
  updatedKeys[keyIndex] = { ...updatedKeys[keyIndex], isActive: false };

  // If revoking the active key, disable BYOK
  const updates: Partial<BYOKConfig> = { keys: updatedKeys };
  if (config.activeKeyVersion === keyVersion) {
    updates.enabled = false;
    updates.activeKeyVersion = 0;
  }

  await updateBYOKConfig(organizationId, updates);
  return true;
}

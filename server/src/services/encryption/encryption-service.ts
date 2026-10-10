/**
 * BYOK Encryption Service
 *
 * Provides field-level encryption for sensitive data using customer-provided keys
 * or system-managed keys. Supports AES-256-GCM for authenticated encryption.
 */
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  createHash,
  scryptSync,
  timingSafeEqual,
} from "crypto";
import type {
  EncryptionAlgorithm,
  EncryptedData,
  EncryptionResult,
  DecryptionResult,
  EncryptionKeyConfig,
} from "../../types/encryption.js";
import logger from "../../utils/logger.js";

/** Default algorithm - AES-256-GCM provides authenticated encryption */
const DEFAULT_ALGORITHM: EncryptionAlgorithm = "aes-256-gcm";

/** IV length for AES-GCM (96 bits recommended by NIST) */
const GCM_IV_LENGTH = 12;

/** IV length for AES-CBC (128 bits) */
const CBC_IV_LENGTH = 16;

/** Auth tag length for GCM mode (128 bits) - used internally by createCipheriv/createDecipheriv */

/** Salt length for key derivation */
const SALT_LENGTH = 32;

/** Cached dev key — generated once per process so encrypt/decrypt within a session are consistent */
let _devKey: Buffer | null = null;

/**
 * Get the system encryption key from environment.
 * This is used when BYOK is not enabled or as a fallback.
 */
function getSystemKey(): Buffer {
  const envKey = process.env.ENCRYPTION_KEY;

  if (!envKey) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "ENCRYPTION_KEY environment variable is required in production",
      );
    }
    if (!_devKey) {
      _devKey = randomBytes(32);
      logger.warn(
        "ENCRYPTION_KEY not set — using random per-process key (dev only). Data encrypted this session will not be readable after restart.",
      );
    }
    return _devKey;
  }

  // Key should be base64 encoded 256-bit key
  const keyBuffer = Buffer.from(envKey, "base64");
  if (keyBuffer.length !== 32) {
    throw new Error(
      "ENCRYPTION_KEY must be a 256-bit (32 byte) key encoded in base64",
    );
  }

  return keyBuffer;
}

/**
 * Derive an encryption key from a password/passphrase using scrypt.
 * Used for BYOK where customer provides a passphrase.
 */
export function deriveKeyFromPassphrase(
  passphrase: string,
  salt?: Buffer,
): { key: Buffer; salt: Buffer } {
  const derivedSalt = salt || randomBytes(SALT_LENGTH);
  const key = scryptSync(passphrase, derivedSalt, 32, {
    N: 16384, // CPU/memory cost parameter
    r: 8, // Block size
    p: 1, // Parallelization parameter
  });

  return { key, salt: derivedSalt };
}

/**
 * Hash a key for storage/verification (not the actual key).
 */
export function hashKey(key: Buffer): string {
  return createHash("sha256").update(key).digest("hex");
}

/**
 * Verify a key matches a stored hash using timing-safe comparison.
 */
export function verifyKeyHash(key: Buffer, storedHash: string): boolean {
  const computedHash = Buffer.from(hashKey(key), "hex");
  const expectedHash = Buffer.from(storedHash, "hex");

  if (computedHash.length !== expectedHash.length) {
    return false;
  }

  return timingSafeEqual(computedHash, expectedHash);
}

/**
 * Generate a new random encryption key.
 */
export function generateEncryptionKey(): { key: Buffer; keyBase64: string } {
  const key = randomBytes(32);
  return {
    key,
    keyBase64: key.toString("base64"),
  };
}

/**
 * Encrypt plaintext using AES-256-GCM.
 */
export function encryptAesGcm(
  plaintext: string,
  key: Buffer,
  keyVersion: number = 1,
): EncryptionResult {
  try {
    const iv = randomBytes(GCM_IV_LENGTH);
    const cipher = createCipheriv("aes-256-gcm", key, iv);

    const encrypted = Buffer.concat([
      cipher.update(plaintext, "utf8"),
      cipher.final(),
    ]);

    const authTag = cipher.getAuthTag();

    const result: EncryptedData = {
      ciphertext: encrypted.toString("base64"),
      iv: iv.toString("base64"),
      authTag: authTag.toString("base64"),
      algorithm: "aes-256-gcm",
      keyVersion,
    };

    return { success: true, data: result };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Encryption failed",
    };
  }
}

/**
 * Decrypt ciphertext using AES-256-GCM.
 */
export function decryptAesGcm(
  encryptedData: EncryptedData,
  key: Buffer,
): DecryptionResult {
  try {
    if (!encryptedData.authTag) {
      return {
        success: false,
        error: "Missing authentication tag for GCM mode",
      };
    }

    const iv = Buffer.from(encryptedData.iv, "base64");
    const ciphertext = Buffer.from(encryptedData.ciphertext, "base64");
    const authTag = Buffer.from(encryptedData.authTag, "base64");

    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);

    return { success: true, plaintext: decrypted.toString("utf8") };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Decryption failed",
    };
  }
}

/**
 * Encrypt plaintext using AES-256-CBC (legacy support).
 */
export function encryptAesCbc(
  plaintext: string,
  key: Buffer,
  keyVersion: number = 1,
): EncryptionResult {
  try {
    const iv = randomBytes(CBC_IV_LENGTH);
    const cipher = createCipheriv("aes-256-cbc", key, iv);

    const encrypted = Buffer.concat([
      cipher.update(plaintext, "utf8"),
      cipher.final(),
    ]);

    const result: EncryptedData = {
      ciphertext: encrypted.toString("base64"),
      iv: iv.toString("base64"),
      algorithm: "aes-256-cbc",
      keyVersion,
    };

    return { success: true, data: result };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Encryption failed",
    };
  }
}

/**
 * Decrypt ciphertext using AES-256-CBC (legacy support).
 */
export function decryptAesCbc(
  encryptedData: EncryptedData,
  key: Buffer,
): DecryptionResult {
  try {
    const iv = Buffer.from(encryptedData.iv, "base64");
    const ciphertext = Buffer.from(encryptedData.ciphertext, "base64");

    const decipher = createDecipheriv("aes-256-cbc", key, iv);

    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);

    return { success: true, plaintext: decrypted.toString("utf8") };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Decryption failed",
    };
  }
}

/**
 * High-level encryption function that selects the appropriate algorithm.
 */
export function encrypt(
  plaintext: string,
  keyConfig?: EncryptionKeyConfig,
): EncryptionResult {
  const algorithm = keyConfig?.algorithm || DEFAULT_ALGORITHM;
  const keyVersion = keyConfig?.version || 1;

  let key: Buffer;
  if (keyConfig?.key) {
    key = Buffer.from(keyConfig.key, "base64");
  } else {
    key = getSystemKey();
  }

  switch (algorithm) {
    case "aes-256-gcm":
      return encryptAesGcm(plaintext, key, keyVersion);
    case "aes-256-cbc":
      return encryptAesCbc(plaintext, key, keyVersion);
    default:
      return { success: false, error: `Unsupported algorithm: ${algorithm}` };
  }
}

/**
 * High-level decryption function that selects the appropriate algorithm.
 */
export function decrypt(
  encryptedData: EncryptedData,
  keyConfig?: EncryptionKeyConfig,
): DecryptionResult {
  let key: Buffer;
  if (keyConfig?.key) {
    key = Buffer.from(keyConfig.key, "base64");
  } else {
    key = getSystemKey();
  }

  switch (encryptedData.algorithm) {
    case "aes-256-gcm":
      return decryptAesGcm(encryptedData, key);
    case "aes-256-cbc":
      return decryptAesCbc(encryptedData, key);
    default:
      return {
        success: false,
        error: `Unsupported algorithm: ${encryptedData.algorithm}`,
      };
  }
}

/**
 * Encrypt a sensitive string value for storage.
 * Returns a JSON string that can be stored in the database.
 */
export function encryptValue(
  value: string,
  keyConfig?: EncryptionKeyConfig,
): string | null {
  const result = encrypt(value, keyConfig);
  if (!result.success || !result.data) {
    logger.error({ err: result.error }, "Encryption failed");
    return null;
  }
  return JSON.stringify(result.data);
}

/**
 * Decrypt a stored encrypted value.
 * Expects a JSON string from encryptValue().
 */
export function decryptValue(
  encryptedJson: string,
  keyConfig?: EncryptionKeyConfig,
): string | null {
  try {
    const encryptedData: EncryptedData = JSON.parse(encryptedJson);
    const result = decrypt(encryptedData, keyConfig);
    if (!result.success || !result.plaintext) {
      logger.error({ err: result.error }, "Decryption failed");
      return null;
    }
    return result.plaintext;
  } catch (error) {
    logger.error({ err: error }, "Failed to parse encrypted data");
    return null;
  }
}

/**
 * Check if a value appears to be encrypted (JSON with expected structure).
 */
export function isEncrypted(value: string): boolean {
  try {
    const parsed = JSON.parse(value);
    return (
      typeof parsed === "object" &&
      parsed !== null &&
      "ciphertext" in parsed &&
      "iv" in parsed &&
      "algorithm" in parsed
    );
  } catch {
    return false;
  }
}

/**
 * Re-encrypt a value with a new key (for key rotation).
 */
export function reEncrypt(
  encryptedJson: string,
  oldKeyConfig: EncryptionKeyConfig,
  newKeyConfig: EncryptionKeyConfig,
): string | null {
  const plaintext = decryptValue(encryptedJson, oldKeyConfig);
  if (!plaintext) {
    return null;
  }
  return encryptValue(plaintext, newKeyConfig);
}

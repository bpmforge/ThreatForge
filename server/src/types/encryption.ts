/**
 * BYOK (Bring Your Own Key) Encryption Types
 */

export type EncryptionAlgorithm = "aes-256-gcm" | "aes-256-cbc";

export interface EncryptionKeyConfig {
  /** Organization-specific encryption key (base64 encoded) */
  key: string;
  /** Algorithm to use */
  algorithm: EncryptionAlgorithm;
  /** Key version for rotation support */
  version: number;
}

export interface EncryptedData {
  /** Base64-encoded ciphertext */
  ciphertext: string;
  /** Base64-encoded initialization vector */
  iv: string;
  /** Base64-encoded authentication tag (for GCM mode) */
  authTag?: string;
  /** Algorithm used for encryption */
  algorithm: EncryptionAlgorithm;
  /** Key version used for encryption */
  keyVersion: number;
}

export interface EncryptionKeyMetadata {
  id: string;
  organizationId: string;
  version: number;
  algorithm: EncryptionAlgorithm;
  /** SHA-256 hash of the key for verification */
  keyHash: string;
  isActive: boolean;
  createdAt: Date;
  expiresAt?: Date;
  /** Description for admin reference */
  description?: string;
}

export interface BYOKConfig {
  /** Whether BYOK is enabled for this organization */
  enabled: boolean;
  /** The active encryption key version */
  activeKeyVersion: number;
  /** List of key metadata (not the actual keys) */
  keys: EncryptionKeyMetadata[];
  /** Whether to allow system-managed keys as fallback */
  allowSystemKeyFallback: boolean;
}

export interface EncryptionResult {
  success: boolean;
  data?: EncryptedData;
  error?: string;
}

export interface DecryptionResult {
  success: boolean;
  plaintext?: string;
  error?: string;
}

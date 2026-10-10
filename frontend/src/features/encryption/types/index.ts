/**
 * Encryption Key Management Types
 */

export type EncryptionAlgorithm =
  | "aes-256-gcm"
  | "aes-256-cbc"
  | "chacha20-poly1305";

export interface EncryptionKey {
  id: string;
  version: number;
  algorithm: EncryptionAlgorithm;
  isActive: boolean;
  createdAt: string;
  expiresAt?: string;
  description?: string;
}

export interface EncryptionConfig {
  enabled: boolean;
  activeKeyVersion: number | null;
  allowSystemKeyFallback: boolean;
  keys: EncryptionKey[];
}

export interface RegisterKeyParams {
  key?: string;
  passphrase?: string;
  description?: string;
  algorithm?: EncryptionAlgorithm;
  generateNew?: boolean;
}

export interface RegisterKeyResult {
  success: boolean;
  message: string;
  key?: string; // Only returned when generateNew=true
  salt?: string; // Only returned when passphrase used
  metadata: {
    id: string;
    version: number;
    algorithm: EncryptionAlgorithm;
    createdAt: string;
    description?: string;
  };
}

export interface RotateKeyParams {
  key: string;
  description?: string;
}

export interface RotateKeyResult {
  success: boolean;
  message: string;
  newVersion: number;
}

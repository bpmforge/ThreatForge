/**
 * Two-Factor Authentication Service
 *
 * Handles TOTP-based 2FA setup, verification, and backup codes.
 */
import { authenticator } from "otplib";
import * as QRCode from "qrcode";
import * as crypto from "crypto";
import { encryptValue, decryptValue } from "./encryption/encryption-service.js";

// Configure authenticator
authenticator.options = {
  digits: 6,
  step: 30, // 30-second window
  window: 1, // Allow 1 step before/after for clock drift
};

const APP_NAME = "ThreatForge";
const BACKUP_CODE_COUNT = 10;

export interface TwoFactorSetupResult {
  secret: string;
  qrCodeDataUrl: string;
  backupCodes: string[];
}

/**
 * Generate a new TOTP secret and QR code for 2FA setup
 */
export async function generateTwoFactorSetup(
  userEmail: string,
): Promise<TwoFactorSetupResult> {
  // Generate a random secret
  const secret = authenticator.generateSecret();

  // Create the otpauth URL
  const otpauthUrl = authenticator.keyuri(userEmail, APP_NAME, secret);

  // Generate QR code as data URL
  const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl, {
    width: 256,
    margin: 2,
    color: {
      dark: "#000000",
      light: "#ffffff",
    },
  });

  // Generate backup codes
  const backupCodes = generateBackupCodes();

  return {
    secret,
    qrCodeDataUrl,
    backupCodes,
  };
}

/**
 * Verify a TOTP code against a secret
 */
export function verifyTOTPCode(secret: string, code: string): boolean {
  try {
    return authenticator.verify({ token: code, secret });
  } catch {
    return false;
  }
}

/**
 * Generate random backup codes
 */
export function generateBackupCodes(): string[] {
  const codes: string[] = [];
  for (let i = 0; i < BACKUP_CODE_COUNT; i++) {
    // Generate a random code in format: XXXX-XXXX
    const part1 = crypto.randomBytes(2).toString("hex").toUpperCase();
    const part2 = crypto.randomBytes(2).toString("hex").toUpperCase();
    codes.push(`${part1}-${part2}`);
  }
  return codes;
}

/**
 * Hash a backup code for storage
 */
function hashBackupCode(code: string): string {
  // Normalize: remove dashes and uppercase
  const normalized = code.replace(/-/g, "").toUpperCase();
  return crypto.createHash("sha256").update(normalized).digest("hex");
}

/**
 * Verify a backup code against stored hashed codes
 * Returns the index of the matched code (for removal) or -1 if not found
 */
export function verifyBackupCode(code: string, hashedCodes: string[]): number {
  const hashedInput = hashBackupCode(code);
  return hashedCodes.findIndex((stored) => stored === hashedInput);
}

/**
 * Encrypt the TOTP secret for storage
 */
export function encryptSecret(secret: string): string {
  const encrypted = encryptValue(secret);
  if (!encrypted) {
    throw new Error("Failed to encrypt secret");
  }
  return encrypted;
}

/**
 * Decrypt the TOTP secret from storage
 */
export function decryptSecret(encrypted: string): string {
  const decrypted = decryptValue(encrypted);
  if (!decrypted) {
    throw new Error("Failed to decrypt secret");
  }
  return decrypted;
}

/**
 * Hash and encrypt backup codes for storage
 */
export function prepareBackupCodesForStorage(codes: string[]): string {
  const hashedCodes = codes.map(hashBackupCode);
  const encrypted = encryptValue(JSON.stringify(hashedCodes));
  if (!encrypted) {
    throw new Error("Failed to encrypt backup codes");
  }
  return encrypted;
}

/**
 * Encrypt backup codes that are already hashed (what remains after one is
 * used) for storage.
 */
export function storeHashedBackupCodes(hashedCodes: string[]): string {
  const encrypted = encryptValue(JSON.stringify(hashedCodes));
  if (!encrypted) {
    throw new Error("Failed to encrypt backup codes");
  }
  return encrypted;
}

/**
 * Decrypt and parse backup codes from storage
 */
export function getBackupCodesFromStorage(encrypted: string): string[] {
  try {
    const decrypted = decryptValue(encrypted);
    if (!decrypted) return [];
    return JSON.parse(decrypted);
  } catch {
    return [];
  }
}

/**
 * Count remaining backup codes
 */
export function countRemainingBackupCodes(encrypted: string | null): number {
  if (!encrypted) return 0;
  try {
    const codes = getBackupCodesFromStorage(encrypted);
    return codes.length;
  } catch {
    return 0;
  }
}

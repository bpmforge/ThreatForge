/**
 * Password Validation Service
 *
 * Validates passwords against configurable policy settings.
 * Policy is read from SystemSettings in the database.
 */
import { getPrisma } from "../db.js";
import logger from "../utils/logger.js";

interface PasswordPolicy {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecialChars: boolean;
}

export interface PasswordValidationResult {
  valid: boolean;
  errors: string[];
}

// Default policy (used if settings not found)
const DEFAULT_POLICY: PasswordPolicy = {
  minLength: 12,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: false,
};

// Cache for policy to avoid DB query on every validation
let policyCache: PasswordPolicy | null = null;
let policyCacheTime = 0;
const CACHE_TTL_MS = 60000; // 1 minute cache

/**
 * Get password policy from database with caching.
 */
async function getPasswordPolicy(): Promise<PasswordPolicy> {
  const now = Date.now();

  // Return cached policy if still valid
  if (policyCache && now - policyCacheTime < CACHE_TTL_MS) {
    return policyCache;
  }

  try {
    const prisma = await getPrisma();
    const settings = await prisma.systemSettings.findFirst({
      where: { id: "default" },
      select: {
        passwordMinLength: true,
        passwordRequireUppercase: true,
        passwordRequireLowercase: true,
        passwordRequireNumbers: true,
        passwordRequireSpecialChars: true,
      },
    });

    if (!settings) {
      policyCache = DEFAULT_POLICY;
    } else {
      policyCache = {
        minLength: settings.passwordMinLength,
        requireUppercase: settings.passwordRequireUppercase,
        requireLowercase: settings.passwordRequireLowercase,
        requireNumbers: settings.passwordRequireNumbers,
        requireSpecialChars: settings.passwordRequireSpecialChars,
      };
    }

    policyCacheTime = now;
    return policyCache;
  } catch (error) {
    logger.error({ err: error }, "Failed to fetch password policy");
    // Return default policy on error
    return DEFAULT_POLICY;
  }
}

/**
 * Clear the policy cache. Call this after settings are updated.
 */
export function clearPasswordPolicyCache(): void {
  policyCache = null;
  policyCacheTime = 0;
}

/**
 * Validate a password against the current policy.
 */
export async function validatePassword(
  password: string,
): Promise<PasswordValidationResult> {
  const policy = await getPasswordPolicy();
  const errors: string[] = [];

  // Check minimum length
  if (password.length < policy.minLength) {
    errors.push(`Password must be at least ${policy.minLength} characters`);
  }

  // Check uppercase requirement
  if (policy.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push("Password must contain at least one uppercase letter");
  }

  // Check lowercase requirement
  if (policy.requireLowercase && !/[a-z]/.test(password)) {
    errors.push("Password must contain at least one lowercase letter");
  }

  // Check numbers requirement
  if (policy.requireNumbers && !/[0-9]/.test(password)) {
    errors.push("Password must contain at least one number");
  }

  // Check special characters requirement
  if (
    policy.requireSpecialChars &&
    !/[!@#$%^&*()_+=\-[\]{};':"\\|,.<>/?`~]/.test(password)
  ) {
    errors.push("Password must contain at least one special character");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

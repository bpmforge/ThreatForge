/**
 * Username Generation & Validation Utilities
 *
 * Handles username generation from email/name and validation
 * for the organization system.
 */
import { getPrisma } from "./prisma";

/** Reserved usernames that cannot be used */
const RESERVED_USERNAMES = [
  // System routes
  "admin",
  "administrator",
  "api",
  "auth",
  "dashboard",
  "login",
  "logout",
  "register",
  "settings",
  "help",
  "support",
  "system",
  // Common reserved words
  "user",
  "users",
  "www",
  "root",
  "null",
  "undefined",
  "true",
  "false",
  "anonymous",
  "guest",
  // App-specific routes
  "shared",
  "models",
  "projects",
  "organizations",
  "org",
  "orgs",
  "templates",
  "libraries",
  "threats",
  "canvas",
  "export",
  "import",
  // Personal org suffix
  "personal",
];

/**
 * Generate a unique username from email and optional name.
 *
 * Algorithm:
 * 1. Start with email prefix (part before @)
 * 2. Sanitize: lowercase, replace special chars with dashes
 * 3. If too short, try using name
 * 4. If reserved, append '-user'
 * 5. If not unique, append incrementing suffix
 *
 * @param email - User's email address
 * @param name - Optional user's display name
 * @returns Unique username
 */
export async function generateUsername(
  email: string,
  name?: string | null,
): Promise<string> {
  const prisma = await getPrisma();

  // Extract email prefix and sanitize
  let base = email
    .split("@")[0]
    .toLowerCase()
    .replace(/[._+]/g, "-") // Replace common separators with dash
    .replace(/[^a-z0-9-]/g, "") // Remove non-alphanumeric except dash
    .replace(/-+/g, "-") // Collapse multiple dashes
    .replace(/^-|-$/g, "") // Trim leading/trailing dashes
    .substring(0, 25); // Leave room for suffix

  // If base is too short, try using name
  if (base.length < 3 && name) {
    base = name
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .substring(0, 25);
  }

  // Final fallback
  if (base.length < 3) {
    base = "user";
  }

  // Check if reserved
  if (RESERVED_USERNAMES.includes(base)) {
    base = `${base}-user`;
  }

  // Ensure uniqueness by checking database
  let username = base;
  let suffix = 1;
  const maxAttempts = 100;

  while (suffix <= maxAttempts) {
    const existing = await prisma.user.findUnique({
      where: { username },
      select: { id: true },
    });

    if (!existing) {
      return username;
    }

    username = `${base}-${suffix}`;
    suffix++;
  }

  // Extremely unlikely fallback - use random suffix
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  return `${base}-${randomSuffix}`;
}

/**
 * Validate a username for format and availability.
 *
 * @param username - Username to validate
 * @param excludeUserId - Optional user ID to exclude (for updates)
 * @returns Validation result with error message if invalid
 */
export async function validateUsername(
  username: string,
  excludeUserId?: string,
): Promise<{ valid: boolean; error?: string }> {
  const formatResult = validateUsernameFormat(username);
  if (!formatResult.valid) {
    return formatResult;
  }

  // Check uniqueness
  const prisma = await getPrisma();
  const existing = await prisma.user.findUnique({
    where: { username },
    select: { id: true },
  });

  if (existing && existing.id !== excludeUserId) {
    return { valid: false, error: "This username is already taken" };
  }

  return { valid: true };
}

/**
 * Synchronously validate username format (no database check).
 * Use this for client-side validation before making API calls.
 */
export function validateUsernameFormat(username: string): {
  valid: boolean;
  error?: string;
} {
  if (username.length < 3) {
    return { valid: false, error: "Username must be at least 3 characters" };
  }
  if (username.length > 30) {
    return { valid: false, error: "Username must be at most 30 characters" };
  }
  if (!/^[a-z0-9-]+$/.test(username)) {
    return {
      valid: false,
      error:
        "Username can only contain lowercase letters, numbers, and hyphens",
    };
  }
  if (username.startsWith("-") || username.endsWith("-")) {
    return {
      valid: false,
      error: "Username cannot start or end with a hyphen",
    };
  }
  if (/--/.test(username)) {
    return {
      valid: false,
      error: "Username cannot contain consecutive hyphens",
    };
  }
  if (RESERVED_USERNAMES.includes(username)) {
    return { valid: false, error: "This username is reserved" };
  }
  return { valid: true };
}

/**
 * Generate a personal organization slug from username.
 * Format: {username}-personal
 */
export function generatePersonalOrgSlug(username: string): string {
  return `${username}-personal`;
}

/**
 * Check if an organization slug indicates a personal workspace.
 */
export function isPersonalOrgSlug(slug: string): boolean {
  return slug.endsWith("-personal");
}

/** Export reserved usernames for testing */
export { RESERVED_USERNAMES };

/**
 * Shared utilities for auth-public routes
 */
import crypto from "crypto";
import { getAuthRateLimit } from "../../middleware/rate-limit.js";

/** Token expiry time (1 hour) */
export const TOKEN_EXPIRY_MS = 60 * 60 * 1000;

/** Generate a secure random token */
export function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * Options for a pre-login route that takes an email address: the auth rate
 * limit plus its public authz declaration (`why` says why that is safe).
 */
export function emailRequestRouteOptions(why: string) {
  return { config: { ...getAuthRateLimit().config, authz: { public: why } } };
}

const VERIFICATION_HASH_PREFIX = "sha256:";

/** Stored form of an email verification token: `sha256:<hex>`. */
export function hashVerificationToken(token: string): string {
  return (
    VERIFICATION_HASH_PREFIX +
    crypto.createHash("sha256").update(token).digest("hex")
  );
}

/**
 * Values a submitted verification token may match in the DB: its hash, plus
 * the raw value for rows written before tokens were hashed (those expire
 * within 24 h, and callers always filter on expiry). A submitted value that
 * already looks like a stored hash only matches as a hash, so a leaked DB
 * value cannot be replayed as a token.
 */
export function verificationTokenCandidates(token: string): string[] {
  const hashed = hashVerificationToken(token);
  return token.startsWith(VERIFICATION_HASH_PREFIX)
    ? [hashed]
    : [hashed, token];
}

/**
 * IP Allowlist Middleware
 *
 * Restricts API access to a configured list of IP addresses or CIDR ranges.
 * Used for enterprise deployments requiring network-level access control.
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { getPrisma } from "../db.js";
import logger from "../utils/logger.js";

/**
 * Check if an IP address matches a CIDR range.
 * Supports both IPv4 addresses and CIDR notation (e.g., "192.168.1.0/24").
 */
function ipMatchesCidr(ip: string, cidr: string): boolean {
  // Handle exact match
  if (ip === cidr) return true;

  // Handle CIDR notation
  if (!cidr.includes("/")) return false;

  const [range, bits] = cidr.split("/");
  const mask = parseInt(bits, 10);

  if (isNaN(mask) || mask < 0 || mask > 32) return false;

  const ipParts = ip.split(".").map(Number);
  const rangeParts = range.split(".").map(Number);

  if (ipParts.length !== 4 || rangeParts.length !== 4) return false;
  if (ipParts.some((p) => isNaN(p) || p < 0 || p > 255)) return false;
  if (rangeParts.some((p) => isNaN(p) || p < 0 || p > 255)) return false;

  const ipNum =
    (ipParts[0] << 24) | (ipParts[1] << 16) | (ipParts[2] << 8) | ipParts[3];
  const rangeNum =
    (rangeParts[0] << 24) |
    (rangeParts[1] << 16) |
    (rangeParts[2] << 8) |
    rangeParts[3];
  const maskNum = ~((1 << (32 - mask)) - 1);

  return (ipNum & maskNum) === (rangeNum & maskNum);
}

/**
 * Check if an IP is in the allowlist.
 */
function isIpAllowed(ip: string, allowlist: string[]): boolean {
  // Handle IPv6 localhost mapping to IPv4
  const normalizedIp = ip === "::1" ? "127.0.0.1" : ip.replace("::ffff:", "");

  for (const entry of allowlist) {
    if (ipMatchesCidr(normalizedIp, entry)) {
      return true;
    }
  }
  return false;
}

// Cache for settings to avoid DB query on every request
let settingsCache: { enabled: boolean; allowlist: string[] } | null = null;
let settingsCacheTime = 0;
const CACHE_TTL_MS = 60000; // 1 minute cache

/**
 * Get IP allowlist settings from database with caching.
 */
async function getIpAllowlistSettings(): Promise<{
  enabled: boolean;
  allowlist: string[];
}> {
  const now = Date.now();

  // Return cached settings if still valid
  if (settingsCache && now - settingsCacheTime < CACHE_TTL_MS) {
    return settingsCache;
  }

  try {
    const prisma = await getPrisma();
    const settings = await prisma.systemSettings.findFirst({
      where: { id: "default" },
      select: { ipAllowlistEnabled: true, ipAllowlist: true },
    });

    if (!settings) {
      settingsCache = { enabled: false, allowlist: [] };
    } else {
      let allowlist: string[] = [];
      if (settings.ipAllowlist) {
        try {
          allowlist = JSON.parse(settings.ipAllowlist);
          if (!Array.isArray(allowlist)) allowlist = [];
        } catch {
          allowlist = [];
        }
      }
      settingsCache = { enabled: settings.ipAllowlistEnabled, allowlist };
    }

    settingsCacheTime = now;
    return settingsCache;
  } catch (error) {
    logger.error({ err: error }, "Failed to fetch IP allowlist settings:");
    // On error, fail open (allow all) to avoid lockouts
    return { enabled: false, allowlist: [] };
  }
}

/**
 * Clear the settings cache. Call this after settings are updated.
 */
export function clearIpAllowlistCache(): void {
  settingsCache = null;
  settingsCacheTime = 0;
}

/**
 * Register IP allowlist middleware.
 * Checks every request against the configured allowlist.
 */
export async function registerIpAllowlist(
  server: FastifyInstance,
): Promise<void> {
  server.addHook(
    "onRequest",
    async (request: FastifyRequest, reply: FastifyReply) => {
      // Skip health check endpoint
      if (request.url === "/health") return;

      // Skip if allowlist is disabled or empty
      const { enabled, allowlist } = await getIpAllowlistSettings();
      if (!enabled || allowlist.length === 0) return;

      const clientIp = request.ip;

      if (!isIpAllowed(clientIp, allowlist)) {
        server.log.warn({ ip: clientIp }, "IP address blocked by allowlist");
        return reply.status(403).send({
          error: "Forbidden",
          message: "Your IP address is not allowed to access this service.",
          statusCode: 403,
        });
      }
    },
  );
}

/**
 * Validate an IP allowlist array.
 * Returns an array of validation errors, or empty array if valid.
 */
export function validateIpAllowlist(allowlist: string[]): string[] {
  const errors: string[] = [];

  for (const entry of allowlist) {
    if (!entry || typeof entry !== "string") {
      errors.push(`Invalid entry: ${entry}`);
      continue;
    }

    const trimmed = entry.trim();
    if (!trimmed) {
      errors.push("Empty entry in allowlist");
      continue;
    }

    // Check if it's a valid IP or CIDR
    if (trimmed.includes("/")) {
      // CIDR notation
      const [ip, bits] = trimmed.split("/");
      const parts = ip.split(".");
      const mask = parseInt(bits, 10);

      if (parts.length !== 4) {
        errors.push(`Invalid CIDR: ${trimmed}`);
        continue;
      }

      if (
        parts.some((p) => isNaN(Number(p)) || Number(p) < 0 || Number(p) > 255)
      ) {
        errors.push(`Invalid IP in CIDR: ${trimmed}`);
        continue;
      }

      if (isNaN(mask) || mask < 0 || mask > 32) {
        errors.push(`Invalid CIDR mask: ${trimmed}`);
        continue;
      }
    } else {
      // Plain IP address
      const parts = trimmed.split(".");
      if (parts.length !== 4) {
        errors.push(`Invalid IP address: ${trimmed}`);
        continue;
      }

      if (
        parts.some((p) => isNaN(Number(p)) || Number(p) < 0 || Number(p) > 255)
      ) {
        errors.push(`Invalid IP address: ${trimmed}`);
        continue;
      }
    }
  }

  return errors;
}

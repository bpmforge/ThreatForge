/**
 * Which loopback / private-network AI endpoints this server may call.
 *
 * Self-hosted models live on the LAN, so private AI base URLs have a use; but
 * any user can create an organization, and an unchecked base URL lets them aim
 * the server's requests at the internal network. The effective policy is the
 * union of:
 *   - SystemSettings.aiPrivateHostAllowlist / aiAllowAllPrivateHosts, managed
 *     by a platform super-admin (Admin -> Settings -> AI), and
 *   - AI_PRIVATE_HOST_ALLOWLIST (comma-separated hostnames, IPs, CIDRs) and
 *     AI_ALLOW_ALL_PRIVATE_HOSTS=true from the environment, so an operator can
 *     keep an existing private endpoint working from the first boot of a
 *     deploy (see docs/ADMIN_RUNBOOK.md).
 * Link-local and cloud-metadata addresses are refused whatever the policy says.
 */
import { getPrisma } from "../../db.js";
import logger from "../../utils/logger.js";
import {
  checkAIBaseUrl,
  validatePrivateHostEntries,
  type PrivateHostPolicy,
} from "../../utils/outbound-url.js";

const CACHE_TTL_MS = 60_000;

let cachedPolicy: { policy: PrivateHostPolicy; at: number } | null = null;
const verdicts = new Map<string, { error: string | null; at: number }>();

/** Usable entries only: an invalid one is logged and ignored, never widened. */
function usableEntries(entries: string[], source: string): string[] {
  return entries.filter((entry) => {
    const errors = validatePrivateHostEntries([entry]);
    if (errors.length > 0) {
      logger.warn(
        { source, error: errors[0] },
        "ignoring AI private-host entry",
      );
    }
    return errors.length === 0;
  });
}

/** The environment's contribution, also shown read-only in the admin UI. */
export function envPrivateHostPolicy(
  env: NodeJS.ProcessEnv = process.env,
): PrivateHostPolicy {
  const entries = (env.AI_PRIVATE_HOST_ALLOWLIST ?? "")
    .split(/[\s,]+/)
    .filter(Boolean);
  return {
    allowAll: env.AI_ALLOW_ALL_PRIVATE_HOSTS === "true",
    entries: usableEntries(entries, "AI_PRIVATE_HOST_ALLOWLIST"),
  };
}

/**
 * Parse the stored JSON list. The admin route only ever writes a JSON array;
 * anything else is corruption and throws, so the policy load fails closed.
 */
export function parseStoredAllowlist(stored: string | null): string[] {
  if (!stored) return [];
  const parsed: unknown = JSON.parse(stored);
  if (!Array.isArray(parsed)) {
    throw new Error(
      "SystemSettings.aiPrivateHostAllowlist is not a JSON array",
    );
  }
  return parsed.filter((e): e is string => typeof e === "string");
}

async function loadSettingsPolicy(): Promise<PrivateHostPolicy> {
  try {
    const prisma = await getPrisma();
    const settings = await prisma.systemSettings.findFirst({
      where: { id: "default" },
      select: { aiPrivateHostAllowlist: true, aiAllowAllPrivateHosts: true },
    });
    return {
      allowAll: settings?.aiAllowAllPrivateHosts ?? false,
      entries: usableEntries(
        parseStoredAllowlist(settings?.aiPrivateHostAllowlist ?? null),
        "SystemSettings",
      ),
    };
  } catch (err) {
    // Fail closed on the stored part; the environment still applies.
    logger.error({ err }, "failed to load AI private-host allowlist");
    return { allowAll: false, entries: [] };
  }
}

export async function getPrivateHostPolicy(): Promise<PrivateHostPolicy> {
  if (cachedPolicy && Date.now() - cachedPolicy.at < CACHE_TTL_MS) {
    return cachedPolicy.policy;
  }
  const stored = await loadSettingsPolicy();
  const env = envPrivateHostPolicy();
  const policy = {
    allowAll: stored.allowAll || env.allowAll,
    entries: [...new Set([...stored.entries, ...env.entries])],
  };
  cachedPolicy = { policy, at: Date.now() };
  return policy;
}

/** Call after the super-admin changes the allowlist. */
export function clearPrivateHostPolicyCache(): void {
  cachedPolicy = null;
  verdicts.clear();
}

/**
 * Validate a base URL an organization configured for the server to call (AI
 * endpoints, scanners, CI providers). Private hosts need the super-admin
 * allowlist; link-local and cloud metadata addresses are always refused.
 * Returns an error message or null.
 */
export async function checkTenantBaseUrl(raw: string): Promise<string | null> {
  return checkAIBaseUrl(raw, await getPrivateHostPolicy());
}

/**
 * Call-time check for a stored base URL (it may predate the allowlist, or the
 * host may have been removed from it). Verdicts are cached per URL for a
 * minute so a busy pipeline does not resolve DNS on every completion.
 */
export async function assertAIEndpointAllowed(baseUrl: string): Promise<void> {
  const hit = verdicts.get(baseUrl);
  let error: string | null;
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    error = hit.error;
  } else {
    error = await checkTenantBaseUrl(baseUrl);
    verdicts.set(baseUrl, { error, at: Date.now() });
  }
  if (error) throw new Error(`AI endpoint refused: ${error}`);
}

/**
 * The NVD API key this install uses for CVE lookups.
 *
 * NVD (nvd.nist.gov) allows 5 requests per 30 s without a key and 50 with
 * one, per key. Each install registers its own key: a super-admin enters it
 * in Admin > Settings (stored encrypted in SystemSettings.nvdApiKey), or a
 * self-hoster sets NVD_API_KEY in the environment. The admin setting wins.
 */
import { getPrisma } from "../../db.js";
import { decryptValue } from "../encryption/encryption-service.js";
import logger from "../../utils/logger.js";

export type NvdApiKeySource = "settings" | "environment" | "none";

const CACHE_MS = 60_000;
let cached: {
  key: string | undefined;
  source: NvdApiKeySource;
  at: number;
} | null = null;

async function resolve(): Promise<{
  key: string | undefined;
  source: NvdApiKeySource;
}> {
  try {
    const prisma = await getPrisma();
    const row = await prisma.systemSettings.findUnique({
      where: { id: "default" },
      select: { nvdApiKey: true },
    });
    if (row?.nvdApiKey) {
      const key = decryptValue(row.nvdApiKey);
      if (key) return { key, source: "settings" };
      logger.warn(
        "Stored NVD API key could not be decrypted; using the environment value if any",
      );
    }
  } catch (err) {
    logger.warn({ err }, "Could not read the NVD API key setting");
  }
  const env = process.env.NVD_API_KEY?.trim();
  return env
    ? { key: env, source: "environment" }
    : { key: undefined, source: "none" };
}

/** The key to send as NVD's `apiKey` header, or undefined to call without one. */
export async function getNvdApiKey(): Promise<string | undefined> {
  if (!cached || Date.now() - cached.at > CACHE_MS) {
    cached = { ...(await resolve()), at: Date.now() };
  }
  return cached.key;
}

/** Where the key in use comes from (for the admin settings screen). */
export async function getNvdApiKeySource(): Promise<NvdApiKeySource> {
  await getNvdApiKey();
  return cached!.source;
}

/** Call after the admin setting changes. */
export function clearNvdApiKeyCache(): void {
  cached = null;
}

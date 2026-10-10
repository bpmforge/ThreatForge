/**
 * EPSS (Exploit Prediction Scoring System) client.
 *
 * Queries https://api.first.org for the probability that a CVE will be
 * exploited in the next 30 days (0..1). Used to calibrate severity: a high
 * CVSS but very low EPSS vuln is systematically over-prioritized, so we
 * de-prioritize it. Degrades gracefully — failures return an empty map and
 * calibration falls back to the rule-based path.
 *
 * In-process 24h TTL cache (Redis cache is the deferred backlog #63).
 */
import logger from "../../utils/logger.js";

const EPSS_API = "https://api.first.org/data/v1/epss";
const EPSS_TIMEOUT_MS = 5000;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

/** Below this EPSS probability a vuln is considered unlikely to be exploited. */
export const EPSS_LOW_THRESHOLD = 0.05;

interface CacheEntry {
  score: number;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

interface EpssRow {
  cve?: string;
  epss?: string;
}

/**
 * Fetch EPSS scores for a set of CVE ids. Returns a map of CVE → probability.
 * CVEs with no EPSS data are simply absent from the map. Cached entries are
 * served without a network call; only uncached CVEs are queried (batched).
 */
export async function getEpssScores(
  cveIds: string[],
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  const now = Date.now();
  const toFetch: string[] = [];

  for (const cve of new Set(cveIds)) {
    const cached = cache.get(cve);
    if (cached && cached.expiresAt > now) {
      out.set(cve, cached.score);
    } else {
      toFetch.push(cve);
    }
  }

  if (toFetch.length === 0) return out;

  try {
    const params = new URLSearchParams({ cve: toFetch.join(",") });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), EPSS_TIMEOUT_MS);
    const res = await fetch(`${EPSS_API}?${params}`, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) return out;

    const data = (await res.json()) as { data?: EpssRow[] };
    for (const row of data.data ?? []) {
      if (!row.cve) continue;
      const score = Number(row.epss);
      if (Number.isFinite(score)) {
        out.set(row.cve, score);
        cache.set(row.cve, { score, expiresAt: now + CACHE_TTL_MS });
      }
    }
  } catch (err) {
    logger.warn(
      { err, count: toFetch.length },
      "EPSS lookup failed; skipping calibration",
    );
  }

  return out;
}

/** Test/maintenance helper. */
export function _clearEpssCache(): void {
  cache.clear();
}

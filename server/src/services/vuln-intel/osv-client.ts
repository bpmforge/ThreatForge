/**
 * OSV (Open Source Vulnerabilities) client.
 *
 * Queries https://osv.dev for known vulnerabilities affecting a dependency.
 * Used to enrich rule-based supply-chain threats with real CVE identifiers
 * and severities. Degrades gracefully: any network/parse failure returns an
 * empty result so the caller falls back to template-only threats.
 *
 * Results are cached in-process with a 24h TTL (backlog #63 covers a shared
 * Redis cache; this is intentionally process-local and right-sized for #52).
 */
import logger from "../../utils/logger.js";

const OSV_API = "https://api.osv.dev/v1/query";
const OSV_TIMEOUT_MS = 5000;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

/** Map ThreatForge ecosystem labels to OSV's expected ecosystem names. */
const OSV_ECOSYSTEM: Record<string, string> = {
  npm: "npm",
  pypi: "PyPI",
  cargo: "crates.io",
  maven: "Maven",
  go: "Go",
};

export interface OsvResult {
  cveIds: string[];
  /** Highest CVSS base score found across matching vulns, if any. */
  maxCvss?: number;
  /** First vulnerability summary, for threat description context. */
  summary?: string;
}

interface CacheEntry {
  data: OsvResult;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

interface OsvVuln {
  id?: string;
  summary?: string;
  aliases?: string[];
  severity?: Array<{ type?: string; score?: string }>;
}

/** Pull the numeric CVSS base score out of an OSV CVSS_V3 vector string. */
function parseCvssScore(vuln: OsvVuln): number | undefined {
  // OSV severity scores are CVSS vector strings, not numbers; the vector
  // itself doesn't carry the base score, so we rely on database_specific
  // when present. Absent a reliable score we return undefined and let the
  // template severity stand.
  const sev = vuln.severity?.[0]?.score;
  if (!sev) return undefined;
  const asNum = Number(sev);
  return Number.isFinite(asNum) ? asNum : undefined;
}

/**
 * Query OSV for vulnerabilities affecting a specific dependency version.
 * Returns deduplicated CVE ids (from vuln aliases) plus best-effort severity.
 */
export async function queryOsvVulnerabilities(
  ecosystem: string,
  name: string,
  version: string | null | undefined,
): Promise<OsvResult> {
  const osvEcosystem = OSV_ECOSYSTEM[ecosystem.toLowerCase()] ?? "npm";
  const cacheKey = `${osvEcosystem}:${name}:${version ?? ""}`;

  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  const result: OsvResult = { cveIds: [] };

  try {
    const body: Record<string, unknown> = {
      package: { name, ecosystem: osvEcosystem },
    };
    if (version) body.version = version;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), OSV_TIMEOUT_MS);
    const res = await fetch(OSV_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      cache.set(cacheKey, {
        data: result,
        expiresAt: Date.now() + CACHE_TTL_MS,
      });
      return result;
    }

    const data = (await res.json()) as { vulns?: OsvVuln[] };
    const cveSet = new Set<string>();
    let maxCvss: number | undefined;
    let summary: string | undefined;

    for (const vuln of data.vulns ?? []) {
      for (const alias of vuln.aliases ?? []) {
        if (alias.startsWith("CVE-")) cveSet.add(alias);
      }
      if (!summary && vuln.summary) summary = vuln.summary;
      const score = parseCvssScore(vuln);
      if (score !== undefined && (maxCvss === undefined || score > maxCvss)) {
        maxCvss = score;
      }
    }

    result.cveIds = [...cveSet];
    result.maxCvss = maxCvss;
    result.summary = summary;
  } catch (err) {
    logger.warn(
      { err, name, ecosystem },
      "OSV lookup failed; using templates only",
    );
  }

  cache.set(cacheKey, { data: result, expiresAt: Date.now() + CACHE_TTL_MS });
  return result;
}

/** Test/maintenance helper. */
export function _clearOsvCache(): void {
  cache.clear();
}

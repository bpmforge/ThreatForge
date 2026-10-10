/**
 * Deep Search Service (extended local search)
 *
 * Searches the bundled extended CWE database (data/cwe-database) for entries
 * beyond the curated catalog index. Everything runs locally: no external
 * API or network request is made. MITRE ATT&CK and CAPEC are served by the
 * main local index only.
 */

import type { CatalogThreat, CatalogReference, ThreatSource } from "../types";
import { searchCWEs, getCWECount, type CWEEntry } from "../data/cwe-database";

export interface DeepSearchResult {
  threats: CatalogThreat[];
  source: ThreatSource;
  totalAvailable: number;
  searchedAt: Date;
  fromCache: boolean;
}

export interface DeepSearchOptions {
  query: string;
  sources?: ThreatSource[];
  maxResults?: number;
}

/**
 * Convert CWE entry to CatalogThreat format
 */
function cweEntryToThreat(cwe: CWEEntry): CatalogThreat {
  const reference: CatalogReference = {
    source: "CWE",
    id: cwe.id,
    url: cwe.cweUrl,
  };

  return {
    id: `CWE-DEEP-${cwe.id}`,
    source: "CWE" as ThreatSource,
    name: `${cwe.id}: ${cwe.name}`,
    description: cwe.description,
    strideCategories: cwe.strideCategories,
    severity: cwe.severity,
    applicableTo: [],
    tags: [cwe.category.toLowerCase().replace(/-/g, " "), "cwe"],
    references: [reference],
    externalUrl: cwe.cweUrl,
  };
}

/**
 * Search CWE database using the comprehensive local database
 */
async function searchCWE(
  query: string,
  maxResults = 50,
): Promise<DeepSearchResult> {
  const searchedAt = new Date();

  try {
    const cweResults = searchCWEs(query, maxResults);
    const threats = cweResults.map(cweEntryToThreat);

    return {
      threats,
      source: "CWE",
      totalAvailable: getCWECount(),
      searchedAt,
      fromCache: false,
    };
  } catch (error) {
    console.error("CWE search failed:", error);
    return {
      threats: [],
      source: "CWE",
      totalAvailable: 0,
      searchedAt,
      fromCache: false,
    };
  }
}

/**
 * MITRE ATT&CK has no extended dataset beyond the main local index, so the
 * extended search contributes no additional ATT&CK results.
 */
async function searchMITRE(
  _query: string,
  _maxResults = 50,
): Promise<DeepSearchResult> {
  return {
    threats: [],
    source: "MITRE_ATTACK",
    totalAvailable: 0,
    searchedAt: new Date(),
    fromCache: false,
  };
}

/**
 * Combined deep search across all sources
 */
export async function deepSearch(
  options: DeepSearchOptions,
): Promise<DeepSearchResult[]> {
  const {
    query,
    sources = ["CWE", "MITRE_ATTACK", "CAPEC"],
    maxResults = 50,
  } = options;

  const results: DeepSearchResult[] = [];

  if (sources.includes("CWE")) {
    results.push(await searchCWE(query, maxResults));
  }

  if (sources.includes("MITRE_ATTACK")) {
    results.push(await searchMITRE(query, maxResults));
  }

  // CAPEC has no extended dataset; it is covered by the main local index.

  return results;
}

/**
 * Get expanded CWE count from comprehensive database
 */
export function getExpandedCWECount(): number {
  return getCWECount();
}

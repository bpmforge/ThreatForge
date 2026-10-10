/**
 * Threat Catalog Search Service
 *
 * Federated search across built-in library and external indexes.
 */
import type {
  CatalogThreat,
  CatalogFilters,
  CatalogSearchResult,
  ThreatSource,
  ThreatIndexEntry,
  CatalogReference,
} from "../types";
import type { StrideCategory, Severity, ComponentType } from "@/types/canvas";
import { builtInThreats } from "../data";
import {
  mitreAttackIndex,
  cweIndex,
  capecIndex,
  getExternalDetailUrl,
} from "../data/external-indexes";

const DEFAULT_PAGE_SIZE = 20;

/** Search the threat catalog with filters */
export function searchCatalog(
  filters: Partial<CatalogFilters>,
  page = 1,
  pageSize = DEFAULT_PAGE_SIZE,
): CatalogSearchResult {
  const {
    query = "",
    sources = [],
    strideCategories = [],
    componentTypes = [],
    severities = [],
    tags = [],
  } = filters;

  const searchQuery = query.toLowerCase().trim();
  const results: CatalogThreat[] = [];

  // Search built-in threats if source filter allows
  if (sources.length === 0 || sources.includes("BUILT_IN")) {
    const builtInResults = searchBuiltIn(
      searchQuery,
      strideCategories,
      componentTypes,
      severities,
      tags,
    );
    results.push(...builtInResults);
  }

  // Search external indexes if enabled
  if (sources.length === 0 || sources.includes("MITRE_ATTACK")) {
    const mitreResults = searchIndex(
      mitreAttackIndex,
      "MITRE_ATTACK",
      searchQuery,
      strideCategories,
      severities,
      tags,
    );
    results.push(...mitreResults);
  }

  if (sources.length === 0 || sources.includes("CWE")) {
    const cweResults = searchIndex(
      cweIndex,
      "CWE",
      searchQuery,
      strideCategories,
      severities,
      tags,
    );
    results.push(...cweResults);
  }

  if (sources.length === 0 || sources.includes("CAPEC")) {
    const capecResults = searchIndex(
      capecIndex,
      "CAPEC",
      searchQuery,
      strideCategories,
      severities,
      tags,
    );
    results.push(...capecResults);
  }

  // Sort by relevance (exact matches first, then by severity)
  const sorted = sortByRelevance(results, searchQuery);

  // Paginate
  const total = sorted.length;
  const startIndex = (page - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const threats = sorted.slice(startIndex, endIndex);

  return {
    threats,
    total,
    page,
    pageSize,
    hasMore: endIndex < total,
  };
}

/** Search built-in threats */
function searchBuiltIn(
  query: string,
  categories: StrideCategory[],
  componentTypes: ComponentType[],
  severities: Severity[],
  tags: string[],
): CatalogThreat[] {
  return builtInThreats.filter((threat) => {
    // Text search
    if (query) {
      const searchable = [
        threat.name,
        threat.description,
        ...(threat.tags || []),
        ...(threat.attackScenarios || []),
      ]
        .join(" ")
        .toLowerCase();

      if (!searchable.includes(query)) {
        return false;
      }
    }

    // Category filter - threat must have at least one matching category
    if (
      categories.length > 0 &&
      !threat.strideCategories.some((c) => categories.includes(c))
    ) {
      return false;
    }

    // Component type filter
    if (componentTypes.length > 0) {
      const hasMatch = threat.applicableTo.some((t) =>
        componentTypes.includes(t),
      );
      if (!hasMatch && threat.applicableTo.length > 0) {
        return false;
      }
    }

    // Severity filter
    if (severities.length > 0 && !severities.includes(threat.severity)) {
      return false;
    }

    // Tags filter
    if (tags.length > 0) {
      const threatTags = threat.tags || [];
      const hasTag = tags.some((t) => threatTags.includes(t));
      if (!hasTag) {
        return false;
      }
    }

    return true;
  });
}

/** Search an external index and convert to CatalogThreat */
function searchIndex(
  index: ThreatIndexEntry[],
  source: ThreatSource,
  query: string,
  categories: StrideCategory[],
  severities: Severity[],
  tags: string[],
): CatalogThreat[] {
  const matches = index.filter((entry) => {
    // Text search in name and keywords
    if (query) {
      const searchable = [entry.name, ...entry.keywords]
        .join(" ")
        .toLowerCase();
      if (!searchable.includes(query)) {
        return false;
      }
    }

    // Category filter - entry must have at least one matching category
    if (
      categories.length > 0 &&
      !entry.strideCategories.some((c) => categories.includes(c))
    ) {
      return false;
    }

    // Severity filter
    if (severities.length > 0 && !severities.includes(entry.severity)) {
      return false;
    }

    // Tags filter
    if (tags.length > 0) {
      const hasTag = tags.some((t) => entry.tags.includes(t));
      if (!hasTag) {
        return false;
      }
    }

    return true;
  });

  // Convert index entries to CatalogThreat
  return matches.map((entry) => indexEntryToThreat(entry, source));
}

/** Convert index entry to full CatalogThreat */
function indexEntryToThreat(
  entry: ThreatIndexEntry,
  source: ThreatSource,
): CatalogThreat {
  const sourceLabel = getSourceLabel(source);
  const reference: CatalogReference = {
    source:
      source === "MITRE_ATTACK"
        ? "MITRE"
        : (source as CatalogReference["source"]),
    id: entry.id,
    url: getExternalDetailUrl(source, entry.id),
  };

  return {
    id: `${source}-${entry.id}`,
    source,
    name: entry.name,
    description: `${sourceLabel} ${entry.id}: ${entry.name}. Search keywords: ${entry.keywords.join(", ")}.`,
    strideCategories: entry.strideCategories,
    severity: entry.severity,
    applicableTo: [],
    tags: entry.tags,
    references: [reference],
    externalUrl: getExternalDetailUrl(source, entry.id),
  };
}

/** Get human-readable source label */
function getSourceLabel(source: ThreatSource): string {
  switch (source) {
    case "MITRE_ATTACK":
      return "MITRE ATT&CK";
    case "CWE":
      return "CWE";
    case "CAPEC":
      return "CAPEC";
    case "OWASP":
      return "OWASP";
    case "BUILT_IN":
      return "Built-in";
    case "CUSTOM":
      return "Custom";
    default:
      return source;
  }
}

/** Sort results by relevance */
function sortByRelevance(
  threats: CatalogThreat[],
  query: string,
): CatalogThreat[] {
  if (!query) {
    // No query - sort by severity
    return threats.sort(
      (a, b) => severityOrder(b.severity) - severityOrder(a.severity),
    );
  }

  return threats.sort((a, b) => {
    // Exact name match first
    const aNameMatch = a.name.toLowerCase().includes(query) ? 1 : 0;
    const bNameMatch = b.name.toLowerCase().includes(query) ? 1 : 0;
    if (aNameMatch !== bNameMatch) return bNameMatch - aNameMatch;

    // Built-in threats preferred
    const aBuiltIn = a.source === "BUILT_IN" ? 1 : 0;
    const bBuiltIn = b.source === "BUILT_IN" ? 1 : 0;
    if (aBuiltIn !== bBuiltIn) return bBuiltIn - aBuiltIn;

    // Then by severity
    return severityOrder(b.severity) - severityOrder(a.severity);
  });
}

function severityOrder(severity: Severity): number {
  switch (severity) {
    case "CRITICAL":
      return 4;
    case "HIGH":
      return 3;
    case "MEDIUM":
      return 2;
    case "LOW":
      return 1;
    default:
      return 0;
  }
}

/** Get all unique tags from the catalog */
export function getAllTags(): string[] {
  const tagSet = new Set<string>();

  // Built-in tags
  builtInThreats.forEach((t) => t.tags?.forEach((tag) => tagSet.add(tag)));

  // Index tags
  [...mitreAttackIndex, ...cweIndex, ...capecIndex].forEach((e) =>
    e.tags.forEach((tag) => tagSet.add(tag)),
  );

  return Array.from(tagSet).sort();
}

/** Get threats applicable to a specific component type */
export function getThreatsForComponent(
  componentType: ComponentType,
): CatalogThreat[] {
  return builtInThreats.filter(
    (t) =>
      t.applicableTo.length === 0 || t.applicableTo.includes(componentType),
  );
}

/** Get catalog statistics */
export function getCatalogStats(): {
  builtIn: number;
  mitre: number;
  cwe: number;
  capec: number;
  total: number;
} {
  return {
    builtIn: builtInThreats.length,
    mitre: mitreAttackIndex.length,
    cwe: cweIndex.length,
    capec: capecIndex.length,
    total:
      builtInThreats.length +
      mitreAttackIndex.length +
      cweIndex.length +
      capecIndex.length,
  };
}

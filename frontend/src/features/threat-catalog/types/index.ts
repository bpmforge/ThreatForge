/**
 * Threat Catalog Types
 *
 * Federated search across built-in library and external sources.
 */

import type { StrideCategory, Severity, ComponentType } from "@/types/canvas";

/** Source of a threat in the catalog */
export type ThreatSource =
  | "BUILT_IN" // Our curated library (~80)
  | "MITRE_ATTACK" // MITRE ATT&CK techniques
  | "CWE" // Common Weakness Enumeration
  | "CAPEC" // Common Attack Pattern Enumeration
  | "OWASP" // OWASP categories
  | "CUSTOM"; // User's org library

/** A threat from any source in the catalog */
export interface CatalogThreat {
  /** Unique ID (source-prefixed, e.g., "MITRE-T1190") */
  id: string;
  /** Source of this threat */
  source: ThreatSource;
  /** Display name */
  name: string;
  /** Full description */
  description: string;
  /** STRIDE mappings - threats can span multiple categories */
  strideCategories: StrideCategory[];
  /** Suggested severity */
  severity: Severity;
  /** Applicable component types (empty = all) */
  applicableTo: ComponentType[];
  /** Attack scenarios/techniques */
  attackScenarios?: string[];
  /** Suggested mitigations */
  mitigations?: string[];
  /** External reference IDs */
  references?: CatalogReference[];
  /** Tags for filtering */
  tags?: string[];
  /** URL to external documentation */
  externalUrl?: string;
}

/** Reference to external knowledge base */
export interface CatalogReference {
  source: "CWE" | "CVE" | "CAPEC" | "MITRE" | "OWASP" | "NIST" | "OTHER";
  id: string;
  url?: string;
}

/** Search filters for catalog */
export interface CatalogFilters {
  /** Free-text search */
  query: string;
  /** Filter by source */
  sources: ThreatSource[];
  /** Filter by STRIDE category */
  strideCategories: StrideCategory[];
  /** Filter by applicable component type */
  componentTypes: ComponentType[];
  /** Filter by severity */
  severities: Severity[];
  /** Filter by tags */
  tags: string[];
}

/** Search result with pagination */
export interface CatalogSearchResult {
  threats: CatalogThreat[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

/** Index entry for external sources (lightweight for search) */
export interface ThreatIndexEntry {
  id: string;
  name: string;
  keywords: string[];
  strideCategories: StrideCategory[];
  severity: Severity;
  tags: string[];
}

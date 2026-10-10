/**
 * Threat Catalog API Service
 * Client-side API calls for threat catalog operations.
 */

import { apiGet } from "@/lib/api-client";

const API_BASE = "/api/threat-catalog";

export interface CatalogStats {
  builtIn: {
    total: number;
    bySource: Record<string, number>;
    byCategory: Record<string, number>;
  };
  cwe: {
    total: number;
    byCategory: Record<string, number>;
    lastUpdated: string;
    version: string;
  };
  indexes: {
    mitreAttack: { total: number; lastUpdated: string; version: string };
    cweIndex: { total: number; lastUpdated: string; version: string };
    capec: { total: number; lastUpdated: string; version: string };
  };
  totalSearchable: number;
  totalWithIndexes: number;
}

/**
 * Get catalog stats via API
 */
export async function getCatalogStatsAPI(): Promise<CatalogStats> {
  // Served by the Next.js route in app/api/threat-catalog, not the backend.
  return apiGet<CatalogStats>(`${API_BASE}/stats`, { sameOrigin: true });
}

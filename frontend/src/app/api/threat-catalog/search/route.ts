/**
 * Threat Catalog Search API
 * Searches across local CWE database and optionally external sources.
 */
import { NextRequest, NextResponse } from "next/server";
import { searchCWEs } from "@/features/threat-catalog/data/cwe-database";
import type {
  CatalogThreat,
  ThreatSource,
} from "@/features/threat-catalog/types";

interface SearchRequest {
  query: string;
  sources?: ThreatSource[];
  maxResults?: number;
}

interface SearchResponse {
  results: CatalogThreat[];
  total: number;
  sources: {
    source: ThreatSource;
    count: number;
    searchedAt: string;
  }[];
}

export async function POST(request: NextRequest) {
  try {
    const body: SearchRequest = await request.json();
    const { query, sources = ["CWE"], maxResults = 50 } = body;

    if (!query || query.length < 2) {
      return NextResponse.json(
        { error: "Query must be at least 2 characters" },
        { status: 400 },
      );
    }

    const results: CatalogThreat[] = [];
    const sourceStats: SearchResponse["sources"] = [];

    // Search CWE database
    if (sources.includes("CWE")) {
      const cweResults = searchCWEs(query, maxResults);
      const threats: CatalogThreat[] = cweResults.map((cwe) => ({
        id: `CWE-API-${cwe.id}`,
        source: "CWE" as ThreatSource,
        name: `${cwe.id}: ${cwe.name}`,
        description: cwe.description,
        strideCategories: cwe.strideCategories,
        severity: cwe.severity,
        applicableTo: [],
        tags: [cwe.category.toLowerCase().replace(/-/g, " "), "cwe"],
        references: [{ source: "CWE" as const, id: cwe.id, url: cwe.cweUrl }],
        externalUrl: cwe.cweUrl,
      }));

      results.push(...threats);
      sourceStats.push({
        source: "CWE",
        count: threats.length,
        searchedAt: new Date().toISOString(),
      });
    }

    // Future: Add MITRE ATT&CK search via their API
    // Future: Add CAPEC search

    const response: SearchResponse = {
      results: results.slice(0, maxResults),
      total: results.length,
      sources: sourceStats,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Threat catalog search failed:", error);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") || "";
  const maxResults = parseInt(searchParams.get("limit") || "50", 10);

  if (!query || query.length < 2) {
    return NextResponse.json(
      { error: 'Query parameter "q" must be at least 2 characters' },
      { status: 400 },
    );
  }

  const cweResults = searchCWEs(query, maxResults);
  const threats: CatalogThreat[] = cweResults.map((cwe) => ({
    id: `CWE-API-${cwe.id}`,
    source: "CWE" as ThreatSource,
    name: `${cwe.id}: ${cwe.name}`,
    description: cwe.description,
    strideCategories: cwe.strideCategories,
    severity: cwe.severity,
    applicableTo: [],
    tags: [cwe.category.toLowerCase().replace(/-/g, " "), "cwe"],
    references: [{ source: "CWE" as const, id: cwe.id, url: cwe.cweUrl }],
    externalUrl: cwe.cweUrl,
  }));

  return NextResponse.json({
    results: threats,
    total: threats.length,
    source: "CWE",
  });
}

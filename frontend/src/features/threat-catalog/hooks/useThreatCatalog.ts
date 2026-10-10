/**
 * Threat Catalog Hook
 *
 * Provides search and filtering for the unified threat catalog.
 */
import { useState, useMemo, useCallback } from "react";
import type {
  CatalogFilters,
  CatalogSearchResult,
  CatalogThreat,
  ThreatSource,
} from "../types";
import type { StrideCategory, Severity, ComponentType } from "@/types/canvas";
import {
  searchCatalog,
  getAllTags,
  getCatalogStats,
  getThreatsForComponent,
} from "../services/catalog-search";
import { deepSearch, getExpandedCWECount } from "../services/deep-search";

const DEFAULT_FILTERS: CatalogFilters = {
  query: "",
  sources: [],
  strideCategories: [],
  componentTypes: [],
  severities: [],
  tags: [],
};

export function useThreatCatalog(initialComponentType?: ComponentType) {
  const [filters, setFilters] = useState<CatalogFilters>({
    ...DEFAULT_FILTERS,
    componentTypes: initialComponentType ? [initialComponentType] : [],
  });
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);

  // Deep search state
  const [isDeepSearching, setIsDeepSearching] = useState(false);
  const [deepSearchResults, setDeepSearchResults] = useState<CatalogThreat[]>(
    [],
  );
  const [deepSearchEnabled, setDeepSearchEnabled] = useState(false);

  // Memoized search results
  const searchResult = useMemo<CatalogSearchResult>(() => {
    return searchCatalog(filters, page, pageSize);
  }, [filters, page, pageSize]);

  // Available tags
  const availableTags = useMemo(() => getAllTags(), []);

  // Catalog stats
  const stats = useMemo(() => getCatalogStats(), []);

  // Filter setters
  const setQuery = useCallback((query: string) => {
    setFilters((prev) => ({ ...prev, query }));
    setPage(1);
  }, []);

  const setSources = useCallback((sources: ThreatSource[]) => {
    setFilters((prev) => ({ ...prev, sources }));
    setPage(1);
  }, []);

  const setStrideCategories = useCallback(
    (strideCategories: StrideCategory[]) => {
      setFilters((prev) => ({ ...prev, strideCategories }));
      setPage(1);
    },
    [],
  );

  const setComponentTypes = useCallback((componentTypes: ComponentType[]) => {
    setFilters((prev) => ({ ...prev, componentTypes }));
    setPage(1);
  }, []);

  const setSeverities = useCallback((severities: Severity[]) => {
    setFilters((prev) => ({ ...prev, severities }));
    setPage(1);
  }, []);

  const setTags = useCallback((tags: string[]) => {
    setFilters((prev) => ({ ...prev, tags }));
    setPage(1);
  }, []);

  const toggleSource = useCallback((source: ThreatSource) => {
    setFilters((prev) => {
      const sources = prev.sources.includes(source)
        ? prev.sources.filter((s) => s !== source)
        : [...prev.sources, source];
      return { ...prev, sources };
    });
    setPage(1);
  }, []);

  const toggleCategory = useCallback((category: StrideCategory) => {
    setFilters((prev) => {
      const strideCategories = prev.strideCategories.includes(category)
        ? prev.strideCategories.filter((c) => c !== category)
        : [...prev.strideCategories, category];
      return { ...prev, strideCategories };
    });
    setPage(1);
  }, []);

  const toggleSeverity = useCallback((severity: Severity) => {
    setFilters((prev) => {
      const severities = prev.severities.includes(severity)
        ? prev.severities.filter((s) => s !== severity)
        : [...prev.severities, severity];
      return { ...prev, severities };
    });
    setPage(1);
  }, []);

  const toggleTag = useCallback((tag: string) => {
    setFilters((prev) => {
      const tags = prev.tags.includes(tag)
        ? prev.tags.filter((t) => t !== tag)
        : [...prev.tags, tag];
      return { ...prev, tags };
    });
    setPage(1);
  }, []);

  const resetFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
    setPage(1);
  }, []);

  const nextPage = useCallback(() => {
    if (searchResult.hasMore) {
      setPage((p) => p + 1);
    }
  }, [searchResult.hasMore]);

  const prevPage = useCallback(() => {
    if (page > 1) {
      setPage((p) => p - 1);
    }
  }, [page]);

  // Get suggestions for a component
  const getSuggestions = useCallback(
    (componentType: ComponentType): CatalogThreat[] => {
      return getThreatsForComponent(componentType);
    },
    [],
  );

  // Trigger deep search
  const runDeepSearch = useCallback(async () => {
    if (!filters.query || filters.query.length < 2) return;

    setIsDeepSearching(true);
    try {
      const results = await deepSearch({
        query: filters.query,
        sources: ["CWE", "MITRE_ATTACK"],
        maxResults: 50,
      });

      // Combine all deep search results
      const allThreats = results.flatMap((r) => r.threats);
      setDeepSearchResults(allThreats);
      setDeepSearchEnabled(true);
    } catch (error) {
      console.error("Deep search failed:", error);
    } finally {
      setIsDeepSearching(false);
    }
  }, [filters.query]);

  // Clear deep search results
  const clearDeepSearch = useCallback(() => {
    setDeepSearchResults([]);
    setDeepSearchEnabled(false);
  }, []);

  // Combined results (local + deep search if enabled)
  const combinedThreats = useMemo(() => {
    if (!deepSearchEnabled || deepSearchResults.length === 0) {
      return searchResult.threats;
    }
    // Merge and dedupe by ID
    const seen = new Set(searchResult.threats.map((t) => t.id));
    const newThreats = deepSearchResults.filter((t) => !seen.has(t.id));
    return [...searchResult.threats, ...newThreats];
  }, [searchResult.threats, deepSearchResults, deepSearchEnabled]);

  // Extended stats including expanded CWE
  const extendedStats = useMemo(
    () => ({
      ...stats,
      expandedCwe: getExpandedCWECount(),
      totalSearchable: stats.total + getExpandedCWECount(),
    }),
    [stats],
  );

  return {
    // Results
    threats: combinedThreats,
    total: deepSearchEnabled ? combinedThreats.length : searchResult.total,
    hasMore: searchResult.hasMore && !deepSearchEnabled,
    page,
    pageSize,

    // Filters
    filters,
    availableTags,
    stats: extendedStats,

    // Filter actions
    setQuery,
    setSources,
    setStrideCategories,
    setComponentTypes,
    setSeverities,
    setTags,
    toggleSource,
    toggleCategory,
    toggleSeverity,
    toggleTag,
    resetFilters,

    // Pagination
    nextPage,
    prevPage,
    setPage,

    // Deep search
    isDeepSearching,
    deepSearchEnabled,
    runDeepSearch,
    clearDeepSearch,

    // Helpers
    getSuggestions,
  };
}

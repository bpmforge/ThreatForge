/**
 * Hook for filtering and searching the threat library.
 */
import { useState, useMemo, useCallback } from "react";
import type { StrideCategory, ComponentType } from "@/types/canvas";
import type { LibraryThreat, LibraryFilters } from "../types";
import { allThreats } from "../data";

export function useThreatLibrary(componentType?: ComponentType) {
  const [filters, setFilters] = useState<LibraryFilters>({
    search: "",
    category: "ALL",
    componentType: componentType || "ALL",
  });

  const setSearch = useCallback((search: string) => {
    setFilters((prev) => ({ ...prev, search }));
  }, []);

  const setCategory = useCallback((category: StrideCategory | "ALL") => {
    setFilters((prev) => ({ ...prev, category }));
  }, []);

  const setComponentTypeFilter = useCallback((type: ComponentType | "ALL") => {
    setFilters((prev) => ({ ...prev, componentType: type }));
  }, []);

  const filteredThreats = useMemo(() => {
    return allThreats.filter((threat) => {
      // Filter by search
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const matchesSearch =
          threat.name.toLowerCase().includes(searchLower) ||
          threat.description.toLowerCase().includes(searchLower);
        if (!matchesSearch) return false;
      }

      // Filter by category - match if threat has any of the selected categories
      if (
        filters.category !== "ALL" &&
        !threat.strideCategories.includes(filters.category)
      ) {
        return false;
      }

      // Filter by component type
      if (filters.componentType !== "ALL") {
        if (!threat.applicableTo.includes(filters.componentType)) {
          return false;
        }
      }

      return true;
    });
  }, [filters]);

  const groupedThreats = useMemo(() => {
    const groups: Record<StrideCategory, LibraryThreat[]> = {
      SPOOFING: [],
      TAMPERING: [],
      REPUDIATION: [],
      INFORMATION_DISCLOSURE: [],
      DENIAL_OF_SERVICE: [],
      ELEVATION_OF_PRIVILEGE: [],
    };

    // Threats with multiple categories appear in each matching group
    filteredThreats.forEach((threat) => {
      threat.strideCategories.forEach((cat) => {
        groups[cat].push(threat);
      });
    });

    return groups;
  }, [filteredThreats]);

  return {
    filters,
    setSearch,
    setCategory,
    setComponentTypeFilter,
    filteredThreats,
    groupedThreats,
    totalCount: allThreats.length,
    filteredCount: filteredThreats.length,
  };
}

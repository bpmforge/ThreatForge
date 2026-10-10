"use client";

/**
 * usePaletteFilters - Search and cloud provider filtering logic for the palette.
 */

import { useState, useMemo } from "react";
import { categories } from "../data/categories";
import type { CloudFilter } from "../components/CloudProviderFilter";
import type { PaletteItem } from "../types";

/** Cloud provider prefixes for category filtering */
const CLOUD_PREFIXES: Record<Exclude<CloudFilter, "none" | "all">, string> = {
  aws: "aws-",
  gcp: "gcp-",
  azure: "azure-",
};

/** Check if a category ID belongs to any cloud provider */
function isCloudCategory(id: string): boolean {
  return (
    id.startsWith("aws-") || id.startsWith("gcp-") || id.startsWith("azure-")
  );
}

/** Match an item against a search query */
function matchesQuery(item: PaletteItem, query: string): boolean {
  return (
    item.label.toLowerCase().includes(query) ||
    item.description.toLowerCase().includes(query) ||
    item.type.toLowerCase().includes(query)
  );
}

export function usePaletteFilters() {
  const [searchQuery, setSearchQuery] = useState("");
  const [cloudFilter, setCloudFilter] = useState<CloudFilter>("none");

  const visibleCategories = useMemo(() => {
    if (cloudFilter === "all") return categories;
    if (cloudFilter === "none") {
      return categories.filter((cat) => !isCloudCategory(cat.id));
    }
    const prefix = CLOUD_PREFIXES[cloudFilter];
    return categories.filter(
      (cat) => !isCloudCategory(cat.id) || cat.id.startsWith(prefix),
    );
  }, [cloudFilter]);

  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return null;
    const query = searchQuery.toLowerCase();
    return categories
      .flatMap((cat) => cat.items)
      .filter((item) => matchesQuery(item, query));
  }, [searchQuery]);

  const categoryMatchCounts = useMemo(() => {
    if (!searchQuery.trim()) return {};
    const query = searchQuery.toLowerCase();
    const counts: Record<string, number> = {};
    categories.forEach((cat) => {
      counts[cat.id] = cat.items.filter((item) =>
        matchesQuery(item, query),
      ).length;
    });
    return counts;
  }, [searchQuery]);

  const isSearching = searchQuery.trim().length > 0;

  return {
    searchQuery,
    setSearchQuery,
    cloudFilter,
    setCloudFilter,
    visibleCategories,
    filteredItems,
    categoryMatchCounts,
    isSearching,
  };
}

/**
 * useThreatFilters - Filtering and grouping logic for ThreatPanel.
 */
import { useState, useMemo } from "react";
import type { Threat } from "../types";
import type { Node } from "@xyflow/react";

type ThreatFilter = "all" | "general" | "component";

interface UseThreatFiltersOptions {
  threats: Threat[];
  selectedNode: Node | null;
}

export function useThreatFilters({
  threats,
  selectedNode,
}: UseThreatFiltersOptions) {
  const [filter, setFilter] = useState<ThreatFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [groupByCategory, setGroupByCategory] = useState(false);

  const generalThreatsCount = useMemo(
    () =>
      threats.filter((t) => !t.componentNodeId && !t.connectionEdgeId).length,
    [threats],
  );

  const componentThreatsCount = useMemo(
    () => threats.filter((t) => t.componentNodeId || t.connectionEdgeId).length,
    [threats],
  );

  const uniqueCategories = useMemo(() => {
    const categories = new Set<string>();
    threats.forEach((t) => {
      if (t.category) categories.add(t.category);
    });
    return Array.from(categories).sort();
  }, [threats]);

  const categoryCountMap = useMemo(() => {
    const counts: Record<string, number> = { uncategorized: 0 };
    threats.forEach((t) => {
      const cat = t.category || "uncategorized";
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return counts;
  }, [threats]);

  const filteredThreats = useMemo(() => {
    let result = threats;
    if (filter === "general") {
      result = result.filter((t) => !t.componentNodeId && !t.connectionEdgeId);
    } else if (filter === "component") {
      if (selectedNode) {
        result = result.filter((t) => t.componentNodeId === selectedNode.id);
      } else {
        result = result.filter((t) => t.componentNodeId || t.connectionEdgeId);
      }
    } else if (selectedNode) {
      result = result.filter((t) => t.componentNodeId === selectedNode.id);
    }
    if (categoryFilter !== "all") {
      if (categoryFilter === "uncategorized") {
        result = result.filter((t) => !t.category);
      } else {
        result = result.filter((t) => t.category === categoryFilter);
      }
    }
    return result;
  }, [threats, filter, selectedNode, categoryFilter]);

  const groupedThreats = useMemo(() => {
    if (!groupByCategory) return null;
    const groups: Record<string, Threat[]> = {};
    filteredThreats.forEach((t) => {
      const cat = t.category || "Uncategorized";
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(t);
    });
    const sortedKeys = Object.keys(groups).sort((a, b) => {
      if (a === "Uncategorized") return 1;
      if (b === "Uncategorized") return -1;
      return a.localeCompare(b);
    });
    return sortedKeys.map((key) => ({ category: key, threats: groups[key] }));
  }, [filteredThreats, groupByCategory]);

  return {
    filter,
    setFilter,
    categoryFilter,
    setCategoryFilter,
    groupByCategory,
    setGroupByCategory,
    generalThreatsCount,
    componentThreatsCount,
    uniqueCategories,
    categoryCountMap,
    filteredThreats,
    groupedThreats,
  };
}

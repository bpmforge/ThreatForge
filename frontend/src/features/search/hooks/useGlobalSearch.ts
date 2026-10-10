import { SearchResult } from "../types";
import { useState, useMemo, useCallback, useEffect } from "react";
import { useCanvasStore } from "@/stores/canvas";
import type {
  ComponentNodeData,
  ThreatSummary,
  ConnectionData,
} from "@/types/canvas";

const LOCAL_STORAGE_KEY = "ftm-recent-searches";

interface UseGlobalSearchReturn {
  query: string;
  setQuery: (q: string) => void;
  results: SearchResult[];
  recentSearches: SearchResult[];
  isLoading: boolean;
  addToRecent: (result: SearchResult) => void;
  clearRecent: () => void;
}

export function useGlobalSearch(): UseGlobalSearchReturn {
  const [query, setQuery] = useState("");
  const [recentSearches, setRecentSearches] = useState<SearchResult[]>([]);
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);

  // Load recent searches from localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (stored) {
          setRecentSearches(JSON.parse(stored));
        }
      } catch {
        // Ignore parse errors
      }
    }
  }, []);

  const addToRecent = useCallback((result: SearchResult) => {
    setRecentSearches((prev) => {
      const filtered = prev.filter((r) => r.id !== result.id);
      const updated = [result, ...filtered].slice(0, 5);
      if (typeof window !== "undefined") {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
      }
      return updated;
    });
  }, []);

  const clearRecent = useCallback(() => {
    setRecentSearches([]);
    if (typeof window !== "undefined") {
      localStorage.removeItem(LOCAL_STORAGE_KEY);
    }
  }, []);

  const results = useMemo<SearchResult[]>(() => {
    if (query.length < 2) return [];

    const lowerQuery = query.toLowerCase();
    const searchResults: SearchResult[] = [];

    // Search components
    nodes.forEach((node) => {
      if (node.type === "boundary") return;

      const nodeData = node.data as ComponentNodeData;
      const label = nodeData.label || "";

      if (label.toLowerCase().includes(lowerQuery)) {
        searchResults.push({
          id: node.id,
          type: "component",
          name: label,
          description: nodeData.type || undefined,
        });
      }
    });

    // Search threats from nodes
    nodes.forEach((node) => {
      const nodeData = node.data as ComponentNodeData;
      const threats = nodeData.threats || [];

      threats.forEach((threat: ThreatSummary) => {
        if (threat.title.toLowerCase().includes(lowerQuery)) {
          searchResults.push({
            id: threat.id,
            type: "threat",
            name: threat.title,
            description: `${threat.severity} - ${threat.category} (${nodeData.label})`,
          });
        }
      });
    });

    // Search threats from edges (data flows)
    edges.forEach((edge) => {
      const edgeData = edge.data as ConnectionData | undefined;
      const threats = edgeData?.threats || [];

      threats.forEach((threat: ThreatSummary) => {
        if (threat.title.toLowerCase().includes(lowerQuery)) {
          searchResults.push({
            id: threat.id,
            type: "threat",
            name: threat.title,
            description: `${threat.severity} - ${threat.category} (Data Flow)`,
          });
        }
      });
    });

    return searchResults;
  }, [query, nodes, edges]);

  return {
    query,
    setQuery,
    results,
    recentSearches,
    isLoading: false,
    addToRecent,
    clearRecent,
  };
}

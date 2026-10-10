import { useState, useMemo } from "react";
import { toast } from "sonner";
import {
  useThreatLibraries,
  allThreats,
  threatsBySource,
  type LibraryThreat,
} from "@/features/threat-library";
import { getCatalogStats } from "@/features/threat-catalog";
import type { Severity } from "@/types/canvas";
import type { CatalogThreat } from "@/features/threat-catalog";

type ThreatSource = "ALL" | "STRIDE" | "OWASP" | "CLOUD" | "LINDDUN";

export function useThreatLibraryPage() {
  const [showManager, setShowManager] = useState(false);
  const [showCatalog, setShowCatalog] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [search, setSearch] = useState("");
  const [severityFilter, setSeverityFilter] = useState<Severity | "ALL">("ALL");
  const [sourceFilter, setSourceFilter] = useState<ThreatSource>("ALL");
  const [activeTab, setActiveTab] = useState("sources");
  const [customThreats, setCustomThreats] = useState<CatalogThreat[]>([]);

  const { data: librariesData } = useThreatLibraries();
  const libraries = Array.isArray(librariesData) ? librariesData : [];

  const catalogStats = useMemo(() => getCatalogStats(), []);

  const filterThreats = useMemo(() => {
    return (threats: LibraryThreat[]) =>
      threats.filter((t) => {
        const matchesSearch =
          !search ||
          t.name.toLowerCase().includes(search.toLowerCase()) ||
          t.description.toLowerCase().includes(search.toLowerCase());
        const matchesSeverity =
          severityFilter === "ALL" || t.defaultSeverity === severityFilter;
        return matchesSearch && matchesSeverity;
      });
  }, [search, severityFilter]);

  const getSourceThreats = (source: Exclude<ThreatSource, "ALL">) => {
    const key = source.toLowerCase() as keyof typeof threatsBySource;
    return filterThreats(threatsBySource[key] ?? []);
  };

  const filteredThreats = useMemo(() => {
    const base =
      sourceFilter === "ALL"
        ? allThreats
        : (threatsBySource[
            sourceFilter.toLowerCase() as keyof typeof threatsBySource
          ] ?? []);
    return filterThreats(base);
  }, [filterThreats, sourceFilter]);

  const severityCounts = useMemo(
    () =>
      filteredThreats.reduce(
        (acc, t) => {
          acc[t.defaultSeverity] = (acc[t.defaultSeverity] || 0) + 1;
          return acc;
        },
        {} as Record<Severity, number>,
      ),
    [filteredThreats],
  );

  const handleSelectThreat = (threat: LibraryThreat) => {
    toast.info(`Selected: ${threat.name}`, {
      description: "Add this threat to a component from the canvas.",
    });
  };

  const handleAddCatalogThreat = (threat: CatalogThreat) => {
    toast.success(`Added: ${threat.name}`, {
      description:
        "Threat added from catalog. Apply it to components from the canvas.",
    });
  };

  const handleImportCustom = (threats: CatalogThreat[], sourceName: string) => {
    setCustomThreats((prev) => [...prev, ...threats]);
    toast.success(`Imported ${threats.length} threats from "${sourceName}"`);
  };

  return {
    showManager,
    setShowManager,
    showCatalog,
    setShowCatalog,
    showImport,
    setShowImport,
    search,
    setSearch,
    severityFilter,
    setSeverityFilter,
    sourceFilter,
    setSourceFilter,
    activeTab,
    setActiveTab,
    customThreats,
    libraries,
    catalogStats,
    filteredThreats,
    severityCounts,
    getSourceThreats,
    handleSelectThreat,
    handleAddCatalogThreat,
    handleImportCustom,
  };
}

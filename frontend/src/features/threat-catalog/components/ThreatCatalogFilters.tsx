"use client";

/**
 * ThreatCatalogFilters - Filter controls for the threat catalog.
 */
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { X, Search, Filter } from "lucide-react";
import type { CatalogFilters, ThreatSource } from "../types";
import type { StrideCategory, Severity } from "@/types/canvas";

interface ThreatCatalogFiltersProps {
  filters: CatalogFilters;
  onQueryChange: (query: string) => void;
  onToggleSource: (source: ThreatSource) => void;
  onToggleCategory: (category: StrideCategory) => void;
  onToggleSeverity: (severity: Severity) => void;
  onReset: () => void;
  stats: { builtIn: number; mitre: number; cwe: number; capec: number };
}

const SOURCES: {
  value: ThreatSource;
  label: string;
  count: keyof typeof _stats;
}[] = [
  { value: "BUILT_IN", label: "Built-in", count: "builtIn" },
  { value: "MITRE_ATTACK", label: "MITRE ATT&CK", count: "mitre" },
  { value: "CWE", label: "CWE", count: "cwe" },
  { value: "CAPEC", label: "CAPEC", count: "capec" },
];

const STRIDE_CATEGORIES: {
  value: StrideCategory;
  label: string;
  color: string;
}[] = [
  {
    value: "SPOOFING",
    label: "S",
    color: "bg-red-100 text-red-700 hover:bg-red-200",
  },
  {
    value: "TAMPERING",
    label: "T",
    color: "bg-orange-100 text-orange-700 hover:bg-orange-200",
  },
  {
    value: "REPUDIATION",
    label: "R",
    color: "bg-yellow-100 text-yellow-700 hover:bg-yellow-200",
  },
  {
    value: "INFORMATION_DISCLOSURE",
    label: "I",
    color: "bg-blue-100 text-blue-700 hover:bg-blue-200",
  },
  {
    value: "DENIAL_OF_SERVICE",
    label: "D",
    color: "bg-purple-100 text-purple-700 hover:bg-purple-200",
  },
  {
    value: "ELEVATION_OF_PRIVILEGE",
    label: "E",
    color: "bg-pink-100 text-pink-700 hover:bg-pink-200",
  },
];

const SEVERITIES: { value: Severity; label: string; color: string }[] = [
  {
    value: "CRITICAL",
    label: "Critical",
    color: "bg-red-500 text-white hover:bg-red-600",
  },
  {
    value: "HIGH",
    label: "High",
    color: "bg-orange-500 text-white hover:bg-orange-600",
  },
  {
    value: "MEDIUM",
    label: "Medium",
    color: "bg-yellow-500 text-white hover:bg-yellow-600",
  },
  {
    value: "LOW",
    label: "Low",
    color: "bg-green-500 text-white hover:bg-green-600",
  },
];

// Reference the stats type for source count lookup
const _stats = { builtIn: 0, mitre: 0, cwe: 0, capec: 0 };

export function ThreatCatalogFilters({
  filters,
  onQueryChange,
  onToggleSource,
  onToggleCategory,
  onToggleSeverity,
  onReset,
  stats: catalogStats,
}: ThreatCatalogFiltersProps) {
  const hasFilters =
    filters.query ||
    filters.sources.length > 0 ||
    filters.strideCategories.length > 0 ||
    filters.severities.length > 0;

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search threats..."
          value={filters.query}
          onChange={(e) => onQueryChange(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Source filters */}
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground flex items-center gap-1">
          <Filter className="h-3 w-3" />
          Sources
        </Label>
        <div className="flex flex-wrap gap-1">
          {SOURCES.map((source) => {
            const isActive = filters.sources.includes(source.value);
            const count = catalogStats[source.count];
            return (
              <Badge
                key={source.value}
                variant={isActive ? "default" : "outline"}
                className="cursor-pointer text-xs"
                onClick={() => onToggleSource(source.value)}
              >
                {source.label}
                <span className="ml-1 opacity-60">({count})</span>
              </Badge>
            );
          })}
        </div>
      </div>

      {/* STRIDE filters */}
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">STRIDE Category</Label>
        <div className="flex gap-1">
          {STRIDE_CATEGORIES.map((cat) => {
            const isActive = filters.strideCategories.includes(cat.value);
            return (
              <Badge
                key={cat.value}
                variant="outline"
                className={`cursor-pointer w-7 h-7 p-0 flex items-center justify-center font-bold ${
                  isActive ? cat.color : "opacity-50 hover:opacity-100"
                }`}
                onClick={() => onToggleCategory(cat.value)}
                title={cat.value.replace("_", " ")}
              >
                {cat.label}
              </Badge>
            );
          })}
        </div>
      </div>

      {/* Severity filters */}
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Severity</Label>
        <div className="flex flex-wrap gap-1">
          {SEVERITIES.map((sev) => {
            const isActive = filters.severities.includes(sev.value);
            return (
              <Badge
                key={sev.value}
                variant="outline"
                className={`cursor-pointer text-xs ${
                  isActive ? sev.color : "opacity-50 hover:opacity-100"
                }`}
                onClick={() => onToggleSeverity(sev.value)}
              >
                {sev.label}
              </Badge>
            );
          })}
        </div>
      </div>

      {/* Reset */}
      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onReset}
          className="w-full text-muted-foreground"
        >
          <X className="h-3 w-3 mr-1" />
          Clear filters
        </Button>
      )}
    </div>
  );
}

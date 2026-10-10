"use client";

/**
 * ThreatLibraryBrowser - Main UI for browsing and selecting library threats.
 */
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import type { ComponentType } from "@/types/canvas";
import type { LibraryThreat } from "../types";
import { useThreatLibrary } from "../hooks/useThreatLibrary";
import { ThreatLibraryFilters } from "./ThreatLibraryFilters";
import { ThreatLibraryItem } from "./ThreatLibraryItem";
import { STRIDE_FULL_NAMES } from "../constants";

interface ThreatLibraryBrowserProps {
  componentType?: ComponentType;
  onSelectThreat: (threat: LibraryThreat) => void;
  maxHeight?: string;
}

export function ThreatLibraryBrowser({
  componentType,
  onSelectThreat,
  maxHeight = "400px",
}: ThreatLibraryBrowserProps) {
  const {
    filters,
    setSearch,
    setCategory,
    groupedThreats,
    filteredCount,
    totalCount,
  } = useThreatLibrary(componentType);

  const nonEmptyCategories = Object.entries(groupedThreats).filter(
    ([, threats]) => threats.length > 0,
  );

  return (
    <div className="flex flex-col">
      <ThreatLibraryFilters
        search={filters.search}
        category={filters.category}
        filteredCount={filteredCount}
        totalCount={totalCount}
        onSearchChange={setSearch}
        onCategoryChange={setCategory}
      />
      <Separator className="my-3" />
      <ScrollArea style={{ maxHeight }} className="pr-2">
        {nonEmptyCategories.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No threats match your filters
          </p>
        ) : (
          <div className="space-y-4">
            {nonEmptyCategories.map(([category, threats]) => (
              <div key={category}>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  {
                    STRIDE_FULL_NAMES[
                      category as keyof typeof STRIDE_FULL_NAMES
                    ]
                  }{" "}
                  ({threats.length})
                </h3>
                <div className="space-y-2">
                  {threats.map((threat) => (
                    <ThreatLibraryItem
                      key={threat.id}
                      threat={threat}
                      onSelect={onSelectThreat}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

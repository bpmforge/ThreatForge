"use client";

/**
 * ComponentPalette - Main component palette entry point.
 *
 * Features:
 * - Recently used components (top, from localStorage)
 * - Cloud provider filter (Core | All | AWS | GCP | Azure)
 * - Search functionality with live filtering
 * - Collapsible category sections
 * - Cloud provider components (AWS, GCP, Azure)
 */

import { Search, Square } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import {
  CollapsibleSection,
  PaletteItemComponent,
  BoundaryItem,
  SearchResults,
  CloudProviderFilter,
  RecentlyUsed,
} from "./components";
import { useRecentComponents } from "./hooks/useRecentComponents";
import { usePaletteFilters } from "./hooks/usePaletteFilters";

function isCloudCategory(id: string): boolean {
  return (
    id.startsWith("aws-") || id.startsWith("gcp-") || id.startsWith("azure-")
  );
}

export function ComponentPalette() {
  const { recentTypes } = useRecentComponents();
  const {
    searchQuery,
    setSearchQuery,
    cloudFilter,
    setCloudFilter,
    visibleCategories,
    filteredItems,
    categoryMatchCounts,
    isSearching,
  } = usePaletteFilters();

  return (
    <div className="w-full h-full bg-background flex flex-col overflow-hidden">
      {/* Title */}
      <div className="px-3 pt-3 pb-1 shrink-0">
        <h2 className="font-semibold text-foreground text-sm">Components</h2>
        <p className="text-xs text-muted-foreground mt-0.5">Drag to canvas</p>
      </div>

      {/* Cloud Provider Filter — underline tabs */}
      <CloudProviderFilter value={cloudFilter} onChange={setCloudFilter} />

      {/* Search Input */}
      <div className="px-3 py-2 shrink-0">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search components..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 pl-8 text-sm"
            aria-label="Search components"
          />
        </div>
      </div>

      {/* Scrollable palette */}
      <ScrollArea
        id="palette-content"
        className="flex-1 min-h-0"
        role="tabpanel"
      >
        {isSearching && filteredItems ? (
          <SearchResults items={filteredItems} query={searchQuery} />
        ) : (
          <div className="p-2 space-y-1">
            {/* Recently Used — only show on Core/All */}
            {(cloudFilter === "none" || cloudFilter === "all") && (
              <RecentlyUsed recentTypes={recentTypes} />
            )}

            {/* Trust Boundaries — only show on Core/All */}
            {(cloudFilter === "none" || cloudFilter === "all") && (
              <CollapsibleSection
                title="Boundaries"
                Icon={Square}
                color="text-blue-500"
                defaultOpen={cloudFilter === "none"}
              >
                <BoundaryItem />
              </CollapsibleSection>
            )}

            {/* Filtered Categories */}
            {visibleCategories.map((category) => {
              const isCloudy = isCloudCategory(category.id);
              const shouldOpen =
                cloudFilter === "none"
                  ? category.defaultOpen
                  : cloudFilter === "all"
                    ? category.defaultOpen
                    : isCloudy;

              return (
                <CollapsibleSection
                  key={`${category.id}-${cloudFilter}`}
                  title={category.title}
                  Icon={category.Icon}
                  color={category.color}
                  defaultOpen={shouldOpen}
                  matchCount={categoryMatchCounts[category.id]}
                >
                  <div className="space-y-0.5">
                    {category.items.map((item) => (
                      <PaletteItemComponent key={item.type} item={item} />
                    ))}
                  </div>
                </CollapsibleSection>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

// Re-export types and components

"use client";

/**
 * ThreatCatalogDialog - Main dialog for browsing and adding threats from the catalog.
 */
import { useCallback, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  ChevronLeft,
  ChevronRight,
  BookOpen,
  Library,
  Zap,
  Loader2,
  X,
} from "lucide-react";
import { useThreatCatalog } from "../hooks/useThreatCatalog";
import { ThreatCatalogFilters } from "./ThreatCatalogFilters";
import { ThreatCatalogItem } from "./ThreatCatalogItem";
import type { CatalogThreat } from "../types";
import type { ComponentType } from "@/types/canvas";

interface ThreatCatalogDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddThreat: (threat: CatalogThreat) => void;
  componentType?: ComponentType;
  componentName?: string;
  addedThreatIds?: string[];
}

export function ThreatCatalogDialog({
  open,
  onOpenChange,
  onAddThreat,
  componentType,
  componentName,
  addedThreatIds = [],
}: ThreatCatalogDialogProps) {
  const {
    threats,
    total,
    hasMore,
    page,
    filters,
    stats,
    setQuery,
    toggleSource,
    toggleCategory,
    toggleSeverity,
    resetFilters,
    nextPage,
    prevPage,
    isDeepSearching,
    deepSearchEnabled,
    runDeepSearch,
    clearDeepSearch,
  } = useThreatCatalog(componentType);

  const [addedIds, setAddedIds] = useState<Set<string>>(
    new Set(addedThreatIds),
  );

  const handleAdd = useCallback(
    (threat: CatalogThreat) => {
      onAddThreat(threat);
      setAddedIds((prev) => new Set([...prev, threat.id]));
    },
    [onAddThreat],
  );

  const startItem = (page - 1) * 20 + 1;
  const endItem = Math.min(page * 20, total);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Library className="h-5 w-5" />
            Threat Catalog
          </DialogTitle>
          <DialogDescription>
            {componentName ? (
              <>
                Search and add threats for <strong>{componentName}</strong>
              </>
            ) : (
              <>
                Browse threats from built-in library, MITRE ATT&CK, CWE, and
                CAPEC
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 flex gap-4 overflow-hidden">
          {/* Filters sidebar */}
          <div className="w-56 shrink-0">
            <ThreatCatalogFilters
              filters={filters}
              onQueryChange={setQuery}
              onToggleSource={toggleSource}
              onToggleCategory={toggleCategory}
              onToggleSeverity={toggleSeverity}
              onReset={resetFilters}
              stats={stats}
            />

            {/* Extended local search */}
            <div className="mt-4 p-3 bg-muted rounded-lg space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Zap className="h-4 w-4 text-yellow-500" />
                Extended Local Search
              </div>
              <p className="text-xs text-muted-foreground">
                Also search {stats.expandedCwe || 75}+ bundled CWE entries. Runs
                locally; no external databases are queried.
              </p>
              {deepSearchEnabled ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={clearDeepSearch}
                >
                  <X className="h-3 w-3 mr-1" />
                  Clear Extended Search
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={runDeepSearch}
                  disabled={
                    isDeepSearching ||
                    !filters.query ||
                    filters.query.length < 2
                  }
                >
                  {isDeepSearching ? (
                    <>
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      Searching...
                    </>
                  ) : (
                    <>
                      <Zap className="h-3 w-3 mr-1" />
                      Search All CWEs
                    </>
                  )}
                </Button>
              )}
              {filters.query && filters.query.length < 2 && (
                <p className="text-xs text-muted-foreground">
                  Enter 2+ characters to enable
                </p>
              )}
            </div>

            {/* Quick stats */}
            <div className="mt-4 p-3 bg-muted rounded-lg">
              <div className="flex items-center gap-2 text-sm font-medium mb-2">
                <BookOpen className="h-4 w-4" />
                Catalog Stats
              </div>
              <div className="text-xs text-muted-foreground space-y-1">
                <div className="flex justify-between">
                  <span>Local index:</span>
                  <span className="font-medium">{stats.total}</span>
                </div>
                <div className="flex justify-between">
                  <span>Extended CWE:</span>
                  <span className="font-medium">
                    {stats.expandedCwe || 75}+
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Built-in curated:</span>
                  <span className="font-medium">{stats.builtIn}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Results */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Results header */}
            <div className="flex items-center justify-between mb-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <span>
                  Showing {startItem}-{endItem} of {total} threats
                </span>
                {deepSearchEnabled && (
                  <Badge
                    variant="secondary"
                    className="text-xs bg-yellow-100 text-yellow-800"
                  >
                    <Zap className="h-3 w-3 mr-1" />
                    Extended Search Active
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  onClick={prevPage}
                  disabled={page === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="px-2 text-xs">Page {page}</span>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  onClick={nextPage}
                  disabled={!hasMore}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Threats list */}
            <ScrollArea className="flex-1 min-h-0">
              {threats.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
                  <BookOpen className="h-8 w-8 mb-2 opacity-50" />
                  <p className="text-sm">
                    No threats found matching your filters
                  </p>
                  <Button
                    variant="link"
                    size="sm"
                    onClick={resetFilters}
                    className="mt-2"
                  >
                    Clear filters
                  </Button>
                </div>
              ) : (
                <div className="space-y-2 pr-4">
                  {threats.map((threat) => (
                    <ThreatCatalogItem
                      key={threat.id}
                      threat={threat}
                      onAdd={handleAdd}
                      isAdded={addedIds.has(threat.id)}
                    />
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

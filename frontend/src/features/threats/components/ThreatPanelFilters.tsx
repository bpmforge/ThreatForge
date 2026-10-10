"use client";

/**
 * ThreatPanelFilters - Filter tabs and category filter for threat panel.
 */
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

type ThreatFilter = "all" | "general" | "component";

interface ThreatPanelFiltersProps {
  filter: ThreatFilter;
  onFilterChange: (filter: ThreatFilter) => void;
  totalCount: number;
  generalCount: number;
  componentCount: number;
  categoryFilter: string;
  onCategoryFilterChange: (category: string) => void;
  uniqueCategories: string[];
  categoryCountMap: Record<string, number>;
  groupByCategory: boolean;
  onGroupByCategoryChange: (grouped: boolean) => void;
  sinceLastSignOff: boolean;
  onSinceLastSignOffChange: (since: boolean) => void;
}

export function ThreatPanelFilters({
  filter,
  onFilterChange,
  totalCount,
  generalCount,
  componentCount,
  categoryFilter,
  onCategoryFilterChange,
  uniqueCategories,
  categoryCountMap,
  groupByCategory,
  onGroupByCategoryChange,
  sinceLastSignOff,
  onSinceLastSignOffChange,
}: ThreatPanelFiltersProps) {
  return (
    <div className="px-4 pt-2 border-b shrink-0">
      <Tabs
        value={filter}
        onValueChange={(v) => onFilterChange(v as ThreatFilter)}
      >
        <TabsList className="w-full h-8">
          <TabsTrigger value="all" className="flex-1 text-xs h-7">
            All ({totalCount})
          </TabsTrigger>
          <TabsTrigger value="general" className="flex-1 text-xs h-7">
            General ({generalCount})
          </TabsTrigger>
          <TabsTrigger value="component" className="flex-1 text-xs h-7">
            Component ({componentCount})
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* #61 delta view toggle — shows only changes since the last sign-off. */}
      <button
        onClick={() => onSinceLastSignOffChange(!sinceLastSignOff)}
        aria-pressed={sinceLastSignOff}
        aria-label={
          sinceLastSignOff
            ? "Show all threats"
            : "Show only changes since last sign-off"
        }
        className={`mt-2 w-full h-7 px-2 rounded text-xs border transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 ${
          sinceLastSignOff
            ? "bg-primary text-primary-foreground border-primary"
            : "bg-background text-muted-foreground hover:bg-muted"
        }`}
      >
        {sinceLastSignOff
          ? "Showing changes since last sign-off"
          : "Show changes since last sign-off"}
      </button>

      {/* Category filter - only show if there are categories */}
      {uniqueCategories.length > 0 && (
        <div className="flex items-center gap-2 mt-2 pb-2">
          <Label className="text-xs text-muted-foreground shrink-0">
            Category:
          </Label>
          <Select value={categoryFilter} onValueChange={onCategoryFilterChange}>
            <SelectTrigger className="h-7 text-xs flex-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {uniqueCategories.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {cat} ({categoryCountMap[cat] || 0})
                </SelectItem>
              ))}
              {categoryCountMap.uncategorized > 0 && (
                <SelectItem value="uncategorized">
                  Uncategorized ({categoryCountMap.uncategorized})
                </SelectItem>
              )}
            </SelectContent>
          </Select>
          <button
            onClick={() => onGroupByCategoryChange(!groupByCategory)}
            aria-pressed={groupByCategory}
            aria-label={
              groupByCategory
                ? "Disable group by category"
                : "Group by category"
            }
            className={`h-7 px-2 rounded text-xs border transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 ${
              groupByCategory
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background text-muted-foreground hover:bg-muted"
            }`}
          >
            Group
          </button>
        </div>
      )}
    </div>
  );
}

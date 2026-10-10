"use client";

/**
 * ThreatLibraryFilters - Search and filter controls for the threat library.
 */
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { StrideCategory } from "@/types/canvas";
import { STRIDE_CATEGORY_OPTIONS } from "../constants";

interface ThreatLibraryFiltersProps {
  search: string;
  category: StrideCategory | "ALL";
  filteredCount: number;
  totalCount: number;
  onSearchChange: (search: string) => void;
  onCategoryChange: (category: StrideCategory | "ALL") => void;
}

export function ThreatLibraryFilters({
  search,
  category,
  filteredCount,
  totalCount,
  onSearchChange,
  onCategoryChange,
}: ThreatLibraryFiltersProps) {
  return (
    <div className="space-y-3">
      <Input
        placeholder="Search threats..."
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        className="h-9"
      />
      <div className="flex items-center justify-between gap-2">
        <Select value={category} onValueChange={onCategoryChange}>
          <SelectTrigger className="h-8 text-xs flex-1">
            <SelectValue placeholder="Filter by category" />
          </SelectTrigger>
          <SelectContent>
            {STRIDE_CATEGORY_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {filteredCount} of {totalCount}
        </span>
      </div>
    </div>
  );
}

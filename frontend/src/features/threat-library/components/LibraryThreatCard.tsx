"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  SEVERITY_COLORS,
  STRIDE_SHORT_NAMES,
  type LibraryThreat,
} from "@/features/threat-library";
import type { StrideCategory } from "@/types/canvas";

const STRIDE_COLORS: Record<StrideCategory, string> = {
  SPOOFING:
    "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  TAMPERING:
    "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  REPUDIATION:
    "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  INFORMATION_DISCLOSURE:
    "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  DENIAL_OF_SERVICE:
    "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  ELEVATION_OF_PRIVILEGE:
    "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
};

interface LibraryThreatCardProps {
  threat: LibraryThreat;
  onSelect: (threat: LibraryThreat) => void;
  compact?: boolean;
}

export function LibraryThreatCard({
  threat,
  onSelect,
  compact = false,
}: LibraryThreatCardProps) {
  const maxCats = compact ? 2 : 3;

  return (
    <div
      className={`p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors ${
        compact ? "p-2" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="flex items-center gap-1 flex-wrap">
          {threat.strideCategories.slice(0, maxCats).map((cat) => (
            <Badge
              key={cat}
              variant="outline"
              className={`text-[10px] px-1.5 ${STRIDE_COLORS[cat]}`}
            >
              {STRIDE_SHORT_NAMES[cat]}
            </Badge>
          ))}
          {threat.strideCategories.length > maxCats && (
            <span className="text-[9px] text-muted-foreground">
              +{threat.strideCategories.length - maxCats}
            </span>
          )}
          <Badge
            className={`text-[10px] ${SEVERITY_COLORS[threat.defaultSeverity]}`}
          >
            {threat.defaultSeverity}
          </Badge>
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="h-6 w-6 p-0"
          onClick={() => onSelect(threat)}
          aria-label={`Add threat ${threat.name}`}
        >
          <Plus className="h-3 w-3" />
        </Button>
      </div>
      <h4
        className={`font-medium ${compact ? "text-xs" : "text-sm"} mb-0.5 line-clamp-1`}
      >
        {threat.name}
      </h4>
      <p
        className={`text-muted-foreground line-clamp-2 ${compact ? "text-[10px]" : "text-xs"}`}
      >
        {threat.description}
      </p>
      {!compact && threat.references && threat.references.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {threat.references.slice(0, 2).map((ref) => (
            <Badge key={ref} variant="outline" className="text-[9px] px-1 py-0">
              {ref}
            </Badge>
          ))}
          {threat.references.length > 2 && (
            <span className="text-[9px] text-muted-foreground">
              +{threat.references.length - 2}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

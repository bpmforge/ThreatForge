"use client";

/**
 * ThreatLibraryItem - Single threat item in the library browser.
 */
import { Button } from "@/components/ui/button";
import type { LibraryThreat } from "../types";
import { SEVERITY_COLORS, STRIDE_SHORT_NAMES } from "../constants";

interface ThreatLibraryItemProps {
  threat: LibraryThreat;
  onSelect: (threat: LibraryThreat) => void;
}

export function ThreatLibraryItem({
  threat,
  onSelect,
}: ThreatLibraryItemProps) {
  return (
    <div className="p-3 rounded-lg border hover:border-blue-300 hover:bg-blue-50/50 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          {threat.strideCategories.map((cat) => (
            <span
              key={cat}
              className="inline-flex items-center justify-center px-2 h-6 rounded text-xs font-bold bg-muted text-foreground tracking-wider"
            >
              {STRIDE_SHORT_NAMES[cat]}
            </span>
          ))}
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium text-white ${SEVERITY_COLORS[threat.defaultSeverity]}`}
          >
            {threat.defaultSeverity}
          </span>
        </div>
        <Button size="sm" variant="outline" onClick={() => onSelect(threat)}>
          + Add
        </Button>
      </div>

      <h4 className="font-medium text-foreground mt-2">{threat.name}</h4>
      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
        {threat.description}
      </p>

      {threat.applicableTo.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {threat.applicableTo.slice(0, 3).map((type) => (
            <span
              key={type}
              className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-muted text-muted-foreground"
            >
              {type.replace("_", " ")}
            </span>
          ))}
          {threat.applicableTo.length > 3 && (
            <span className="text-[10px] text-muted-foreground">
              +{threat.applicableTo.length - 3} more
            </span>
          )}
        </div>
      )}
    </div>
  );
}

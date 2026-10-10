"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search } from "lucide-react";
import { SEVERITY_COLORS } from "@/features/threat-library";
import type { Severity } from "@/types/canvas";

interface ThreatLibraryFiltersBarProps {
  severityFilter: Severity | "ALL";
  onSeverityFilter: (sev: Severity | "ALL") => void;
  severityCounts: Record<string, number>;
  search: string;
  onSearch: (value: string) => void;
  sourceFilter: string;
  onSourceFilter: (value: string) => void;
}

export function ThreatLibraryFiltersBar({
  severityFilter,
  onSeverityFilter,
  severityCounts,
  search,
  onSearch,
  sourceFilter,
  onSourceFilter,
}: ThreatLibraryFiltersBarProps) {
  return (
    <>
      <div className="flex flex-wrap items-center gap-2 p-3 bg-muted/50 rounded-lg">
        <span className="text-sm font-medium mr-2">Severity:</span>
        {(["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"] as Severity[]).map(
          (sev) => (
            <Badge
              key={sev}
              variant={severityFilter === sev ? "default" : "outline"}
              className={`cursor-pointer ${severityFilter === sev ? SEVERITY_COLORS[sev] : ""}`}
              onClick={() =>
                onSeverityFilter(severityFilter === sev ? "ALL" : sev)
              }
            >
              {sev} ({severityCounts[sev] || 0})
            </Badge>
          ),
        )}
        {severityFilter !== "ALL" && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onSeverityFilter("ALL")}
          >
            Clear
          </Button>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search threats..."
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={sourceFilter} onValueChange={onSourceFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All Sources" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Sources</SelectItem>
            <SelectItem value="STRIDE">STRIDE Core</SelectItem>
            <SelectItem value="OWASP">OWASP</SelectItem>
            <SelectItem value="CLOUD">Cloud Security</SelectItem>
            <SelectItem value="LINDDUN">LINDDUN Privacy</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </>
  );
}

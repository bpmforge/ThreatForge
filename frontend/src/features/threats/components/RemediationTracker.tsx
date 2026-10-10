"use client";

/**
 * Remediation Tracker
 *
 * Tracks threat remediation lifecycle:
 * Identified → Planned → In Progress → Implemented → Verified
 *
 * Shows verification status, linked evidence, and aging.
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  STATUS_CONFIG,
  STATUS_ORDER,
  type RemediationItem,
} from "./remediation-tracker-config";
import { RemediationItemRow } from "./RemediationItemRow";

export type { RemediationItem } from "./remediation-tracker-config";

interface RemediationTrackerProps {
  items: RemediationItem[];
  onStatusChange?: (id: string, status: RemediationItem["status"]) => void;
}

export function RemediationTracker({
  items,
  onStatusChange,
}: RemediationTrackerProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const filtered =
    filterStatus === "all"
      ? items
      : items.filter((i) => i.status === filterStatus);

  // Summary stats
  const total = items.length;
  const verified = items.filter((i) => i.status === "VERIFIED").length;
  const implemented = items.filter((i) => i.status === "IMPLEMENTED").length;
  const open = items.filter(
    (i) => i.status === "IDENTIFIED" || i.status === "PLANNED",
  ).length;
  const completionRate =
    total > 0 ? Math.round(((verified + implemented) / total) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="flex items-center gap-4 p-3 rounded-lg border">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium">Remediation Progress</span>
            <span className="text-xs text-muted-foreground">
              {completionRate}% complete
            </span>
          </div>
          <Progress value={completionRate} className="h-2" />
        </div>
        <div className="flex gap-3 text-xs text-muted-foreground">
          <span>
            <span className="font-medium text-green-600">{verified}</span>{" "}
            verified
          </span>
          <span>
            <span className="font-medium text-blue-600">
              {items.filter((i) => i.status === "IN_PROGRESS").length}
            </span>{" "}
            in progress
          </span>
          <span>
            <span className="font-medium text-red-600">{open}</span> open
          </span>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 overflow-x-auto">
        <Button
          variant={filterStatus === "all" ? "default" : "ghost"}
          size="sm"
          onClick={() => setFilterStatus("all")}
          className="rounded-full text-xs h-7"
        >
          All ({total})
        </Button>
        {STATUS_ORDER.map((status) => {
          const count = items.filter((i) => i.status === status).length;
          if (count === 0) return null;
          const config = STATUS_CONFIG[status];
          return (
            <Button
              key={status}
              variant={filterStatus === status ? "default" : "ghost"}
              size="sm"
              onClick={() => setFilterStatus(status)}
              className="rounded-full text-xs h-7"
            >
              {config.label} ({count})
            </Button>
          );
        })}
      </div>

      {/* Item list */}
      <div className="space-y-2">
        {filtered.map((item) => (
          <RemediationItemRow
            key={item.id}
            item={item}
            isExpanded={expandedId === item.id}
            onToggleExpand={() =>
              setExpandedId(expandedId === item.id ? null : item.id)
            }
            onStatusChange={onStatusChange}
          />
        ))}
      </div>
    </div>
  );
}

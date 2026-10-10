"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type NodeStatus = "draft" | "in-review" | "approved" | "deprecated";

const statusConfig: Record<NodeStatus, { label: string; className: string }> = {
  draft: {
    label: "Draft",
    className: "border-gray-400 text-gray-500 bg-gray-50 dark:bg-gray-900/20",
  },
  "in-review": {
    label: "In Review",
    className:
      "border-amber-400 text-amber-600 bg-amber-50 dark:bg-amber-900/20",
  },
  approved: {
    label: "Approved",
    className:
      "border-green-500 text-green-600 bg-green-50 dark:bg-green-900/20",
  },
  deprecated: {
    label: "Deprecated",
    className: "border-red-400 text-red-500 bg-red-50/60 dark:bg-red-900/10",
  },
};

interface NodeStatusChipProps {
  status?: NodeStatus | null;
}

/** Small status badge rendered inside a component node. Returns null when no status set. */
export function NodeStatusChip({ status }: NodeStatusChipProps) {
  if (!status) return null;
  const cfg = statusConfig[status];
  return (
    <Badge
      variant="outline"
      className={cn(
        "px-1 py-0 text-[9px] leading-4 font-medium",
        cfg.className,
      )}
      aria-label={`Status: ${cfg.label}`}
    >
      {cfg.label}
    </Badge>
  );
}

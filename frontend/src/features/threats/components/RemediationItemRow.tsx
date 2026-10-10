"use client";

import { ExternalLink, ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  STATUS_CONFIG,
  STATUS_ORDER,
  type RemediationItem,
} from "./remediation-tracker-config";

interface RemediationItemRowProps {
  item: RemediationItem;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onStatusChange?: (id: string, status: RemediationItem["status"]) => void;
}

export function RemediationItemRow({
  item,
  isExpanded,
  onToggleExpand,
  onStatusChange,
}: RemediationItemRowProps) {
  const config = STATUS_CONFIG[item.status];
  const StatusIcon = config.icon;

  return (
    <div className="rounded-lg border overflow-hidden">
      <button
        onClick={onToggleExpand}
        className="w-full flex items-center gap-3 p-3 text-left hover:bg-accent/50 transition-colors"
      >
        <StatusIcon className={`h-4 w-4 shrink-0 ${config.color}`} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{item.threatName}</p>
          {item.assignee && (
            <p className="text-xs text-muted-foreground">
              {item.assignee}
              {item.daysOpen > 30 && (
                <span className="text-amber-500 ml-2">
                  {item.daysOpen}d old
                </span>
              )}
            </p>
          )}
        </div>
        <Badge
          variant={item.severity === "CRITICAL" ? "destructive" : "secondary"}
          className={`text-[10px] font-bold ${
            item.severity === "HIGH"
              ? "bg-orange-500 text-white border-orange-500"
              : item.severity === "MEDIUM"
                ? "bg-yellow-500 text-black border-yellow-500"
                : item.severity === "LOW"
                  ? "bg-blue-500 text-white border-blue-500"
                  : ""
          }`}
        >
          {item.severity}
        </Badge>
        <ChevronDown
          className={`h-3 w-3 text-muted-foreground transition-transform ${isExpanded ? "rotate-180" : ""}`}
        />
      </button>

      {isExpanded && (
        <div className="px-3 pb-3 space-y-3 border-t pt-3">
          {/* Status progression */}
          <div className="flex items-center gap-1">
            {STATUS_ORDER.map((s, i) => {
              const sConfig = STATUS_CONFIG[s];
              const isActive = STATUS_ORDER.indexOf(item.status) >= i;
              return (
                <div key={s} className="flex items-center gap-1">
                  {i > 0 && (
                    <div
                      className={`w-4 h-0.5 ${isActive ? "bg-green-500" : "bg-muted"}`}
                    />
                  )}
                  <button
                    onClick={() => onStatusChange?.(item.id, s)}
                    className={`h-5 w-5 rounded-full flex items-center justify-center transition-colors ${
                      isActive ? sConfig.bg : "bg-muted"
                    }`}
                    title={`Set to ${sConfig.label}`}
                  >
                    <sConfig.icon
                      className={`h-3 w-3 ${isActive ? sConfig.color : "text-muted-foreground"}`}
                    />
                  </button>
                </div>
              );
            })}
          </div>

          {item.mitigationDescription && (
            <p className="text-xs text-muted-foreground">
              {item.mitigationDescription}
            </p>
          )}

          <div className="flex gap-2">
            {item.linkedIssue && (
              <a
                href={item.linkedIssue.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
              >
                <ExternalLink className="h-3 w-3" />
                {item.linkedIssue.key}
              </a>
            )}
            {item.linkedPR && (
              <a
                href={item.linkedPR.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-purple-600 hover:underline"
              >
                <ExternalLink className="h-3 w-3" />
                PR #{item.linkedPR.number}
              </a>
            )}
          </div>

          {item.verifiedAt && (
            <p className="text-xs text-green-600">
              Verified: {new Date(item.verifiedAt).toLocaleDateString()}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

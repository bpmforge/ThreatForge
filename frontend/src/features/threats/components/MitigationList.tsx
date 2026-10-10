"use client";

import { Button } from "@/components/ui/button";
import { ShieldAlert } from "lucide-react";
import type { Mitigation } from "../types";
import { MitigationItem } from "./MitigationItem";

interface MitigationListProps {
  mitigations: Mitigation[];
  onAdd: () => void;
  onStatusChange: (mitigationId: string, status: string) => void;
  onDelete: (mitigationId: string) => void;
  onEdit: (mitigationId: string) => void;
  hasJiraIntegration?: boolean;
  onCreateJiraIssue?: (mitigationId: string) => void;
  creatingJiraIssueFor?: string | null;
  jiraIssueUrls?: Record<string, string>;
  onMove?: (mitigationId: string) => void;
}

function calcCumulativeEffectiveness(mitigations: Mitigation[]): number {
  const scores = mitigations
    .filter(
      (m) =>
        m.effectivenessScore != null &&
        m.effectivenessScore > 0 &&
        m.status === "IMPLEMENTED",
    )
    .map((m) => m.effectivenessScore!);
  if (scores.length === 0) return 0;
  let remaining = 1;
  for (const s of scores) remaining *= 1 - Math.min(s, 0.85);
  return Math.min(1 - remaining, 0.95);
}

export function MitigationList({
  mitigations,
  onAdd,
  onStatusChange,
  onDelete,
  onEdit,
  hasJiraIntegration,
  onCreateJiraIssue,
  creatingJiraIssueFor,
  jiraIssueUrls,
  onMove,
}: MitigationListProps) {
  const cumulative = calcCumulativeEffectiveness(mitigations);
  const residualPct = Math.round((1 - cumulative) * 100);
  const hasScores = mitigations.some((m) => m.effectivenessScore != null);

  return (
    <div className="border-t bg-muted/50 p-3">
      <div className="flex items-center justify-between mb-2">
        <h5 className="text-xs font-medium text-foreground">Mitigations</h5>
        <Button
          size="sm"
          variant="ghost"
          className="h-6 text-xs"
          onClick={onAdd}
        >
          + Add
        </Button>
      </div>

      {hasScores && mitigations.length > 0 && (
        <div className="mb-2 p-2 rounded border bg-background">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium flex items-center gap-1">
              <ShieldAlert className="h-3 w-3" />
              Residual Risk
            </span>
            <span
              className={`text-xs font-bold ${
                residualPct > 40
                  ? "text-red-600"
                  : residualPct > 15
                    ? "text-yellow-600"
                    : "text-green-600"
              }`}
            >
              {residualPct}%
            </span>
          </div>
          <div className="h-1.5 w-full bg-green-200 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${
                residualPct > 40
                  ? "bg-red-500"
                  : residualPct > 15
                    ? "bg-yellow-500"
                    : "bg-green-500"
              }`}
              style={{ width: `${residualPct}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {cumulative > 0
              ? `${Math.round(cumulative * 100)}% mitigated — ${residualPct}% risk remains`
              : "No effectiveness scores assigned"}
          </p>
        </div>
      )}

      {mitigations.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">
          No mitigations yet
        </p>
      ) : (
        <div className="space-y-2">
          {mitigations.map((mitigation) => (
            <MitigationItem
              key={mitigation.id}
              mitigation={mitigation}
              hasJiraIntegration={hasJiraIntegration}
              onCreateJiraIssue={onCreateJiraIssue}
              creatingJiraIssueFor={creatingJiraIssueFor}
              jiraIssueUrls={jiraIssueUrls}
              onStatusChange={onStatusChange}
              onDelete={onDelete}
              onEdit={onEdit}
              onMove={onMove}
            />
          ))}
        </div>
      )}
    </div>
  );
}

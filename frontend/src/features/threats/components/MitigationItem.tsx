"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Mitigation } from "../types";
import {
  MITIGATION_STATUS_OPTIONS,
  MITIGATION_STRATEGY_OPTIONS,
} from "../constants";
import { MitigationBadges } from "./MitigationBadges";
import { MitigationActions } from "./MitigationActions";
import { MitigationDetails } from "./MitigationDetails";

function getStatusColor(status: string): string {
  return (
    MITIGATION_STATUS_OPTIONS.find((o) => o.value === status)?.color ||
    "text-muted-foreground"
  );
}

function getStrategyLabel(strategy: string): string {
  return (
    MITIGATION_STRATEGY_OPTIONS.find((o) => o.value === strategy)?.label ||
    strategy
  );
}

interface MitigationItemProps {
  mitigation: Mitigation;
  hasJiraIntegration?: boolean;
  onCreateJiraIssue?: (mitigationId: string) => void;
  creatingJiraIssueFor?: string | null;
  jiraIssueUrls?: Record<string, string>;
  onStatusChange: (mitigationId: string, status: string) => void;
  onDelete: (mitigationId: string) => void;
  onEdit: (mitigationId: string) => void;
  onMove?: (mitigationId: string) => void;
}

export function MitigationItem({
  mitigation,
  hasJiraIntegration,
  onCreateJiraIssue,
  creatingJiraIssueFor,
  jiraIssueUrls,
  onStatusChange,
  onDelete,
  onEdit,
  onMove,
}: MitigationItemProps) {
  const jiraUrl = jiraIssueUrls?.[mitigation.id];
  const isCreating = creatingJiraIssueFor === mitigation.id;

  return (
    <div className="p-2 bg-background rounded border">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <MitigationBadges mitigation={mitigation} />
          <button
            onClick={() => onEdit(mitigation.id)}
            className="text-xs text-foreground text-left hover:text-primary transition-colors cursor-pointer"
            title="Click to edit"
          >
            {mitigation.description}
          </button>
        </div>

        <MitigationActions
          mitigation={mitigation}
          hasJiraIntegration={hasJiraIntegration}
          onCreateJiraIssue={onCreateJiraIssue}
          isCreating={isCreating}
          jiraUrl={jiraUrl}
          onDelete={onDelete}
          onMove={onMove}
        />
      </div>

      <div className="flex items-center gap-2 mt-2 flex-wrap">
        <Select
          value={mitigation.status}
          onValueChange={(v) => onStatusChange(mitigation.id, v)}
        >
          <SelectTrigger
            className={`h-6 text-xs w-28 ${getStatusColor(mitigation.status)}`}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MITIGATION_STATUS_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground">
          {mitigation.priority}
        </span>
        {mitigation.strategy && (
          <span className="text-xs px-1.5 py-0.5 bg-muted rounded text-muted-foreground">
            {getStrategyLabel(mitigation.strategy)}
          </span>
        )}
      </div>

      <MitigationDetails mitigation={mitigation} />
    </div>
  );
}

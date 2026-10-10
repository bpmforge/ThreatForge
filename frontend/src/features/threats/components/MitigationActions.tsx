"use client";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Ticket, Loader2, ArrowRightLeft } from "lucide-react";
import type { Mitigation } from "../types";

interface MitigationActionsProps {
  mitigation: Mitigation;
  hasJiraIntegration?: boolean;
  onCreateJiraIssue?: (mitigationId: string) => void;
  isCreating: boolean;
  jiraUrl?: string;
  onDelete: (mitigationId: string) => void;
  onMove?: (mitigationId: string) => void;
}

export function MitigationActions({
  mitigation,
  hasJiraIntegration,
  onCreateJiraIssue,
  isCreating,
  jiraUrl,
  onDelete,
  onMove,
}: MitigationActionsProps) {
  return (
    <div className="flex items-center gap-1">
      {hasJiraIntegration && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              {jiraUrl ? (
                <button
                  onClick={() => window.open(jiraUrl, "_blank")}
                  className="text-blue-600 hover:text-blue-700 transition-colors"
                  title="View JIRA Issue"
                >
                  <Ticket className="w-3 h-3" />
                </button>
              ) : (
                <button
                  onClick={() => onCreateJiraIssue?.(mitigation.id)}
                  disabled={isCreating}
                  className="text-muted-foreground hover:text-blue-600 transition-colors disabled:opacity-50"
                  title="Create JIRA Issue"
                >
                  {isCreating ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Ticket className="w-3 h-3" />
                  )}
                </button>
              )}
            </TooltipTrigger>
            <TooltipContent>
              <p>{jiraUrl ? "View JIRA Issue" : "Create JIRA Issue"}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
      {onMove && (
        <button
          onClick={() => onMove(mitigation.id)}
          className="text-muted-foreground hover:text-primary transition-colors"
          title="Move to another threat"
          aria-label="Move mitigation"
        >
          <ArrowRightLeft className="w-3 h-3" />
        </button>
      )}
      <button
        onClick={() => onDelete(mitigation.id)}
        className="text-muted-foreground hover:text-red-500 transition-colors"
        title="Delete mitigation"
        aria-label="Delete mitigation"
      >
        <svg
          className="w-3 h-3"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
    </div>
  );
}

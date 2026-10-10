"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  MoreVertical,
  Library,
  Trash2,
  Pencil,
  GitBranch,
  Ticket,
  Loader2,
  Wand2,
  Sparkles,
} from "lucide-react";

interface ThreatCardMenuProps {
  threatName: string;
  hasJiraIntegration?: boolean;
  jiraIssueUrl?: string | null;
  isCreatingJiraIssue?: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onCalculateSeverity?: () => void;
  onRefineWithAI?: () => void;
  onGenerateAttackTree?: () => void;
  onSaveAsTemplate?: () => void;
  onCreateJiraIssue?: () => void;
}

export function ThreatCardMenu({
  threatName,
  hasJiraIntegration,
  jiraIssueUrl,
  isCreatingJiraIssue,
  onEdit,
  onDelete,
  onCalculateSeverity,
  onRefineWithAI,
  onGenerateAttackTree,
  onSaveAsTemplate,
  onCreateJiraIssue,
}: ThreatCardMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          aria-label={`Actions for threat: ${threatName}`}
        >
          <MoreVertical className="h-4 w-4" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onEdit}>
          <Pencil className="h-4 w-4 mr-2" />
          Edit Threat
        </DropdownMenuItem>
        {onCalculateSeverity && (
          <DropdownMenuItem onClick={onCalculateSeverity}>
            <Wand2 className="h-4 w-4 mr-2" />
            AI Severity Score
          </DropdownMenuItem>
        )}
        {onRefineWithAI && (
          <DropdownMenuItem onClick={onRefineWithAI}>
            <Sparkles className="h-4 w-4 mr-2 text-violet-500" />
            Refine with AI
          </DropdownMenuItem>
        )}
        {onGenerateAttackTree && (
          <DropdownMenuItem onClick={onGenerateAttackTree}>
            <GitBranch className="h-4 w-4 mr-2" />
            Attack Tree
          </DropdownMenuItem>
        )}
        {onSaveAsTemplate && (
          <DropdownMenuItem onClick={onSaveAsTemplate}>
            <Library className="h-4 w-4 mr-2" />
            Save as Template
          </DropdownMenuItem>
        )}
        {hasJiraIntegration && (
          <>
            <DropdownMenuSeparator />
            {jiraIssueUrl ? (
              <DropdownMenuItem
                onClick={() => window.open(jiraIssueUrl, "_blank")}
              >
                <Ticket className="h-4 w-4 mr-2 text-blue-600" />
                View JIRA Issue
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                onClick={onCreateJiraIssue}
                disabled={isCreatingJiraIssue}
              >
                {isCreatingJiraIssue ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Ticket className="h-4 w-4 mr-2" />
                )}
                {isCreatingJiraIssue ? "Creating..." : "Create JIRA Issue"}
              </DropdownMenuItem>
            )}
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onDelete} className="text-destructive">
          <Trash2 className="h-4 w-4 mr-2" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

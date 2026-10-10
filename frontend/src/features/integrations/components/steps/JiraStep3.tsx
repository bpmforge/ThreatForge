"use client";

import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { JiraIssueType } from "../../types";

interface JiraStep3Props {
  issueTypes: JiraIssueType[];
  threatIssueType: string;
  onThreatIssueTypeChange: (value: string) => void;
  mitigationIssueType: string;
  onMitigationIssueTypeChange: (value: string) => void;
  syncDirection: "PUSH_ONLY" | "PULL_ONLY" | "BIDIRECTIONAL";
  onSyncDirectionChange: (
    value: "PUSH_ONLY" | "PULL_ONLY" | "BIDIRECTIONAL",
  ) => void;
  autoCreate: boolean;
  onAutoCreateChange: (value: boolean) => void;
}

export function JiraStep3({
  issueTypes,
  threatIssueType,
  onThreatIssueTypeChange,
  mitigationIssueType,
  onMitigationIssueTypeChange,
  syncDirection,
  onSyncDirectionChange,
  autoCreate,
  onAutoCreateChange,
}: JiraStep3Props) {
  const nonSubtaskTypes = issueTypes.filter((t) => !t.subtask);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Issue Type for Threats</Label>
        <Select value={threatIssueType} onValueChange={onThreatIssueTypeChange}>
          <SelectTrigger>
            <SelectValue placeholder="Select issue type" />
          </SelectTrigger>
          <SelectContent>
            {nonSubtaskTypes.map((type) => (
              <SelectItem key={type.id} value={type.id}>
                {type.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          JIRA issue type to create when syncing threats
        </p>
      </div>

      <div className="space-y-2">
        <Label>Issue Type for Mitigations</Label>
        <Select
          value={mitigationIssueType}
          onValueChange={onMitigationIssueTypeChange}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select issue type" />
          </SelectTrigger>
          <SelectContent>
            {nonSubtaskTypes.map((type) => (
              <SelectItem key={type.id} value={type.id}>
                {type.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          JIRA issue type to create when syncing mitigations
        </p>
      </div>

      <div className="space-y-2">
        <Label>Sync Direction</Label>
        <Select
          value={syncDirection}
          onValueChange={(v) =>
            onSyncDirectionChange(
              v as "PUSH_ONLY" | "PULL_ONLY" | "BIDIRECTIONAL",
            )
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="PUSH_ONLY">Push Only (to JIRA)</SelectItem>
            <SelectItem value="PULL_ONLY">Pull Only (from JIRA)</SelectItem>
            <SelectItem value="BIDIRECTIONAL">Bidirectional</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center justify-between pt-2">
        <div className="space-y-0.5">
          <Label htmlFor="auto-create">Auto-create Issues</Label>
          <p className="text-sm text-muted-foreground">
            Automatically create JIRA issues for new threats
          </p>
        </div>
        <Switch
          id="auto-create"
          checked={autoCreate}
          onCheckedChange={onAutoCreateChange}
        />
      </div>
    </div>
  );
}

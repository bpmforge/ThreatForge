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
import type { GitHubLabel } from "../../types";

interface GitHubStep3Props {
  labels: GitHubLabel[];
  threatLabel: string;
  onThreatLabelChange: (value: string) => void;
  mitigationLabel: string;
  onMitigationLabelChange: (value: string) => void;
  syncDirection: "PUSH_ONLY" | "PULL_ONLY" | "BIDIRECTIONAL";
  onSyncDirectionChange: (
    value: "PUSH_ONLY" | "PULL_ONLY" | "BIDIRECTIONAL",
  ) => void;
  autoCreateIssues: boolean;
  onAutoCreateIssuesChange: (value: boolean) => void;
}

export function GitHubStep3({
  labels,
  threatLabel,
  onThreatLabelChange,
  mitigationLabel,
  onMitigationLabelChange,
  syncDirection,
  onSyncDirectionChange,
  autoCreateIssues,
  onAutoCreateIssuesChange,
}: GitHubStep3Props) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Label for Threats</Label>
        <Select value={threatLabel} onValueChange={onThreatLabelChange}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="threat">threat (create new)</SelectItem>
            <SelectItem value="security">security (create new)</SelectItem>
            {labels.map((label) => (
              <SelectItem key={label.id} value={label.name}>
                <span className="flex items-center gap-2">
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: `#${label.color}` }}
                  />
                  {label.name}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Label for Mitigations</Label>
        <Select value={mitigationLabel} onValueChange={onMitigationLabelChange}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="mitigation">mitigation (create new)</SelectItem>
            <SelectItem value="enhancement">
              enhancement (create new)
            </SelectItem>
            {labels.map((label) => (
              <SelectItem key={label.id} value={label.name}>
                <span className="flex items-center gap-2">
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: `#${label.color}` }}
                  />
                  {label.name}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Sync Direction</Label>
        <Select
          value={syncDirection}
          onValueChange={(v) =>
            onSyncDirectionChange(v as typeof syncDirection)
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="PUSH_ONLY">
              Push Only (Flow to GitHub)
            </SelectItem>
            <SelectItem value="PULL_ONLY">
              Pull Only (GitHub to Flow)
            </SelectItem>
            <SelectItem value="BIDIRECTIONAL">Bidirectional</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center justify-between pt-2">
        <div className="space-y-0.5">
          <Label htmlFor="auto-create">Auto-create Issues</Label>
          <p className="text-xs text-muted-foreground">
            Automatically create GitHub issues for new threats
          </p>
        </div>
        <Switch
          id="auto-create"
          checked={autoCreateIssues}
          onCheckedChange={onAutoCreateIssuesChange}
        />
      </div>
    </div>
  );
}

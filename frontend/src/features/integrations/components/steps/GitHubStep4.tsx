"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Github } from "lucide-react";
import type { GitHubRepository } from "../../types";

interface GitHubStep4Props {
  selectedRepo: GitHubRepository;
  threatLabel: string;
  mitigationLabel: string;
  syncDirection: "PUSH_ONLY" | "PULL_ONLY" | "BIDIRECTIONAL";
  autoCreateIssues: boolean;
}

export function GitHubStep4({
  selectedRepo,
  threatLabel,
  mitigationLabel,
  syncDirection,
  autoCreateIssues,
}: GitHubStep4Props) {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Github className="h-5 w-5" />
          <span className="font-medium">{selectedRepo.full_name}</span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="text-muted-foreground">Threat Label:</div>
          <div>
            <Badge variant="outline">{threatLabel}</Badge>
          </div>

          <div className="text-muted-foreground">Mitigation Label:</div>
          <div>
            <Badge variant="outline">{mitigationLabel}</Badge>
          </div>

          <div className="text-muted-foreground">Sync Direction:</div>
          <div>{syncDirection.replace("_", " ").toLowerCase()}</div>

          <div className="text-muted-foreground">Auto-create:</div>
          <div>{autoCreateIssues ? "Enabled" : "Disabled"}</div>
        </div>
      </div>

      <Alert>
        <AlertDescription>
          This will enable syncing threats and mitigations with GitHub Issues.
          You can modify these settings later from the Integrations panel.
        </AlertDescription>
      </Alert>
    </div>
  );
}

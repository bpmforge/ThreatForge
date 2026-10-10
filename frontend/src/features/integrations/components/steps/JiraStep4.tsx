"use client";

import type { JiraProject, JiraIssueType } from "../../types";

interface JiraStep4Props {
  name: string;
  baseUrl: string;
  selectedProject: string;
  projects: JiraProject[];
  issueTypes: JiraIssueType[];
  threatIssueType: string;
  mitigationIssueType: string;
  autoCreate: boolean;
  syncDirection: "PUSH_ONLY" | "PULL_ONLY" | "BIDIRECTIONAL";
}

export function JiraStep4({
  name,
  baseUrl,
  selectedProject,
  projects,
  issueTypes,
  threatIssueType,
  mitigationIssueType,
  autoCreate,
  syncDirection,
}: JiraStep4Props) {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border p-4 space-y-3">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Name</span>
          <span className="font-medium">{name}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">JIRA Site</span>
          <span className="font-medium">{baseUrl}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Project</span>
          <span className="font-medium">
            {projects.find((p) => p.key === selectedProject)?.name ||
              selectedProject}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Threat Issue Type</span>
          <span className="font-medium">
            {issueTypes.find((t) => t.id === threatIssueType)?.name || "-"}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Mitigation Issue Type</span>
          <span className="font-medium">
            {issueTypes.find((t) => t.id === mitigationIssueType)?.name || "-"}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Auto-create</span>
          <span className="font-medium">{autoCreate ? "Yes" : "No"}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Sync Direction</span>
          <span className="font-medium">{syncDirection.replace("_", " ")}</span>
        </div>
      </div>
    </div>
  );
}

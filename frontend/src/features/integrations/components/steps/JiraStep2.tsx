"use client";

import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { JiraProject } from "../../types";

interface JiraStep2Props {
  projects: JiraProject[];
  selectedProject: string;
  onProjectSelect: (projectKey: string) => void;
  issueTypeCount: number;
  isFetchingIssueTypes: boolean;
}

export function JiraStep2({
  projects,
  selectedProject,
  onProjectSelect,
  issueTypeCount,
  isFetchingIssueTypes,
}: JiraStep2Props) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Select Project</Label>
        <Select value={selectedProject} onValueChange={onProjectSelect}>
          <SelectTrigger>
            <SelectValue placeholder="Choose a JIRA project" />
          </SelectTrigger>
          <SelectContent>
            {projects.map((project) => (
              <SelectItem key={project.id} value={project.key}>
                {project.key} - {project.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isFetchingIssueTypes && (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading issue types...
        </div>
      )}

      {issueTypeCount > 0 && (
        <Alert className="bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800">
          <AlertDescription className="text-blue-700 dark:text-blue-300">
            Found {issueTypeCount} issue types in {selectedProject}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

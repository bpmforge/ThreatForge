"use client";

import { FolderPlus } from "lucide-react";
import { EmptyState } from "./EmptyState";

interface EmptyProjectListProps {
  onCreateProject: () => void;
}

export function EmptyProjectList({ onCreateProject }: EmptyProjectListProps) {
  return (
    <EmptyState
      icon={FolderPlus}
      title="No projects yet"
      description="Create your first project to start threat modeling"
      actions={[
        {
          label: "Create Project",
          onClick: onCreateProject,
        },
      ]}
    />
  );
}

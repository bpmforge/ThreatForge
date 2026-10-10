"use client";

import { FileCode } from "lucide-react";
import { EmptyState } from "./EmptyState";

interface EmptyModelListProps {
  onCreateModel?: () => void;
  createModelHref?: string;
  projectName?: string;
}

export function EmptyModelList({
  onCreateModel,
  createModelHref,
  projectName,
}: EmptyModelListProps) {
  return (
    <EmptyState
      icon={FileCode}
      title="No threat models"
      description={`Create a new threat model for ${projectName || "this project"}`}
      actions={[
        {
          label: "Create Model",
          onClick: onCreateModel,
          href: createModelHref,
          variant: "default",
        },
      ]}
    />
  );
}

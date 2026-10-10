"use client";

import { useState } from "react";
import { useProjects } from "@/features/projects";
import { useThreatModels } from "@/features/dashboard";

export function useReportsPage() {
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [selectedModelId, setSelectedModelId] = useState<string>("");

  const { data: projects, isLoading: projectsLoading } = useProjects();
  const { data: models, isLoading: modelsLoading } = useThreatModels(
    selectedProjectId ? { projectId: selectedProjectId } : undefined,
  );

  const handleProjectChange = (value: string) => {
    setSelectedProjectId(value);
    setSelectedModelId("");
  };

  return {
    projects,
    projectsLoading,
    models,
    modelsLoading,
    selectedProjectId,
    selectedModelId,
    setSelectedModelId,
    hasSelection: !!selectedModelId,
    handleProjectChange,
  };
}

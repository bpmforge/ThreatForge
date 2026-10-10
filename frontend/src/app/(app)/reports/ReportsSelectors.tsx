"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { useReportsPage } from "./useReportsPage";

type PageState = ReturnType<typeof useReportsPage>;

interface ReportsSelectorsProps {
  state: PageState;
}

export function ReportsSelectors({ state: p }: ReportsSelectorsProps) {
  return (
    <div className="flex flex-col sm:flex-row gap-4">
      <div className="w-full sm:w-72">
        <label
          className="text-sm font-medium mb-1.5 block"
          htmlFor="project-select"
        >
          Project
        </label>
        <Select
          value={p.selectedProjectId}
          onValueChange={p.handleProjectChange}
        >
          <SelectTrigger id="project-select" aria-label="Select project">
            <SelectValue
              placeholder={
                p.projectsLoading ? "Loading..." : "Select a project"
              }
            />
          </SelectTrigger>
          <SelectContent>
            {(p.projects ?? []).map((project) => (
              <SelectItem key={project.id} value={project.id}>
                {project.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="w-full sm:w-72">
        <label
          className="text-sm font-medium mb-1.5 block"
          htmlFor="model-select"
        >
          Threat Model
        </label>
        <Select
          value={p.selectedModelId}
          onValueChange={p.setSelectedModelId}
          disabled={!p.selectedProjectId}
        >
          <SelectTrigger id="model-select" aria-label="Select threat model">
            <SelectValue
              placeholder={
                !p.selectedProjectId
                  ? "Select a project first"
                  : p.modelsLoading
                    ? "Loading..."
                    : "Select a model"
              }
            />
          </SelectTrigger>
          <SelectContent>
            {(p.models ?? []).map((model) => (
              <SelectItem key={model.id} value={model.id}>
                {model.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

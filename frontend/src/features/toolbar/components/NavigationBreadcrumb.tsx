"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import type { SaveStatus } from "@/features/auto-save";
import type { ModelStatus } from "@/features/dashboard";
import { SaveStatusIndicator } from "./SaveStatusIndicator";
import { ModelStatusBadge } from "./ModelStatusBadge";
import { ModelTagsEditor } from "./ModelTagsEditor";

interface NavigationBreadcrumbProps {
  showBackButton: boolean;
  projectId?: string | null;
  projectName?: string | null;
  currentModelId: string | null;
  currentModelName: string;
  modelStatus?: ModelStatus;
  modelTags?: string[];
  saveStatus: SaveStatus;
  isDirty: boolean;
}

export function NavigationBreadcrumb({
  showBackButton,
  projectId,
  projectName,
  currentModelId,
  currentModelName,
  modelStatus,
  modelTags = [],
  saveStatus,
  isDirty,
}: NavigationBreadcrumbProps) {
  if (showBackButton) {
    return (
      <nav className="flex items-center gap-1 text-sm">
        <Link
          href="/dashboard"
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          Dashboard
        </Link>
        {projectId && projectName && (
          <>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
            <Link
              href={`/projects/${projectId}`}
              className="text-muted-foreground hover:text-foreground transition-colors max-w-[150px] truncate"
              title={projectName}
            >
              {projectName}
            </Link>
          </>
        )}
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
        <span
          className="font-medium text-foreground max-w-[200px] truncate"
          title={currentModelName}
        >
          {currentModelName}
        </span>
        <SaveStatusIndicator status={saveStatus} isDirty={isDirty} />
        {currentModelId && modelStatus && (
          <ModelStatusBadge modelId={currentModelId} status={modelStatus} />
        )}
        {currentModelId && (
          <ModelTagsEditor modelId={currentModelId} tags={modelTags} />
        )}
      </nav>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="font-medium text-foreground">{currentModelName}</span>
      <SaveStatusIndicator status={saveStatus} isDirty={isDirty} />
      {currentModelId && modelStatus && (
        <ModelStatusBadge modelId={currentModelId} status={modelStatus} />
      )}
      {currentModelId && (
        <ModelTagsEditor modelId={currentModelId} tags={modelTags} />
      )}
    </div>
  );
}

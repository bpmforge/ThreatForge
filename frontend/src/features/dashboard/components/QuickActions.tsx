/**
 * QuickActions - Quick action buttons for the dashboard
 */
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Upload, FileText, FolderOpen, Github } from "lucide-react";

interface QuickActionsProps {
  onNewModel: () => void;
  onImport: () => void;
  onBrowseTemplates: () => void;
  onBrowseProjects: () => void;
  onFromGithub?: () => void;
}

export function QuickActions({
  onNewModel,
  onImport,
  onBrowseTemplates,
  onBrowseProjects,
  onFromGithub,
}: QuickActionsProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">Quick Actions</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-2">
        <Button
          variant="outline"
          className="h-auto py-3 flex flex-col items-center gap-1"
          onClick={onNewModel}
        >
          <Plus className="h-5 w-5" />
          <span className="text-xs">New Model</span>
        </Button>
        <Button
          variant="outline"
          className="h-auto py-3 flex flex-col items-center gap-1"
          onClick={onImport}
        >
          <Upload className="h-5 w-5" />
          <span className="text-xs">Import</span>
        </Button>
        {onFromGithub && (
          <Button
            variant="outline"
            className="h-auto py-3 flex flex-col items-center gap-1"
            onClick={onFromGithub}
          >
            <Github className="h-5 w-5" />
            <span className="text-xs">From GitHub</span>
          </Button>
        )}
        <Button
          variant="outline"
          className="h-auto py-3 flex flex-col items-center gap-1"
          onClick={onBrowseTemplates}
        >
          <FileText className="h-5 w-5" />
          <span className="text-xs">Templates</span>
        </Button>
        <Button
          variant="outline"
          className="h-auto py-3 flex flex-col items-center gap-1"
          onClick={onBrowseProjects}
        >
          <FolderOpen className="h-5 w-5" />
          <span className="text-xs">Projects</span>
        </Button>
      </CardContent>
    </Card>
  );
}

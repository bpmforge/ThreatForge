/**
 * MoveToProjectDialog - Dialog for moving a threat model to a different project
 */
"use client";

import { getErrorMessage } from "@/lib/errors";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, FolderInput } from "lucide-react";
import { useProjects } from "@/features/projects";
import { useMoveThreatModel } from "../hooks/useDashboard";

interface MoveToProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  modelId: string;
  modelName: string;
  currentProjectId?: string;
}

export function MoveToProjectDialog({
  open,
  onOpenChange,
  modelId,
  modelName,
  currentProjectId,
}: MoveToProjectDialogProps) {
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const { data: projects } = useProjects();
  const moveModel = useMoveThreatModel();

  // Filter out the current project from the list
  const availableProjects =
    projects?.filter((p) => p.id !== currentProjectId) ?? [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedProjectId) {
      setError("Please select a project");
      return;
    }

    try {
      await moveModel.mutateAsync({
        id: modelId,
        projectId: selectedProjectId,
      });
      onOpenChange(false);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to move threat model"));
    }
  };

  const handleClose = () => {
    setSelectedProjectId("");
    setError(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderInput className="h-5 w-5" />
              Move to Project
            </DialogTitle>
            <DialogDescription>
              Move &quot;{modelName}&quot; to a different project.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="project">Select Project</Label>
              <Select
                value={selectedProjectId}
                onValueChange={setSelectedProjectId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose a project..." />
                </SelectTrigger>
                <SelectContent>
                  {availableProjects.length === 0 ? (
                    <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                      No other projects available.
                      <br />
                      Create a new project first.
                    </div>
                  ) : (
                    availableProjects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                The threat model will be moved to the selected project
              </p>
            </div>

            {error && (
              <div className="text-sm text-destructive bg-destructive/10 p-2 rounded-md">
                {error}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={moveModel.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                !selectedProjectId ||
                moveModel.isPending ||
                availableProjects.length === 0
              }
            >
              {moveModel.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Move
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

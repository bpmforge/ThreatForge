/**
 * Project settings panel
 */
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useUpdateProject, useDeleteProject } from "../hooks/useProjects";
import { canManageProject, type Project, type ProjectRole } from "../types";
import { getErrorMessage } from "@/lib/errors";

interface Props {
  project: Project;
  currentUserRole: ProjectRole;
  onDeleted?: () => void;
}

export function ProjectSettings({
  project,
  currentUserRole,
  onDeleted,
}: Props) {
  // Component should be keyed by project.id in parent for proper state reset
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description || "");
  const [isDirty, setIsDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const updateMutation = useUpdateProject(project.id);
  const deleteMutation = useDeleteProject();

  const canManage = canManageProject(currentUserRole);

  function handleChange(field: "name" | "description", value: string) {
    if (field === "name") setName(value);
    else setDescription(value);
    setIsDirty(true);
    setError(null);
  }

  async function handleSave() {
    if (!name.trim()) {
      setError("Project name is required");
      return;
    }
    if (name.trim().length < 3) {
      setError("Name must be at least 3 characters");
      return;
    }

    try {
      await updateMutation.mutateAsync({
        name: name.trim(),
        description: description.trim() || undefined,
      });
      setIsDirty(false);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to update"));
    }
  }

  function handleReset() {
    setName(project.name);
    setDescription(project.description || "");
    setIsDirty(false);
    setError(null);
  }

  async function handleDelete() {
    try {
      await deleteMutation.mutateAsync(project.id);
      setDeleteOpen(false);
      onDeleted?.();
    } catch (err) {
      setError(getErrorMessage(err, "Failed to delete project"));
    }
  }

  async function handleArchive() {
    try {
      await updateMutation.mutateAsync({
        status: project.status === "ARCHIVED" ? "ACTIVE" : "ARCHIVED",
      });
    } catch (err) {
      setError(getErrorMessage(err, "Failed to update status"));
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Project Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="project-name">Name</Label>
            <Input
              id="project-name"
              value={name}
              onChange={(e) => handleChange("name", e.target.value)}
              disabled={!canManage || updateMutation.isPending}
              maxLength={100}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="project-description">Description</Label>
            <Textarea
              id="project-description"
              value={description}
              onChange={(e) => handleChange("description", e.target.value)}
              disabled={!canManage || updateMutation.isPending}
              maxLength={500}
              rows={3}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          {canManage && isDirty && (
            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={updateMutation.isPending}>
                {updateMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
              <Button
                variant="outline"
                onClick={handleReset}
                disabled={updateMutation.isPending}
              >
                Reset
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {canManage && (
        <Card>
          <CardHeader>
            <CardTitle>Danger Zone</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">
                  {project.status === "ARCHIVED"
                    ? "Restore Project"
                    : "Archive Project"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {project.status === "ARCHIVED"
                    ? "Make this project active again."
                    : "Archive this project to hide it from the main list."}
                </p>
              </div>
              <Button variant="outline" onClick={handleArchive}>
                {project.status === "ARCHIVED" ? "Restore" : "Archive"}
              </Button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Delete Project</p>
                <p className="text-sm text-muted-foreground">
                  Permanently delete this project and all threat models.
                </p>
              </div>
              <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
                Delete
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Project</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{project.name}&quot;? This
              action cannot be undone. All threat models in this project will be
              permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>
              Delete Project
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

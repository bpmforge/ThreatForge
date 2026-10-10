/**
 * Dialog for creating a new project
 */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useCreateProject } from "../hooks/useProjects";
import { getErrorMessage } from "@/lib/errors";

interface Props {
  organizationId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateProjectDialog({
  organizationId,
  open,
  onOpenChange,
}: Props) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const createMutation = useCreateProject();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Project name is required");
      return;
    }
    if (name.trim().length < 3) {
      setError("Name must be at least 3 characters");
      return;
    }

    try {
      const project = await createMutation.mutateAsync({
        name: name.trim(),
        description: description.trim() || undefined,
        // Only send organizationId if it's provided and not the placeholder 'default'
        organizationId:
          organizationId && organizationId !== "default"
            ? organizationId
            : undefined,
      });
      const projectName = name.trim();
      setName("");
      setDescription("");
      onOpenChange(false);
      toast.success(`Project "${projectName}" created`);
      router.push(`/projects/${project.id}`);
    } catch (err) {
      const message = getErrorMessage(err, "Failed to create project");
      setError(message);
      toast.error(message);
    }
  }

  function handleClose() {
    setName("");
    setDescription("");
    setError(null);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create New Project</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="name">Project Name</Label>
              <span
                className={`text-xs ${name.length > 80 ? "text-amber-500" : "text-muted-foreground"}`}
              >
                {name.length}/100
              </span>
            </div>
            <Input
              id="name"
              placeholder="My Threat Model Project"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError(null);
              }}
              disabled={createMutation.isPending}
              maxLength={100}
              className={error && !name.trim() ? "border-destructive" : ""}
              aria-invalid={!!error && !name.trim()}
            />
            {name.trim().length > 0 && name.trim().length < 3 && (
              <p className="text-xs text-amber-500">
                Name should be at least 3 characters
              </p>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="description">Description (optional)</Label>
              <span
                className={`text-xs ${description.length > 400 ? "text-amber-500" : "text-muted-foreground"}`}
              >
                {description.length}/500
              </span>
            </div>
            <Textarea
              id="description"
              placeholder="Brief description of the project..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={createMutation.isPending}
              maxLength={500}
              rows={3}
            />
          </div>

          {error && (
            <div className="text-sm text-destructive bg-destructive/10 p-2 rounded-md">
              {error}
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={createMutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? "Creating..." : "Create Project"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

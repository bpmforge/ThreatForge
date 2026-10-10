/**
 * Create Version Dialog - Allows users to name and describe version snapshots
 */
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCreateVersion } from "../hooks/useVersionHistory";

interface Props {
  modelId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function CreateVersionDialog({
  modelId,
  open,
  onOpenChange,
  onSuccess,
}: Props) {
  const [name, setName] = useState("");
  const [changesSummary, setChangesSummary] = useState("");
  const createMutation = useCreateVersion(modelId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(
      {
        name: name.trim() || undefined,
        changesSummary: changesSummary.trim() || undefined,
      },
      {
        onSuccess: () => {
          setName("");
          setChangesSummary("");
          onOpenChange(false);
          onSuccess?.();
        },
      },
    );
  };

  const handleQuickSave = () => {
    createMutation.mutate(undefined, {
      onSuccess: () => {
        onOpenChange(false);
        onSuccess?.();
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create Version Snapshot</DialogTitle>
          <DialogDescription>
            Save the current state of your model. Add an optional name and
            description to help identify this version later.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="version-name">Version Name (optional)</Label>
              <Input
                id="version-name"
                placeholder="e.g., Before API refactor"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={100}
              />
              <p className="text-xs text-muted-foreground">
                Leave blank to use auto-generated version number
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="changes-summary">
                Changes Summary (optional)
              </Label>
              <Textarea
                id="changes-summary"
                placeholder="Describe what changed in this version..."
                value={changesSummary}
                onChange={(e) => setChangesSummary(e.target.value)}
                rows={3}
                maxLength={500}
              />
              <p className="text-xs text-muted-foreground">
                {changesSummary.length}/500 characters
              </p>
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleQuickSave}
              disabled={createMutation.isPending}
            >
              Quick Save
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? "Saving..." : "Save with Details"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

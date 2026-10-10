/**
 * Edit Version Dialog - Edit version name and description
 */
"use client";

import { useState, useCallback } from "react";
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
import { useUpdateVersion } from "../hooks/useVersionHistory";
import type { ThreatModelVersion } from "../types";

interface Props {
  modelId: string;
  version: ThreatModelVersion | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditVersionDialog({
  modelId,
  version,
  open,
  onOpenChange,
}: Props) {
  // Track local overrides - null means use prop value
  const [nameOverride, setNameOverride] = useState<string | null>(null);
  const [changesSummaryOverride, setChangesSummaryOverride] = useState<
    string | null
  >(null);
  const updateMutation = useUpdateVersion(modelId, version?.id || "");

  // Derived values from overrides or prop
  const name = nameOverride ?? (version?.name || "");
  const changesSummary =
    changesSummaryOverride ?? (version?.changesSummary || "");

  // Reset overrides when dialog closes
  const handleOpenChange = useCallback(
    (newOpen: boolean) => {
      if (!newOpen) {
        setNameOverride(null);
        setChangesSummaryOverride(null);
      }
      onOpenChange(newOpen);
    },
    [onOpenChange],
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!version) return;

    updateMutation.mutate(
      {
        name: name.trim() || undefined,
        changesSummary: changesSummary.trim() || undefined,
      },
      { onSuccess: () => handleOpenChange(false) },
    );
  };

  if (!version) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Version</DialogTitle>
          <DialogDescription>
            Update the name and description for Version {version.version}.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-version-name">Version Name</Label>
              <Input
                id="edit-version-name"
                placeholder={`Version ${version.version}`}
                value={name}
                onChange={(e) => setNameOverride(e.target.value)}
                maxLength={100}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-changes-summary">Changes Summary</Label>
              <Textarea
                id="edit-changes-summary"
                placeholder="Describe what changed in this version..."
                value={changesSummary}
                onChange={(e) => setChangesSummaryOverride(e.target.value)}
                rows={3}
                maxLength={500}
              />
              <p className="text-xs text-muted-foreground">
                {changesSummary.length}/500 characters
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

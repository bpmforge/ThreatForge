/**
 * Edit Organization Dialog
 *
 * Admin dialog for editing organization settings.
 */
"use client";

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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import {
  useOrganizationWithMembers,
  useUpdateOrganization,
} from "@/features/admin";

interface EditOrganizationDialogProps {
  orgId: string;
  onClose: () => void;
}

export function EditOrganizationDialog({
  orgId,
  onClose,
}: EditOrganizationDialogProps) {
  const { data: org, isLoading } = useOrganizationWithMembers(orgId);
  const updateOrg = useUpdateOrganization();
  const [name, setName] = useState<string | null>(null);

  // Use local state if user has edited, otherwise use org data
  const displayName = name ?? org?.name ?? "";

  const handleSave = async () => {
    const saveName = name ?? org?.name;
    if (!saveName?.trim()) return;
    await updateOrg.mutateAsync({ orgId, data: { name: saveName.trim() } });
    onClose();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Organization</DialogTitle>
          <DialogDescription>Update organization settings</DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Organization Name</Label>
              <Input
                id="name"
                value={displayName}
                onChange={(e) => setName(e.target.value)}
                placeholder="Organization name"
              />
            </div>

            <div className="space-y-2">
              <Label>Slug</Label>
              <Input value={org?.slug || ""} disabled className="bg-muted" />
              <p className="text-xs text-muted-foreground">
                Slug cannot be changed
              </p>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={updateOrg.isPending || !displayName.trim()}
          >
            {updateOrg.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Changes"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

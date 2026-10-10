"use client";

import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PermissionsSelector } from "./PermissionsSelector";
import type {
  CustomRole,
  PermissionsResponse,
  PermissionPreset,
} from "../hooks/useCustomRoles";

interface RoleFormDialogProps {
  open: boolean;
  editingRole: CustomRole | null;
  permissionsData: PermissionsResponse | undefined;
  isPending: boolean;
  onSave: (data: {
    name: string;
    description?: string;
    permissions: string[];
  }) => void;
  onClose: () => void;
}

export function RoleFormDialog({
  open,
  editingRole,
  permissionsData,
  isPending,
  onSave,
  onClose,
}: RoleFormDialogProps) {
  const [roleName, setRoleName] = useState("");
  const [roleDescription, setRoleDescription] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    setRoleName(editingRole?.name ?? "");
    setRoleDescription(editingRole?.description ?? "");
    setSelected(new Set(editingRole?.permissions ?? []));
    setExpanded(new Set());
  }, [editingRole, open]);

  const permissionsByCategory =
    permissionsData?.permissions?.reduce(
      (acc, perm) => {
        if (!acc[perm.category]) acc[perm.category] = [];
        acc[perm.category].push(perm);
        return acc;
      },
      {} as Record<string, (typeof permissionsData.permissions)[number][]>,
    ) ?? {};

  function togglePermission(permId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(permId) ? next.delete(permId) : next.add(permId);
      return next;
    });
  }

  function toggleCategory(category: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(category) ? next.delete(category) : next.add(category);
      return next;
    });
  }

  function applyPreset(preset: PermissionPreset) {
    setSelected(new Set(preset.permissions));
  }

  function handleSave() {
    onSave({
      name: roleName,
      description: roleDescription || undefined,
      permissions: Array.from(selected),
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editingRole ? "Edit Role" : "Create Custom Role"}
          </DialogTitle>
          <DialogDescription>
            Define a role with specific permissions for your organization
            members.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="role-name">Role Name</Label>
            <Input
              id="role-name"
              value={roleName}
              onChange={(e) => setRoleName(e.target.value)}
              placeholder="e.g., Security Reviewer"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="role-description">Description (optional)</Label>
            <Textarea
              id="role-description"
              value={roleDescription}
              onChange={(e) => setRoleDescription(e.target.value)}
              placeholder="Describe what this role is for..."
              rows={2}
            />
          </div>

          {permissionsData?.presets && (
            <div className="space-y-2">
              <Label>Quick Presets</Label>
              <div className="flex flex-wrap gap-2">
                {permissionsData.presets.map((preset) => (
                  <Button
                    key={preset.name}
                    variant="outline"
                    size="sm"
                    onClick={() => applyPreset(preset)}
                  >
                    {preset.name}
                  </Button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label>Permissions ({selected.size} selected)</Label>
            <PermissionsSelector
              permissionsByCategory={permissionsByCategory}
              selected={selected}
              expanded={expanded}
              onToggle={togglePermission}
              onToggleCategory={toggleCategory}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!roleName.trim() || selected.size === 0 || isPending}
          >
            {isPending && <Loader2 className="size-4 mr-2 animate-spin" />}
            {editingRole ? "Update Role" : "Create Role"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

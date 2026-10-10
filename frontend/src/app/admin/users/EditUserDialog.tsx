"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Shield, ShieldOff } from "lucide-react";
import type { AdminUser, MemberRole } from "@/features/admin";
import { UserMembershipsSection } from "./UserMembershipsSection";

interface Org {
  id: string;
  name: string;
}

interface EditUserDialogProps {
  open: boolean;
  user: AdminUser | null;
  editName: string;
  editIsSuperAdmin: boolean;
  showAddOrg: boolean;
  newOrgId: string;
  newOrgRole: MemberRole;
  availableOrgs: Org[];
  addIsPending: boolean;
  updateIsPending: boolean;
  onOpenChange: (open: boolean) => void;
  onNameChange: (v: string) => void;
  onSuperAdminChange: (v: boolean) => void;
  onShowAddOrg: () => void;
  onCancelAddOrg: () => void;
  onNewOrgIdChange: (v: string) => void;
  onNewOrgRoleChange: (v: MemberRole) => void;
  onAddToOrg: () => void;
  onRoleChange: (membershipId: string, role: MemberRole) => void;
  onRequestRemove: (membershipId: string, orgName: string) => void;
  onSave: () => void;
}

export function EditUserDialog({
  open,
  user,
  editName,
  editIsSuperAdmin,
  showAddOrg,
  newOrgId,
  newOrgRole,
  availableOrgs,
  addIsPending,
  updateIsPending,
  onOpenChange,
  onNameChange,
  onSuperAdminChange,
  onShowAddOrg,
  onCancelAddOrg,
  onNewOrgIdChange,
  onNewOrgRoleChange,
  onAddToOrg,
  onRoleChange,
  onRequestRemove,
  onSave,
}: EditUserDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit User</DialogTitle>
          <DialogDescription>
            Update user information and permissions.
          </DialogDescription>
        </DialogHeader>
        {user && (
          <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
            <div className="flex items-center gap-4 pb-4 border-b">
              <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center text-lg font-medium text-muted-foreground">
                {user.name?.charAt(0).toUpperCase() || "?"}
              </div>
              <div className="flex-1">
                <p className="font-medium">{user.email}</p>
                <p className="text-sm text-muted-foreground">
                  Created {new Date(user.createdAt).toLocaleDateString()}
                </p>
              </div>
              {user.isSuperAdmin && (
                <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                  <Shield className="h-3 w-3 mr-1" />
                  Super Admin
                </Badge>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="editName">Name</Label>
              <Input
                id="editName"
                value={editName}
                onChange={(e) => onNameChange(e.target.value)}
                placeholder="User name"
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div className="flex items-center gap-3">
                {editIsSuperAdmin ? (
                  <Shield className="h-5 w-5 text-amber-600" />
                ) : (
                  <ShieldOff className="h-5 w-5 text-muted-foreground" />
                )}
                <div>
                  <p className="font-medium text-sm">Super Admin</p>
                  <p className="text-xs text-muted-foreground">
                    Full access to all admin features
                  </p>
                </div>
              </div>
              <Switch
                checked={editIsSuperAdmin}
                onCheckedChange={onSuperAdminChange}
              />
            </div>

            <UserMembershipsSection
              memberships={user.memberships}
              availableOrgs={availableOrgs}
              showAddOrg={showAddOrg}
              newOrgId={newOrgId}
              newOrgRole={newOrgRole}
              addIsPending={addIsPending}
              onShowAddOrg={onShowAddOrg}
              onCancelAddOrg={onCancelAddOrg}
              onNewOrgIdChange={onNewOrgIdChange}
              onNewOrgRoleChange={onNewOrgRoleChange}
              onAddToOrg={onAddToOrg}
              onRoleChange={onRoleChange}
              onRequestRemove={onRequestRemove}
            />

            {user.lastLoginAt && (
              <div className="text-sm text-muted-foreground pt-2 border-t">
                Last login: {new Date(user.lastLoginAt).toLocaleString()}
              </div>
            )}
          </div>
        )}
        <div className="flex justify-end gap-3 pt-2 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={onSave}
            disabled={!editName.trim() || updateIsPending}
          >
            {updateIsPending ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

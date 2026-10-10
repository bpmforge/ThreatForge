"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, X } from "lucide-react";
import type { MemberRole } from "@/features/admin";

interface Org {
  id: string;
  name: string;
}

interface Membership {
  id: string;
  organizationId: string;
  organizationName: string;
  role: MemberRole;
}

interface UserMembershipsSectionProps {
  memberships: Membership[];
  availableOrgs: Org[];
  showAddOrg: boolean;
  newOrgId: string;
  newOrgRole: MemberRole;
  addIsPending: boolean;
  onShowAddOrg: () => void;
  onCancelAddOrg: () => void;
  onNewOrgIdChange: (v: string) => void;
  onNewOrgRoleChange: (v: MemberRole) => void;
  onAddToOrg: () => void;
  onRoleChange: (membershipId: string, role: MemberRole) => void;
  onRequestRemove: (membershipId: string, orgName: string) => void;
}

export function UserMembershipsSection({
  memberships,
  availableOrgs,
  showAddOrg,
  newOrgId,
  newOrgRole,
  addIsPending,
  onShowAddOrg,
  onCancelAddOrg,
  onNewOrgIdChange,
  onNewOrgRoleChange,
  onAddToOrg,
  onRoleChange,
  onRequestRemove,
}: UserMembershipsSectionProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label>Organization Memberships</Label>
        {availableOrgs.length > 0 && !showAddOrg && (
          <Button variant="ghost" size="sm" onClick={onShowAddOrg}>
            <Plus className="h-4 w-4 mr-1" />
            Add
          </Button>
        )}
      </div>

      {showAddOrg && (
        <div className="p-3 rounded-lg border border-dashed space-y-3">
          <div className="space-y-2">
            <Label className="text-xs">Organization</Label>
            <Select value={newOrgId} onValueChange={onNewOrgIdChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select organization" />
              </SelectTrigger>
              <SelectContent>
                {availableOrgs.map((org) => (
                  <SelectItem key={org.id} value={org.id}>
                    {org.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Role</Label>
            <Select
              value={newOrgRole}
              onValueChange={(v) => onNewOrgRoleChange(v as MemberRole)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="VIEWER">Viewer</SelectItem>
                <SelectItem value="EDITOR">Editor</SelectItem>
                <SelectItem value="ADMIN">Admin</SelectItem>
                <SelectItem value="OWNER">Owner</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={onAddToOrg}
              disabled={!newOrgId || addIsPending}
            >
              {addIsPending ? "Adding..." : "Add to Organization"}
            </Button>
            <Button size="sm" variant="ghost" onClick={onCancelAddOrg}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {memberships.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">
            No organization memberships
          </p>
        ) : (
          memberships.map((m) => (
            <div
              key={m.id}
              className="flex items-center gap-3 p-2 rounded-lg bg-muted/50"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {m.organizationName}
                </p>
              </div>
              <Select
                value={m.role}
                onValueChange={(v) => onRoleChange(m.id, v as MemberRole)}
              >
                <SelectTrigger className="w-28 h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="VIEWER">Viewer</SelectItem>
                  <SelectItem value="EDITOR">Editor</SelectItem>
                  <SelectItem value="ADMIN">Admin</SelectItem>
                  <SelectItem value="OWNER">Owner</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                onClick={() => onRequestRemove(m.id, m.organizationName)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

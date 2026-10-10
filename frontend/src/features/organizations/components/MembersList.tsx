/**
 * Organization members list with role management
 */
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { useUpdateMemberRole, useRemoveMember } from "../hooks/useOrganization";
import {
  MEMBER_ROLES,
  canManageMembers,
  canAssignRole,
  type OrganizationMember,
  type MemberRole,
} from "../types";

import type { Organization } from "../types";

interface Props {
  organization: Organization;
  currentUserRole: MemberRole;
  currentUserId?: string;
}

export function MembersList({
  organization,
  currentUserRole,
  currentUserId,
}: Props) {
  const orgId = organization.id;
  const members = organization.memberships;
  const [removingMember, setRemovingMember] =
    useState<OrganizationMember | null>(null);
  const updateRoleMutation = useUpdateMemberRole(orgId);
  const removeMutation = useRemoveMember(orgId);

  const canManage = canManageMembers(currentUserRole);

  function handleRoleChange(memberId: string, newRole: MemberRole) {
    updateRoleMutation.mutate({ memberId, role: newRole });
  }

  function handleRemove() {
    if (!removingMember) return;
    removeMutation.mutate(removingMember.id, {
      onSuccess: () => setRemovingMember(null),
    });
  }

  function canEditMember(member: OrganizationMember): boolean {
    if (!canManage) return false;
    if (member.userId === currentUserId) return false;
    if (member.role === "OWNER") return false;
    return canAssignRole(currentUserRole, member.role);
  }

  return (
    <div className="space-y-2">
      {members.map((member) => (
        <div
          key={member.id}
          className="flex items-center justify-between p-3 rounded-lg border bg-card"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-sm font-medium">
              {member.user.name?.charAt(0).toUpperCase() || "?"}
            </div>
            <div>
              <p className="text-sm font-medium">
                {member.user.name}
                {member.userId === currentUserId && (
                  <span className="ml-2 text-xs text-muted-foreground">
                    (you)
                  </span>
                )}
              </p>
              <p className="text-xs text-muted-foreground">
                {member.user.email}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {canEditMember(member) ? (
              <Select
                value={member.role}
                onValueChange={(v) =>
                  handleRoleChange(member.id, v as MemberRole)
                }
                disabled={updateRoleMutation.isPending}
              >
                <SelectTrigger className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MEMBER_ROLES.filter((r) =>
                    canAssignRole(currentUserRole, r.value),
                  ).map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <span className="text-sm text-muted-foreground w-28 text-center">
                {MEMBER_ROLES.find((r) => r.value === member.role)?.label}
              </span>
            )}

            {canEditMember(member) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setRemovingMember(member)}
                disabled={removeMutation.isPending}
              >
                Remove
              </Button>
            )}
          </div>
        </div>
      ))}

      <AlertDialog
        open={!!removingMember}
        onOpenChange={() => setRemovingMember(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Member</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove {removingMember?.user.name} from
              this organization? They will lose access to all projects.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemove}>Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

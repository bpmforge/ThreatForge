"use client";

import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { UsersTable } from "@/features/admin";
import { useAdminUsers } from "./useAdminUsers";
import { InviteUserDialog } from "./InviteUserDialog";
import { EditUserDialog } from "./EditUserDialog";

export default function AdminUsersPage() {
  const m = useAdminUsers();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Users</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage user accounts and permissions
          </p>
        </div>
        <Button onClick={() => m.setIsInviteOpen(true)}>
          <UserPlus className="h-4 w-4 mr-2" />
          Invite User
        </Button>
      </div>

      <UsersTable onUserSelect={m.handleUserSelect} />

      <InviteUserDialog
        open={m.isInviteOpen}
        orgs={m.orgsData?.organizations ?? []}
        email={m.inviteEmail}
        role={m.inviteRole}
        orgId={m.inviteOrgId}
        isPending={m.inviteUser.isPending}
        onOpenChange={m.setIsInviteOpen}
        onEmailChange={m.setInviteEmail}
        onRoleChange={m.setInviteRole}
        onOrgChange={m.setInviteOrgId}
        onSubmit={m.handleInvite}
      />

      <EditUserDialog
        open={m.isEditOpen}
        user={m.selectedUser}
        editName={m.editName}
        editIsSuperAdmin={m.editIsSuperAdmin}
        showAddOrg={m.showAddOrg}
        newOrgId={m.newOrgId}
        newOrgRole={m.newOrgRole}
        availableOrgs={m.availableOrgs}
        addIsPending={m.addMembership.isPending}
        updateIsPending={m.updateUser.isPending}
        onOpenChange={m.setIsEditOpen}
        onNameChange={m.setEditName}
        onSuperAdminChange={m.setEditIsSuperAdmin}
        onShowAddOrg={() => m.setShowAddOrg(true)}
        onCancelAddOrg={() => {
          m.setShowAddOrg(false);
          m.setNewOrgId("");
          m.setNewOrgRole("VIEWER");
        }}
        onNewOrgIdChange={m.setNewOrgId}
        onNewOrgRoleChange={m.setNewOrgRole}
        onAddToOrg={m.handleAddToOrg}
        onRoleChange={m.handleRoleChange}
        onRequestRemove={(membershipId, orgName) =>
          m.setRemoveConfirm({ membershipId, orgName })
        }
        onSave={m.handleUpdateUser}
      />

      <AlertDialog
        open={!!m.removeConfirm}
        onOpenChange={() => m.setRemoveConfirm(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove from Organization?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this user from &quot;
              {m.removeConfirm?.orgName}&quot;? They will lose access to all
              resources in this organization.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={m.handleRemoveFromOrg}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

"use client";

import { Shield, Loader2, Plus, Pencil, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { useCustomRoles } from "../hooks/useCustomRoles";
import { RoleFormDialog } from "./RoleFormDialog";

interface CustomRolesManagerProps {
  orgId: string;
  canEdit: boolean;
}

export function CustomRolesManager({
  orgId,
  canEdit,
}: CustomRolesManagerProps) {
  const r = useCustomRoles(orgId);

  if (r.isLoading) {
    return (
      <Card>
        <CardContent className="py-12 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  const dialogOpen = r.showCreateDialog || r.editingRole !== null;
  const isPending = r.createMutation.isPending || r.updateMutation.isPending;

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Shield className="size-5" />
                Custom Roles
              </CardTitle>
              <CardDescription>
                Create custom roles with fine-grained permissions for your
                organization.
              </CardDescription>
            </div>
            {canEdit && (
              <Button onClick={() => r.setShowCreateDialog(true)}>
                <Plus className="size-4 mr-2" />
                Create Role
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {r.roles?.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Shield className="size-12 mx-auto mb-4 opacity-50" />
              <p>No custom roles defined.</p>
              {canEdit && (
                <p className="text-sm mt-2">
                  Create custom roles to give members specific permissions.
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {r.roles?.map((role) => (
                <div
                  key={role.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium">{role.name}</h4>
                      {role.isSystem && (
                        <Badge variant="secondary" className="text-xs">
                          System
                        </Badge>
                      )}
                    </div>
                    {role.description && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {role.description}
                      </p>
                    )}
                    <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Users className="size-3" />
                        {role.memberCount} member
                        {role.memberCount !== 1 ? "s" : ""}
                      </span>
                      <span>{role.permissions.length} permissions</span>
                    </div>
                  </div>
                  {canEdit && !role.isSystem && (
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => r.setEditingRole(role)}
                        aria-label={`Edit role ${role.name}`}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => r.setDeletingRole(role)}
                        disabled={role.memberCount > 0}
                        aria-label={`Delete role ${role.name}`}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <RoleFormDialog
        open={dialogOpen}
        editingRole={r.editingRole}
        permissionsData={r.permissionsData}
        isPending={isPending}
        onSave={r.handleSave}
        onClose={() => {
          r.setShowCreateDialog(false);
          r.setEditingRole(null);
        }}
      />

      <AlertDialog
        open={!!r.deletingRole}
        onOpenChange={() => r.setDeletingRole(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Custom Role</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the role &quot;
              {r.deletingRole?.name}&quot;? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                r.deletingRole && r.deleteMutation.mutate(r.deletingRole.id)
              }
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {r.deleteMutation.isPending && (
                <Loader2 className="size-4 mr-2 animate-spin" />
              )}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

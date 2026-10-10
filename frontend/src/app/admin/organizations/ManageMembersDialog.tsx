"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Button } from "@/components/ui/button";
import { Users, Loader2 } from "lucide-react";
import type { MemberRole } from "@/features/admin";
import { useManageMembers } from "./useManageMembers";
import { AvailableUsersPanel } from "./AvailableUsersPanel";
import { CurrentMembersPanel } from "./CurrentMembersPanel";

interface ManageMembersDialogProps {
  orgId: string;
  onClose: () => void;
}

export function ManageMembersDialog({
  orgId,
  onClose,
}: ManageMembersDialogProps) {
  const m = useManageMembers(orgId);

  return (
    <>
      <Dialog open onOpenChange={onClose}>
        <DialogContent className="sm:max-w-5xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Manage Members - {m.org?.name}
            </DialogTitle>
            <DialogDescription>
              Select multiple users to add or remove from this organization
            </DialogDescription>
          </DialogHeader>

          {m.isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <AvailableUsersPanel
                availableUsers={m.availableUsers}
                selectedToAdd={m.selectedToAdd}
                addRole={m.addRole}
                search={m.searchAvailable}
                isProcessing={m.isProcessing}
                addMemberIsPending={m.addMemberIsPending}
                onSearchChange={m.setSearchAvailable}
                onToggleSelectAll={m.toggleSelectAllAvailable}
                onToggleUser={m.toggleAddSelection}
                onRoleChange={(role) => m.setAddRole(role as MemberRole)}
                onAdd={m.handleBulkAdd}
              />
              <CurrentMembersPanel
                members={m.filteredMembers}
                totalCount={m.org?.members?.length || 0}
                selectedToRemove={m.selectedToRemove}
                search={m.searchMembers}
                isProcessing={m.isProcessing}
                onSearchChange={m.setSearchMembers}
                onToggleSelectAll={m.toggleSelectAllMembers}
                onToggleMember={m.toggleRemoveSelection}
                onRoleChange={m.handleRoleChange}
                onRequestRemove={() => m.setConfirmRemove(true)}
              />
            </div>
          )}

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={onClose}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={m.confirmRemove} onOpenChange={m.setConfirmRemove}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Remove {m.selectedToRemove.size} Member
              {m.selectedToRemove.size > 1 ? "s" : ""}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove {m.selectedToRemove.size} member
              {m.selectedToRemove.size > 1 ? "s" : ""} from this organization?
              They will lose access to all organization projects.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={m.isProcessing}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={m.handleBulkRemove}
              disabled={m.isProcessing}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {m.isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Removing...
                </>
              ) : (
                "Remove"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

"use client";

import { useState } from "react";
import { Users, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  MembersList,
  InviteMemberDialog,
  canManageMembers,
} from "@/features/organizations";
import type { Organization, MemberRole } from "@/features/organizations";

interface OrgMembersTabProps {
  org: Organization;
  currentUserRole: MemberRole;
  currentUserId?: string;
}

export function OrgMembersTab({
  org,
  currentUserRole,
  currentUserId,
}: OrgMembersTabProps) {
  const [showInviteDialog, setShowInviteDialog] = useState(false);

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="size-5" />
                Members
              </CardTitle>
              <CardDescription>
                View and manage organization members.
              </CardDescription>
            </div>
            {canManageMembers(currentUserRole) && (
              <Button onClick={() => setShowInviteDialog(true)}>
                <UserPlus className="size-4 mr-2" />
                Invite Member
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <MembersList
            organization={org}
            currentUserRole={currentUserRole}
            currentUserId={currentUserId}
          />
        </CardContent>
      </Card>
      <InviteMemberDialog
        orgId={org.id}
        currentUserRole={currentUserRole}
        open={showInviteDialog}
        onOpenChange={setShowInviteDialog}
      />
    </>
  );
}

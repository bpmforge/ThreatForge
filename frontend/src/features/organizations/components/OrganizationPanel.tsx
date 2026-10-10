/**
 * Main organization management panel
 */
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useOrganization, useCurrentUserRole } from "../hooks/useOrganization";
import { canManageMembers } from "../types";
import { MembersList } from "./MembersList";
import { OrganizationSettings } from "./OrganizationSettings";
import { AuditLog } from "./AuditLog";
import { InviteMemberDialog } from "./InviteMemberDialog";

interface Props {
  orgId: string;
  currentUserId: string;
}

export function OrganizationPanel({ orgId, currentUserId }: Props) {
  const [inviteOpen, setInviteOpen] = useState(false);
  const { data: org, isLoading, error } = useOrganization(orgId);
  const userRole = useCurrentUserRole(org, currentUserId);

  if (isLoading) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Loading organization...</p>
      </div>
    );
  }

  if (error || !org) {
    return (
      <div className="p-6">
        <p className="text-destructive">Failed to load organization</p>
      </div>
    );
  }

  if (!userRole) {
    return (
      <div className="p-6">
        <p className="text-destructive">
          You are not a member of this organization
        </p>
      </div>
    );
  }

  const canManage = canManageMembers(userRole);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{org.name}</h1>
          <p className="text-muted-foreground">Organization Settings</p>
        </div>
        {canManage && (
          <Button onClick={() => setInviteOpen(true)}>Invite Member</Button>
        )}
      </div>

      <Tabs defaultValue="members">
        <TabsList>
          <TabsTrigger value="members">Members</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
          {canManage && <TabsTrigger value="audit">Audit Log</TabsTrigger>}
        </TabsList>

        <TabsContent value="members" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Team Members ({org.memberships.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <MembersList
                organization={org}
                currentUserRole={userRole}
                currentUserId={currentUserId}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="mt-4">
          <OrganizationSettings
            key={org.id}
            organization={org}
            currentUserRole={userRole}
          />
        </TabsContent>

        {canManage && (
          <TabsContent value="audit" className="mt-4">
            <AuditLog orgId={orgId} />
          </TabsContent>
        )}
      </Tabs>

      <InviteMemberDialog
        orgId={orgId}
        currentUserRole={userRole}
        open={inviteOpen}
        onOpenChange={setInviteOpen}
      />
    </div>
  );
}

"use client";

import { Bot } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { canEditSettings } from "@/features/organizations";
import { AIProvidersSettings, AIUsageSummary } from "@/features/settings";
import type { MemberRole } from "@/features/organizations";

interface OrgAIProvidersTabProps {
  orgId: string;
  currentUserRole: MemberRole;
}

export function OrgAIProvidersTab({
  orgId,
  currentUserRole,
}: OrgAIProvidersTabProps) {
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="size-5" />
            AI Providers
          </CardTitle>
          <CardDescription>
            Configure AI providers for threat suggestions and chat features.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AIProvidersSettings
            orgId={orgId}
            canEdit={canEditSettings(currentUserRole)}
          />
        </CardContent>
      </Card>
      {canEditSettings(currentUserRole) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">AI Usage</CardTitle>
            <CardDescription>
              Track AI usage across your organization.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AIUsageSummary orgId={orgId} />
          </CardContent>
        </Card>
      )}
    </>
  );
}

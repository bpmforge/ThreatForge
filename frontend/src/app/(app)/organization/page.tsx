"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { Building2, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollableTabs } from "@/components/ui/scrollable-tabs";
import { AppHeader, type BreadcrumbItem } from "@/components/layout";
import { useCurrentOrgId } from "@/stores/org-store";
import { useOrganization, useCurrentUserRole } from "@/features/organizations";
import { OrgAIPromptsTab } from "./OrgAIPromptsTab";
import { OrgMembersTab } from "./OrgMembersTab";
import { OrgTabRenderer } from "./OrgTabRenderer";

const ORG_TABS = [
  { key: "general", label: "General" },
  { key: "members", label: "Members" },
  { key: "roles", label: "Roles" },
  { key: "ai-providers", label: "AI Providers" },
  { key: "ai-prompts", label: "AI Prompts" },
  { key: "activity", label: "Activity" },
  { key: "usage", label: "Usage" },
  { key: "integrations", label: "Integrations" },
  { key: "webhooks", label: "Webhooks" },
  { key: "sso", label: "SSO" },
  { key: "scim", label: "SCIM" },
  { key: "encryption", label: "Encryption" },
  { key: "customization", label: "Customization" },
  { key: "marketplace", label: "Marketplace" },
];

export default function OrganizationPage() {
  const breadcrumbs: BreadcrumbItem[] = [{ label: "Organization" }];
  const { data: session } = useSession();
  const currentOrgId = useCurrentOrgId();
  const { data: currentOrg, isLoading: isLoadingOrg } = useOrganization(
    currentOrgId ?? undefined,
  );
  const currentUserRole = useCurrentUserRole(currentOrg, session?.user?.id);
  const [activeOrgTab, setActiveOrgTab] = useState("general");

  if (isLoadingOrg) {
    return (
      <>
        <AppHeader breadcrumbs={breadcrumbs} />
        <main className="flex-1 overflow-y-auto">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        </main>
      </>
    );
  }

  if (!currentOrg || !currentUserRole) {
    return (
      <>
        <AppHeader />
        <main className="flex-1 overflow-y-auto">
          <div className="p-6">
            <Card>
              <CardContent className="py-12 text-center">
                <Building2 className="size-12 mx-auto text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">
                  No organization selected. Use the organization switcher in the
                  sidebar.
                </p>
              </CardContent>
            </Card>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <AppHeader />
      <main className="flex-1 overflow-y-auto">
        <div className="p-6 space-y-6 max-w-4xl">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              Organization Settings
            </h1>
            <p className="text-muted-foreground">
              Manage settings for{" "}
              <span className="font-medium">{currentOrg.name}</span>
            </p>
          </div>

          <div className="space-y-6">
            <ScrollableTabs
              tabs={ORG_TABS}
              activeTab={activeOrgTab}
              onTabChange={setActiveOrgTab}
              ariaLabel="Organization settings"
            />

            {activeOrgTab === "members" && (
              <OrgMembersTab
                org={currentOrg}
                currentUserRole={currentUserRole}
                currentUserId={session?.user?.id}
              />
            )}

            {activeOrgTab === "ai-prompts" && (
              <OrgAIPromptsTab orgId={currentOrg.id} />
            )}

            {activeOrgTab !== "members" && activeOrgTab !== "ai-prompts" && (
              <OrgTabRenderer
                activeTab={activeOrgTab}
                org={currentOrg}
                currentUserRole={currentUserRole}
              />
            )}
          </div>
        </div>
      </main>
    </>
  );
}

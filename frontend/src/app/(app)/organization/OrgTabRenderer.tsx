"use client";

import {
  OrganizationSettings,
  AuditLogViewer,
  UsageQuotas,
  WebhookManager,
  SSOSettings,
  SCIMSettings,
  CustomRolesManager,
  canEditSettings,
} from "@/features/organizations";
import { OrgAIProvidersTab } from "./OrgAIProvidersTab";
import {
  CustomCategoriesPanel,
  MitigationLibrariesPanel,
} from "@/features/customization";
import { IntegrationsPanel } from "@/features/integrations";
import { MarketplaceBrowser } from "@/features/marketplace";
import { EncryptionPanel } from "@/features/encryption";
import type { Organization, MemberRole } from "@/features/organizations";

interface OrgTabRendererProps {
  activeTab: string;
  org: Organization;
  currentUserRole: MemberRole;
}

export function OrgTabRenderer({
  activeTab,
  org,
  currentUserRole,
}: OrgTabRendererProps) {
  if (activeTab === "general") {
    return (
      <OrganizationSettings
        key={org.id}
        organization={org}
        currentUserRole={currentUserRole}
      />
    );
  }

  if (activeTab === "usage") {
    return <UsageQuotas orgId={org.id} />;
  }

  if (activeTab === "roles") {
    return (
      <CustomRolesManager
        orgId={org.id}
        canEdit={currentUserRole === "OWNER" || currentUserRole === "ADMIN"}
      />
    );
  }

  if (activeTab === "ai-providers") {
    return (
      <OrgAIProvidersTab orgId={org.id} currentUserRole={currentUserRole} />
    );
  }

  if (activeTab === "webhooks") {
    return (
      <WebhookManager
        orgId={org.id}
        canEdit={canEditSettings(currentUserRole)}
      />
    );
  }

  if (activeTab === "sso") {
    return <SSOSettings orgId={org.id} canEdit={currentUserRole === "OWNER"} />;
  }

  if (activeTab === "scim") {
    return (
      <SCIMSettings
        orgId={org.id}
        canEdit={currentUserRole === "OWNER" || currentUserRole === "ADMIN"}
      />
    );
  }

  if (activeTab === "encryption") {
    return <EncryptionPanel orgId={org.id} />;
  }

  if (activeTab === "activity") {
    return (
      <AuditLogViewer
        organizationId={org.id}
        isOwner={currentUserRole === "OWNER"}
      />
    );
  }

  if (activeTab === "customization") {
    return (
      <>
        <CustomCategoriesPanel orgId={org.id} />
        <MitigationLibrariesPanel orgId={org.id} />
      </>
    );
  }

  if (activeTab === "integrations") {
    return <IntegrationsPanel orgId={org.id} />;
  }

  if (activeTab === "marketplace") {
    return <MarketplaceBrowser orgId={org.id} />;
  }

  return null;
}

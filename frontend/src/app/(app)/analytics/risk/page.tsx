"use client";

import { AppHeader } from "@/components/layout";
import { OrgRiskDashboard } from "@/features/risk-dashboard/components/OrgRiskDashboard";
import { useCurrentOrgId } from "@/stores/org-store";
import { useOrganizations } from "@/features/organizations/hooks/useOrganization";
import { BarChart3 } from "lucide-react";

export default function RiskAnalyticsPage() {
  const orgId = useCurrentOrgId();
  const { data: orgs } = useOrganizations();

  // Fall back to first org if none selected
  const effectiveOrgId = orgId || orgs?.[0]?.id || null;

  return (
    <>
      <AppHeader />
      <main className="flex-1 overflow-y-auto p-6">
        {effectiveOrgId ? (
          <OrgRiskDashboard orgId={effectiveOrgId} />
        ) : (
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
            <div className="rounded-full bg-muted p-4 mb-4">
              <BarChart3 className="h-8 w-8 text-muted-foreground" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight mb-2">
              Risk Analytics
            </h1>
            <p className="text-muted-foreground max-w-md">
              Organization-wide risk metrics and trends will appear here once
              you have threat models with identified threats and mitigations.
            </p>
          </div>
        )}
      </main>
    </>
  );
}

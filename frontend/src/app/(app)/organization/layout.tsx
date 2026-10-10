/**
 * Organization Settings Layout
 *
 * Provides access control for organization settings pages.
 *
 * IMPORTANT: This layout uses useOrgAdminGuard which checks for
 * OWNER or ADMIN role within the currently selected organization.
 * Users without these roles are redirected to the dashboard.
 */
"use client";

import { useOrgAdminGuard } from "@/features/organizations";
import { Loader2 } from "lucide-react";

interface OrganizationLayoutProps {
  children: React.ReactNode;
}

export default function OrganizationLayout({
  children,
}: OrganizationLayoutProps) {
  const { isOrgAdmin, isLoading } = useOrgAdminGuard();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // useOrgAdminGuard handles redirects for non-org-admins
  if (!isOrgAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return <>{children}</>;
}

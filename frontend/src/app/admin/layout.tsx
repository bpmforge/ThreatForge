/**
 * Admin Layout
 *
 * Provides the admin console layout with sidebar navigation.
 *
 * IMPORTANT: This layout uses useSystemAdminGuard which checks ONLY for
 * platform-wide system administrators (isSystemAdmin flag).
 * Organization admins (OWNER/ADMIN roles) do NOT have access here.
 */
"use client";

import { AdminSidebar, useSystemAdminGuard } from "@/features/admin";
import { Loader2 } from "lucide-react";

interface AdminLayoutProps {
  children: React.ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  // CRITICAL: Use useSystemAdminGuard, NOT useAdminGuard
  // This ensures only system admins can access /admin routes
  const { isSystemAdmin, isLoading } = useSystemAdminGuard();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // useSystemAdminGuard handles redirects for non-system-admins
  if (!isSystemAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-muted/50">
      <AdminSidebar />
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}

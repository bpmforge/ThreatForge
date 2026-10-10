/**
 * useOrgAdminGuard - Hook for ORGANIZATION ADMIN permission checks
 *
 * IMPORTANT: This hook checks for ORGANIZATION-LEVEL administrators only.
 * These are users with OWNER or ADMIN roles within the currently selected organization.
 *
 * This is SEPARATE from system-level admins (isSuperAdmin flag).
 * System admins can access /admin console.
 * Organization admins can access /organization settings.
 *
 * Use this hook for /organization/* routes and org-level admin features.
 * For system-level permissions, use useSystemAdminGuard.
 */
"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";
import { useCurrentOrgId } from "@/stores/org-store";

interface OrgAdminGuardResult {
  /** True if user is OWNER or ADMIN of current organization */
  isOrgAdmin: boolean;
  /** True while session or org context is loading */
  isLoading: boolean;
  /** Current user's role in the organization */
  role: "OWNER" | "ADMIN" | "EDITOR" | "VIEWER" | null;
  /** Current organization ID */
  orgId: string | null;
  /** Current user info */
  user: {
    id: string;
    name: string | null;
    email: string | null;
  } | null;
}

/**
 * Check if user has ORGANIZATION ADMIN privileges (OWNER or ADMIN role)
 *
 * Automatically redirects:
 * - To /login if not authenticated
 * - To /dashboard if authenticated but not an org admin
 *
 * @returns Organization admin guard state with user info and loading status
 *
 * @example
 * ```tsx
 * function OrgSettingsPage() {
 *   const { isOrgAdmin, isLoading } = useOrgAdminGuard();
 *
 *   if (isLoading) return <Loading />;
 *   if (!isOrgAdmin) return null; // Redirecting...
 *
 *   return <OrgSettings />;
 * }
 * ```
 */
export function useOrgAdminGuard(): OrgAdminGuardResult {
  const { data: session, status } = useSession();
  const router = useRouter();
  const currentOrgId = useCurrentOrgId();

  // Find user's role in the current organization
  const membership = useMemo(() => {
    if (status === "loading" || !session?.user?.memberships || !currentOrgId) {
      return null;
    }
    if (!Array.isArray(session.user.memberships)) return null;
    return (
      session.user.memberships.find((m) => m.orgId === currentOrgId) ?? null
    );
  }, [session, status, currentOrgId]);

  const role = membership?.role ?? null;

  // Check if user is OWNER or ADMIN of current organization
  const isOrgAdmin = useMemo(() => {
    return role === "OWNER" || role === "ADMIN";
  }, [role]);

  // Handle redirects
  useEffect(() => {
    if (status === "loading") return;

    if (!session) {
      // Not logged in - redirect to login
      router.replace("/login?callbackUrl=/organization");
    } else if (!currentOrgId) {
      // No organization selected - redirect to dashboard
      router.replace("/dashboard");
    } else if (!isOrgAdmin) {
      // Logged in but not an org admin - redirect to dashboard
      router.replace("/dashboard");
    }
  }, [session, status, router, currentOrgId, isOrgAdmin]);

  const user = useMemo(() => {
    if (!session?.user) return null;
    return {
      id: session.user.id ?? "",
      name: session.user.name ?? null,
      email: session.user.email ?? null,
    };
  }, [session]);

  return {
    isOrgAdmin,
    isLoading: status === "loading",
    role,
    orgId: currentOrgId,
    user,
  };
}

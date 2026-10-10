/**
 * useSystemAdminGuard - Hook for SYSTEM ADMIN permission checks
 *
 * IMPORTANT: This hook checks for SYSTEM-LEVEL administrators only.
 * These are platform-wide admins who can access /admin console,
 * manage all users, all organizations, and system settings.
 *
 * This is SEPARATE from organization-level admins (OWNER/ADMIN roles).
 * Organization admins can only manage their own organizations.
 *
 * Use this hook ONLY for /admin/* routes and system-level features.
 * For org-level permissions, use useOrgPermissions or check memberships directly.
 */
"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";

interface SystemAdminGuardResult {
  /** True only if user is a platform-wide system administrator */
  isSystemAdmin: boolean;
  /** True while session is loading */
  isLoading: boolean;
  /** Current user info, null if not authenticated */
  user: {
    id: string;
    name: string | null;
    email: string | null;
    isSystemAdmin: boolean;
  } | null;
}

/**
 * Check if user has SYSTEM ADMIN privileges (not org admin!)
 *
 * Automatically redirects:
 * - To /login if not authenticated
 * - To /dashboard if authenticated but not a system admin
 *
 * @returns System admin guard state with user info and loading status
 *
 * @example
 * ```tsx
 * function AdminPage() {
 *   const { isSystemAdmin, isLoading } = useSystemAdminGuard();
 *
 *   if (isLoading) return <Loading />;
 *   if (!isSystemAdmin) return null; // Redirecting...
 *
 *   return <AdminDashboard />;
 * }
 * ```
 */
export function useSystemAdminGuard(): SystemAdminGuardResult {
  const { data: session, status } = useSession();
  const router = useRouter();

  // Check ONLY for system admin status - NOT org admin roles
  const isSystemAdmin = useMemo(() => {
    if (status === "loading" || !session) return false;
    // isSystemAdmin is set in auth.ts jwt callback
    // This is TRUE only for platform-wide system administrators
    return session.user?.isSystemAdmin === true;
  }, [session, status]);

  // Handle redirects
  useEffect(() => {
    if (status === "loading") return;

    if (!session) {
      // Not logged in - redirect to login
      router.replace("/login?callbackUrl=/admin");
    } else if (!isSystemAdmin) {
      // Logged in but not a system admin - redirect to dashboard
      // This prevents org admins from accessing system admin console
      router.replace("/dashboard");
    }
  }, [session, status, router, isSystemAdmin]);

  const user = useMemo(() => {
    if (!session?.user) return null;
    return {
      id: session.user.id ?? "",
      name: session.user.name ?? null,
      email: session.user.email ?? null,
      isSystemAdmin: session.user.isSystemAdmin === true,
    };
  }, [session]);

  return {
    isSystemAdmin,
    isLoading: status === "loading",
    user,
  };
}

/**
 * useOrgPermissions - Hook for organization-level permission checks
 *
 * Provides utilities for checking user's role within a specific organization.
 * This is separate from system admin checks (useSystemAdminGuard).
 */
"use client";

import { useSession } from "next-auth/react";
import { useMemo } from "react";

type MemberRole = "OWNER" | "ADMIN" | "EDITOR" | "VIEWER";

interface OrgMembership {
  orgId: string;
  orgSlug: string;
  orgName: string;
  role: MemberRole;
}

interface OrgPermissionsResult {
  /** All organizations the user is a member of */
  memberships: OrgMembership[];
  /** True while session is loading */
  isLoading: boolean;
  /** Get user's role in a specific organization */
  getRoleInOrg: (orgId: string) => MemberRole | null;
  /** Check if user is owner of an organization */
  isOwnerOf: (orgId: string) => boolean;
  /** Check if user is admin or owner of an organization */
  isAdminOf: (orgId: string) => boolean;
  /** Check if user can edit in an organization (Editor+) */
  canEditIn: (orgId: string) => boolean;
  /** Check if user has any access to an organization */
  isMemberOf: (orgId: string) => boolean;
  /** Check if user is owner or admin of ANY organization */
  hasAnyOrgAdminRole: boolean;
}

/** Role hierarchy for permission comparisons */
const ROLE_HIERARCHY: Record<MemberRole, number> = {
  OWNER: 4,
  ADMIN: 3,
  EDITOR: 2,
  VIEWER: 1,
};

/**
 * Check organization-level permissions for the current user
 *
 * @returns Object with membership info and permission check utilities
 *
 * @example
 * ```tsx
 * function OrgSettings({ orgId }: { orgId: string }) {
 *   const { isAdminOf, isLoading } = useOrgPermissions();
 *
 *   if (isLoading) return <Loading />;
 *   if (!isAdminOf(orgId)) return <AccessDenied />;
 *
 *   return <SettingsForm />;
 * }
 * ```
 */
export function useOrgPermissions(): OrgPermissionsResult {
  const { data: session, status } = useSession();

  const memberships = useMemo(() => {
    if (!session?.user?.memberships) return [];
    if (!Array.isArray(session.user.memberships)) return [];
    return session.user.memberships;
  }, [session]);

  const getRoleInOrg = useMemo(() => {
    return (orgId: string): MemberRole | null => {
      const membership = memberships.find((m) => m.orgId === orgId);
      return membership?.role ?? null;
    };
  }, [memberships]);

  const hasMinimumRole = useMemo(() => {
    return (orgId: string, minRole: MemberRole): boolean => {
      const role = getRoleInOrg(orgId);
      if (!role) return false;
      return ROLE_HIERARCHY[role] >= ROLE_HIERARCHY[minRole];
    };
  }, [getRoleInOrg]);

  const isOwnerOf = useMemo(() => {
    return (orgId: string): boolean => getRoleInOrg(orgId) === "OWNER";
  }, [getRoleInOrg]);

  const isAdminOf = useMemo(() => {
    return (orgId: string): boolean => hasMinimumRole(orgId, "ADMIN");
  }, [hasMinimumRole]);

  const canEditIn = useMemo(() => {
    return (orgId: string): boolean => hasMinimumRole(orgId, "EDITOR");
  }, [hasMinimumRole]);

  const isMemberOf = useMemo(() => {
    return (orgId: string): boolean => getRoleInOrg(orgId) !== null;
  }, [getRoleInOrg]);

  const hasAnyOrgAdminRole = useMemo(() => {
    return memberships.some((m) => m.role === "OWNER" || m.role === "ADMIN");
  }, [memberships]);

  return {
    memberships,
    isLoading: status === "loading",
    getRoleInOrg,
    isOwnerOf,
    isAdminOf,
    canEditIn,
    isMemberOf,
    hasAnyOrgAdminRole,
  };
}

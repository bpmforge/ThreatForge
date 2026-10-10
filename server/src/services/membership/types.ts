/**
 * Membership Service Types
 */
import type { MemberRole } from "@prisma/client";

export interface UpdateRoleParams {
  membershipId: string;
  /** When set, the membership must belong to this organization (the route's org). */
  organizationId?: string;
  newRole: MemberRole;
  updatingUserId: string;
  updatingUserEmail: string;
}

export interface UpdateRoleResult {
  success: boolean;
  error?: string;
  previousRole?: MemberRole;
  newRole?: MemberRole;
}

export interface RemoveMemberParams {
  membershipId: string;
  /** When set, the membership must belong to this organization (the route's org). */
  organizationId?: string;
  removingUserId: string;
  removingUserEmail: string;
}

export interface RemoveMemberResult {
  success: boolean;
  error?: string;
  removedUserId?: string;
  removedUserEmail?: string;
}

export interface LeaveOrgParams {
  organizationId: string;
  userId: string;
  userEmail: string;
}

export interface LeaveOrgResult {
  success: boolean;
  error?: string;
}

export interface SuspendMemberParams {
  membershipId: string;
  /** When set, the membership must belong to this organization (the route's org). */
  organizationId?: string;
  suspendingUserId: string;
  suspendingUserEmail: string;
  reason?: string;
}

export interface SuspendMemberResult {
  success: boolean;
  error?: string;
  suspendedUserId?: string;
  suspendedUserEmail?: string;
}

export interface UnsuspendMemberParams {
  membershipId: string;
  /** When set, the membership must belong to this organization (the route's org). */
  organizationId?: string;
  unsuspendingUserId: string;
  unsuspendingUserEmail: string;
}

export interface UnsuspendMemberResult {
  success: boolean;
  error?: string;
  unsuspendedUserId?: string;
  unsuspendedUserEmail?: string;
}

export interface GetMembersOptions {
  includeInactive?: boolean;
  limit?: number;
  offset?: number;
}

interface MemberInfo {
  id: string;
  userId: string;
  role: MemberRole;
  status: string;
  joinedAt: string;
  user: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
  };
}

export interface GetMembersResult {
  success: boolean;
  error?: string;
  members?: MemberInfo[];
  total?: number;
  canManageMembers?: boolean;
}

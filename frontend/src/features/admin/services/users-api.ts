/**
 * Admin API — User management
 */

import type {
  AdminUser,
  UpdateUserRequest,
  InviteUserRequest,
  UpdateMembershipRequest,
  AddMembershipRequest,
  MemberRole,
} from "../types";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/api-client";

// =============================================================================
// Users
// =============================================================================

export async function getUsers(params?: {
  search?: string;
  page?: number;
  limit?: number;
}): Promise<{ users: AdminUser[]; total: number }> {
  const searchParams = new URLSearchParams();
  if (params?.search) searchParams.set("search", params.search);
  if (params?.page) searchParams.set("page", params.page.toString());
  if (params?.limit) searchParams.set("limit", params.limit.toString());

  const query = searchParams.toString();
  return apiGet(`/api/admin/users${query ? `?${query}` : ""}`);
}

export async function updateUser(
  userId: string,
  data: UpdateUserRequest,
): Promise<AdminUser> {
  return apiPatch<AdminUser>(`/api/admin/users/${userId}`, data);
}

export async function deleteUser(userId: string): Promise<void> {
  await apiDelete(`/api/admin/users/${userId}`);
}

export async function inviteUser(data: InviteUserRequest): Promise<AdminUser> {
  return apiPost<AdminUser>("/api/admin/users/invite", data);
}

// =============================================================================
// User Memberships
// =============================================================================

export async function addUserMembership(
  userId: string,
  data: AddMembershipRequest,
): Promise<{
  id: string;
  role: MemberRole;
  organizationId: string;
  organizationName: string;
}> {
  return apiPost(`/api/admin/users/${userId}/memberships`, data);
}

export async function updateUserMembership(
  userId: string,
  membershipId: string,
  data: UpdateMembershipRequest,
): Promise<{
  id: string;
  role: MemberRole;
  organizationId: string;
  organizationName: string;
}> {
  return apiPatch(
    `/api/admin/users/${userId}/memberships/${membershipId}`,
    data,
  );
}

export async function removeUserMembership(
  userId: string,
  membershipId: string,
): Promise<void> {
  await apiDelete(`/api/admin/users/${userId}/memberships/${membershipId}`);
}

// =============================================================================
// Bulk User Import
// =============================================================================

interface BulkInviteResult {
  line: number;
  email: string;
  success: boolean;
  error?: string;
  invitationId?: string;
}

export interface BulkInviteResponse {
  success: boolean;
  totalProcessed: number;
  successCount: number;
  failureCount: number;
  results: BulkInviteResult[];
}

export async function bulkInviteUsers(
  csv: string,
): Promise<BulkInviteResponse> {
  return apiPost<BulkInviteResponse>("/api/admin/users/bulk-invite", { csv });
}

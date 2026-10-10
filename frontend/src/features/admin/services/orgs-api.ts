/**
 * Admin API — Organization management
 */

import type {
  AdminOrganization,
  AdminOrganizationDetail,
  AdminOrganizationMember,
  UpdateOrganizationRequest,
  AddOrgMemberRequest,
  MemberRole,
} from "../types";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/api-client";

// =============================================================================
// Organizations
// =============================================================================

export async function getOrganizations(params?: {
  search?: string;
  page?: number;
  limit?: number;
}): Promise<{ organizations: AdminOrganization[]; total: number }> {
  const searchParams = new URLSearchParams();
  if (params?.search) searchParams.set("search", params.search);
  if (params?.page) searchParams.set("page", params.page.toString());
  if (params?.limit) searchParams.set("limit", params.limit.toString());

  const query = searchParams.toString();
  return apiGet(`/api/admin/organizations${query ? `?${query}` : ""}`);
}

export async function updateOrganization(
  orgId: string,
  data: UpdateOrganizationRequest,
): Promise<AdminOrganization> {
  return apiPatch<AdminOrganization>(`/api/admin/organizations/${orgId}`, data);
}

export async function deleteOrganization(orgId: string): Promise<void> {
  await apiDelete(`/api/admin/organizations/${orgId}`);
}

export async function getOrganizationWithMembers(
  orgId: string,
): Promise<AdminOrganizationDetail> {
  return apiGet<AdminOrganizationDetail>(`/api/admin/organizations/${orgId}`);
}

export async function addOrgMember(
  orgId: string,
  data: AddOrgMemberRequest,
): Promise<AdminOrganizationMember> {
  return apiPost(`/api/admin/organizations/${orgId}/members`, data);
}

export async function updateOrgMemberRole(
  orgId: string,
  memberId: string,
  role: MemberRole,
): Promise<AdminOrganizationMember> {
  return apiPatch(`/api/admin/organizations/${orgId}/members/${memberId}`, {
    role,
  });
}

export async function removeOrgMember(
  orgId: string,
  memberId: string,
): Promise<void> {
  await apiDelete(`/api/admin/organizations/${orgId}/members/${memberId}`);
}

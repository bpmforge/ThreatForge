/**
 * Organization API service
 */

import type {
  Organization,
  OrganizationSummary,
  InviteMemberRequest,
  UpdateMemberRoleRequest,
  UpdateOrganizationRequest,
  CreateOrganizationRequest,
  AuditLogEntry,
  OrganizationMember,
} from "../types";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/api-client";

/** Get all organizations for current user */
export async function getOrganizations(): Promise<OrganizationSummary[]> {
  const result = await apiGet<OrganizationSummary[]>("/api/organizations");
  return Array.isArray(result) ? result : [];
}

/** Get organization by ID with full details */
export async function getOrganization(orgId: string): Promise<Organization> {
  return apiGet<Organization>(`/api/organizations/${orgId}`);
}

/** Update organization settings */
export async function updateOrganization(
  orgId: string,
  data: UpdateOrganizationRequest,
): Promise<Organization> {
  return apiPatch<Organization>(`/api/organizations/${orgId}`, data);
}

/** Invite a member to organization */
export async function inviteMember(
  orgId: string,
  data: InviteMemberRequest,
): Promise<{ success: boolean; invitationId: string; message: string }> {
  return apiPost<{ success: boolean; invitationId: string; message: string }>(
    `/api/organizations/${orgId}/invitations`,
    data,
  );
}

/** Update member role */
export async function updateMemberRole(
  orgId: string,
  data: UpdateMemberRoleRequest,
): Promise<OrganizationMember> {
  return apiPatch<OrganizationMember>(
    `/api/organizations/${orgId}/members/${data.memberId}`,
    { role: data.role },
  );
}

/** Remove member from organization */
export async function removeMember(
  orgId: string,
  memberId: string,
): Promise<void> {
  await apiDelete<void>(`/api/organizations/${orgId}/members/${memberId}`);
}

/** Get audit log for organization */
export async function getAuditLog(
  orgId: string,
  options?: { limit?: number; offset?: number },
): Promise<AuditLogEntry[]> {
  const params = new URLSearchParams();
  if (options?.limit) params.set("limit", String(options.limit));
  if (options?.offset) params.set("offset", String(options.offset));
  const query = params.toString() ? `?${params}` : "";
  return apiGet<AuditLogEntry[]>(`/api/organizations/${orgId}/audit${query}`);
}

/** Create a new organization */
export async function createOrganization(
  data: CreateOrganizationRequest,
): Promise<OrganizationSummary> {
  return apiPost<OrganizationSummary>("/api/organizations", data);
}

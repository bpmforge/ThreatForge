/**
 * Organization management hook
 */
"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getErrorMessage } from "@/lib/errors";
import { toast } from "sonner";
import { useSession } from "next-auth/react";
import * as api from "../services/api";
import type {
  Organization,
  InviteMemberRequest,
  UpdateMemberRoleRequest,
  UpdateOrganizationRequest,
  CreateOrganizationRequest,
  MemberRole,
} from "../types";

const QUERY_KEYS = {
  organizations: ["organizations"] as const,
  organization: (id: string) => ["organization", id] as const,
  auditLog: (id: string) => ["organization", id, "audit"] as const,
};

/** Get all organizations for current user */
export function useOrganizations() {
  const { status } = useSession();

  return useQuery({
    queryKey: QUERY_KEYS.organizations,
    queryFn: api.getOrganizations,
    // Only fetch when user is authenticated
    enabled: status === "authenticated",
  });
}

/** Get single organization with full details */
export function useOrganization(orgId: string | undefined) {
  return useQuery({
    queryKey: QUERY_KEYS.organization(orgId!),
    queryFn: () => api.getOrganization(orgId!),
    enabled: !!orgId,
  });
}

/** Get audit log for organization */
export function useAuditLog(orgId: string | undefined) {
  return useQuery({
    queryKey: QUERY_KEYS.auditLog(orgId!),
    queryFn: () => api.getAuditLog(orgId!),
    enabled: !!orgId,
  });
}

/** Update organization settings */
export function useUpdateOrganization(orgId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpdateOrganizationRequest) =>
      api.updateOrganization(orgId, data),
    onSuccess: (updated) => {
      queryClient.setQueryData(QUERY_KEYS.organization(orgId), updated);
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.organizations });
    },
  });
}

/** Invite member to organization */
export function useInviteMember(orgId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: InviteMemberRequest) => api.inviteMember(orgId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.organization(orgId),
      });
    },
  });
}

/** Update member role */
export function useUpdateMemberRole(orgId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpdateMemberRoleRequest) =>
      api.updateMemberRole(orgId, data),
    onError: (err) =>
      toast.error(getErrorMessage(err, "Could not change the member's role")),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.organization(orgId),
      });
    },
  });
}

/** Remove member from organization */
export function useRemoveMember(orgId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (memberId: string) => api.removeMember(orgId, memberId),
    onError: (err) =>
      toast.error(getErrorMessage(err, "Could not remove the member")),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.organization(orgId),
      });
    },
  });
}

/** Get current user's role in organization */
export function useCurrentUserRole(
  org: Organization | undefined,
  userId: string | undefined,
): MemberRole | undefined {
  if (!org || !userId) return undefined;
  const membership = org.memberships.find((m) => m.userId === userId);
  return membership?.role;
}

/** Create a new organization */
export function useCreateOrganization() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateOrganizationRequest) =>
      api.createOrganization(data),
    onSuccess: (newOrg) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.organizations });
      return newOrg;
    },
  });
}

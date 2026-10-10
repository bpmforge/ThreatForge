"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as api from "../services/api";
import type {
  UpdateOrganizationRequest,
  AddOrgMemberRequest,
  MemberRole,
} from "../types";

const KEYS = {
  orgs: (params?: Record<string, unknown>) =>
    ["admin", "organizations", params] as const,
  org: (id: string) => ["admin", "organizations", id] as const,
};

export function useOrganizations(params?: {
  search?: string;
  page?: number;
  limit?: number;
}) {
  return useQuery({
    queryKey: KEYS.orgs(params),
    queryFn: () => api.getOrganizations(params),
  });
}

export function useOrganizationWithMembers(orgId: string) {
  return useQuery({
    queryKey: KEYS.org(orgId),
    queryFn: () => api.getOrganizationWithMembers(orgId),
    enabled: !!orgId,
  });
}

export function useUpdateOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      orgId,
      data,
    }: {
      orgId: string;
      data: UpdateOrganizationRequest;
    }) => api.updateOrganization(orgId, data),
    onSuccess: (updated) => {
      queryClient.setQueryData(KEYS.org(updated.id), updated);
      queryClient.invalidateQueries({ queryKey: ["admin", "organizations"] });
    },
  });
}

export function useDeleteOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.deleteOrganization,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["admin", "organizations"] }),
  });
}

export function useAddOrgMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      orgId,
      data,
    }: {
      orgId: string;
      data: AddOrgMemberRequest;
    }) => api.addOrgMember(orgId, data),
    onSuccess: (_, { orgId }) => {
      queryClient.invalidateQueries({ queryKey: KEYS.org(orgId) });
      queryClient.invalidateQueries({ queryKey: ["admin", "organizations"] });
    },
  });
}

export function useUpdateOrgMemberRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      orgId,
      memberId,
      role,
    }: {
      orgId: string;
      memberId: string;
      role: MemberRole;
    }) => api.updateOrgMemberRole(orgId, memberId, role),
    onSuccess: (_, { orgId }) =>
      queryClient.invalidateQueries({ queryKey: KEYS.org(orgId) }),
  });
}

export function useRemoveOrgMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ orgId, memberId }: { orgId: string; memberId: string }) =>
      api.removeOrgMember(orgId, memberId),
    onSuccess: (_, { orgId }) => {
      queryClient.invalidateQueries({ queryKey: KEYS.org(orgId) });
      queryClient.invalidateQueries({ queryKey: ["admin", "organizations"] });
    },
  });
}

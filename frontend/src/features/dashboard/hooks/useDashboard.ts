/**
 * Dashboard hooks
 */
"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as api from "../services/api";
import type { DashboardFilters, ModelStatus } from "../types";

const QUERY_KEYS = {
  threatModels: (filters?: DashboardFilters) =>
    ["threatModels", filters] as const,
  threatModel: (id: string) => ["threatModel", id] as const,
  dashboardStats: (orgId?: string) => ["dashboardStats", orgId] as const,
  recentActivity: (orgId?: string) => ["recentActivity", orgId] as const,
  projectsAtRisk: (orgId?: string) => ["projectsAtRisk", orgId] as const,
};

/** Get all threat models with optional filters */
export function useThreatModels(filters?: DashboardFilters) {
  return useQuery({
    queryKey: QUERY_KEYS.threatModels(filters),
    queryFn: () => api.getThreatModels(filters),
  });
}

/** Get a single threat model */
export function useThreatModel(id: string | undefined) {
  return useQuery({
    queryKey: QUERY_KEYS.threatModel(id!),
    queryFn: () => api.getThreatModel(id!),
    enabled: !!id,
  });
}

/** Create a new threat model */
export function useCreateThreatModel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      name: string;
      projectId?: string;
      methodology?: string;
    }) => api.createThreatModel(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["threatModels"] });
      queryClient.invalidateQueries({ queryKey: ["dashboardStats"] });
    },
  });
}

/** Delete a threat model */
export function useDeleteThreatModel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.deleteThreatModel(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["threatModels"] });
      queryClient.invalidateQueries({ queryKey: ["dashboardStats"] });
    },
  });
}

/** Get dashboard stats */
export function useDashboardStats(organizationId?: string) {
  return useQuery({
    queryKey: QUERY_KEYS.dashboardStats(organizationId),
    queryFn: () => api.getDashboardStats(organizationId),
  });
}

/** Get recent activity */
export function useRecentActivity(organizationId?: string) {
  return useQuery({
    queryKey: QUERY_KEYS.recentActivity(organizationId),
    queryFn: () => api.getRecentActivity(organizationId),
  });
}

/** Duplicate a threat model */
export function useDuplicateThreatModel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.duplicateThreatModel(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["threatModels"] });
      queryClient.invalidateQueries({ queryKey: ["dashboardStats"] });
    },
  });
}

/** Import a threat model */
export function useImportThreatModel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      name: string;
      canvasState?: { nodes: unknown[]; edges: unknown[] };
      projectId?: string;
    }) => api.importThreatModel(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["threatModels"] });
      queryClient.invalidateQueries({ queryKey: ["dashboardStats"] });
    },
  });
}

/** Move a threat model to a different project */
export function useMoveThreatModel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, projectId }: { id: string; projectId: string }) =>
      api.moveThreatModelToProject(id, projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["threatModels"] });
      queryClient.invalidateQueries({ queryKey: ["recentActivity"] });
    },
  });
}

/** Get detailed stats for a specific threat model */
export function useThreatModelStats(modelId: string | undefined) {
  return useQuery({
    queryKey: ["threatModelStats", modelId] as const,
    queryFn: () => api.getThreatModelStats(modelId!),
    enabled: !!modelId,
  });
}

/** Update model lifecycle status */
export function useUpdateModelStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: ModelStatus }) =>
      api.updateModelStatus(id, status),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["threatModel", variables.id],
      });
      queryClient.invalidateQueries({ queryKey: ["threatModels"] });
    },
  });
}

/** Update model tags */
export function useUpdateModelTags() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, tags }: { id: string; tags: string[] }) =>
      api.updateModelTags(id, tags),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["threatModel", variables.id],
      });
      queryClient.invalidateQueries({ queryKey: ["threatModels"] });
    },
  });
}

/** Get projects at risk - aggregated threat data by project */
export function useProjectsAtRisk(organizationId?: string) {
  return useQuery({
    queryKey: QUERY_KEYS.projectsAtRisk(organizationId),
    queryFn: () => api.getProjectsAtRisk(organizationId),
  });
}

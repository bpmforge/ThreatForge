/**
 * Project management hooks
 */
"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as api from "../services/api";
import type {
  CreateProjectRequest,
  UpdateProjectRequest,
  InviteProjectMemberRequest,
  ProjectFilters,
} from "../types";

const QUERY_KEYS = {
  projects: (filters?: ProjectFilters) => ["projects", filters] as const,
  project: (id: string) => ["project", id] as const,
};

/** Get all projects with optional filters */
export function useProjects(filters?: ProjectFilters) {
  return useQuery({
    queryKey: QUERY_KEYS.projects(filters),
    queryFn: () => api.getProjects(filters),
  });
}

/** Get single project with full details */
export function useProject(projectId: string | undefined) {
  return useQuery({
    queryKey: QUERY_KEYS.project(projectId!),
    queryFn: () => api.getProject(projectId!),
    enabled: !!projectId,
  });
}

/** Create a new project */
export function useCreateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateProjectRequest) => api.createProject(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}

/** Update project */
export function useUpdateProject(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpdateProjectRequest) =>
      api.updateProject(projectId, data),
    onSuccess: (updated) => {
      queryClient.setQueryData(QUERY_KEYS.project(projectId), updated);
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}

/** Delete project */
export function useDeleteProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (projectId: string) => api.deleteProject(projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}

/** Invite member to project */
export function useInviteProjectMember(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: InviteProjectMemberRequest) =>
      api.inviteProjectMember(projectId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.project(projectId),
      });
    },
  });
}

/** Update project member role */
export function useUpdateProjectMemberRole(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ memberId, role }: { memberId: string; role: string }) =>
      api.updateProjectMemberRole(projectId, memberId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.project(projectId),
      });
    },
  });
}

/** Remove member from project */
export function useRemoveProjectMember(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (memberId: string) =>
      api.removeProjectMember(projectId, memberId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.project(projectId),
      });
    },
  });
}

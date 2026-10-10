/**
 * Project API service
 */

import type {
  Project,
  ProjectSummary,
  CreateProjectRequest,
  UpdateProjectRequest,
  InviteProjectMemberRequest,
  ProjectMember,
  ProjectFilters,
} from "../types";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/api-client";

/** Get all projects with optional filters */
export async function getProjects(
  filters?: ProjectFilters,
): Promise<ProjectSummary[]> {
  const params = new URLSearchParams();
  if (filters?.search) params.set("search", filters.search);
  if (filters?.status) params.set("status", filters.status);
  if (filters?.organizationId)
    params.set("organizationId", filters.organizationId);
  if (filters?.sortBy) params.set("sortBy", filters.sortBy);
  if (filters?.sortOrder) params.set("sortOrder", filters.sortOrder);
  const query = params.toString() ? `?${params}` : "";
  // Backend returns { data: [...], pagination: {...} }
  const response = await apiGet<{
    data: ProjectSummary[];
    pagination: unknown;
  }>(`/api/projects${query}`);
  return response.data;
}

/** Get project by ID with full details */
export async function getProject(projectId: string): Promise<Project> {
  return apiGet<Project>(`/api/projects/${projectId}`);
}

/** Create a new project */
export async function createProject(
  data: CreateProjectRequest,
): Promise<Project> {
  return apiPost<Project>("/api/projects", data);
}

/** Update project */
export async function updateProject(
  projectId: string,
  data: UpdateProjectRequest,
): Promise<Project> {
  return apiPatch<Project>(`/api/projects/${projectId}`, data);
}

/** Delete (archive) project */
export async function deleteProject(projectId: string): Promise<void> {
  await apiDelete(`/api/projects/${projectId}`);
}

/** Invite member to project */
export async function inviteProjectMember(
  projectId: string,
  data: InviteProjectMemberRequest,
): Promise<ProjectMember> {
  return apiPost<ProjectMember>(`/api/projects/${projectId}/members`, data);
}

/** Update project member role */
export async function updateProjectMemberRole(
  projectId: string,
  memberId: string,
  role: string,
): Promise<ProjectMember> {
  return apiPatch<ProjectMember>(
    `/api/projects/${projectId}/members/${memberId}`,
    { role },
  );
}

/** Remove member from project */
export async function removeProjectMember(
  projectId: string,
  memberId: string,
): Promise<void> {
  await apiDelete(`/api/projects/${projectId}/members/${memberId}`);
}

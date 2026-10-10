/**
 * Project type definitions
 */

/** Project status */
export type ProjectStatus = "ACTIVE" | "ARCHIVED";

/** Project role levels */
export type ProjectRole = "OWNER" | "EDITOR" | "VIEWER";

/** Project member with user info */
export interface ProjectMember {
  id: string;
  userId: string;
  role: ProjectRole;
  user?: {
    id: string;
    name: string;
    email: string;
    avatarUrl?: string | null;
  };
}

/** Project summary for list view */
export interface ProjectSummary {
  id: string;
  name: string;
  description?: string | null;
  status: ProjectStatus;
  organizationId: string;
  createdById: string;
  createdBy?: {
    id: string;
    name: string;
  };
  threatModelCount: number;
  createdAt: string;
  updatedAt: string;
}

/** Project statistics */
interface ProjectStats {
  totalThreats: number;
  openThreats: number;
  mitigatedThreats: number;
}

/** Full project details */
export interface Project extends ProjectSummary {
  organization?: {
    id: string;
    name: string;
    slug: string;
  };
  projectMembers: ProjectMember[];
  threatModels: {
    id: string;
    name: string;
    version: number;
    updatedAt: string;
    threatCount?: number;
  }[];
  stats?: ProjectStats;
}

/** Create project request */
export interface CreateProjectRequest {
  name: string;
  description?: string;
  organizationId?: string; // Optional - backend will auto-select user's org
}

/** Update project request */
export interface UpdateProjectRequest {
  name?: string;
  description?: string;
  status?: ProjectStatus;
}

/** Invite project member request */
export interface InviteProjectMemberRequest {
  email: string;
  role: ProjectRole;
}

/** Project sort options */
export type ProjectSortField = "name" | "createdAt" | "updatedAt";
export type SortOrder = "asc" | "desc";

/** Project filter options */
export interface ProjectFilters {
  search?: string;
  status?: ProjectStatus;
  organizationId?: string;
  sortBy?: ProjectSortField;
  sortOrder?: SortOrder;
}

/** Check if role can manage project settings */
export function canManageProject(role: ProjectRole): boolean {
  return role === "OWNER";
}

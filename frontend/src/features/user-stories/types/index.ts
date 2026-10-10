/**
 * User Stories Feature - Types
 */

export type UserStoryStatus = "DRAFT" | "READY" | "IN_PROGRESS" | "DONE";

export interface UserStory {
  id: string;
  title: string;
  asA: string;
  iWant: string;
  soThat: string;
  acceptanceCriteria: string[];
  status: UserStoryStatus;
  tags: string[];
  externalId?: string | null;
  projectId: string;
  dataFlows: DataFlowSummary[];
  createdAt: string;
  updatedAt: string;
}

interface DataFlowSummary {
  id: string;
  name: string;
  number?: string | null;
}

export interface UserStoryListResponse {
  data: UserStory[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// Request types
export interface CreateUserStoryRequest {
  title: string;
  asA: string;
  iWant: string;
  soThat: string;
  acceptanceCriteria?: string[];
  status?: UserStoryStatus;
  tags?: string[];
  externalId?: string;
}

export interface UpdateUserStoryRequest {
  title?: string;
  asA?: string;
  iWant?: string;
  soThat?: string;
  acceptanceCriteria?: string[];
  status?: UserStoryStatus;
  tags?: string[];
  externalId?: string | null;
}

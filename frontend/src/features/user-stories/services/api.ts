/**
 * User Stories API client
 */
import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/api-client";
import type {
  UserStory,
  UserStoryListResponse,
  CreateUserStoryRequest,
  UpdateUserStoryRequest,
} from "../types";

export interface ListUserStoriesParams {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
}

export async function getUserStories(
  projectId: string,
  params?: ListUserStoriesParams,
): Promise<UserStoryListResponse> {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set("page", params.page.toString());
  if (params?.limit) searchParams.set("limit", params.limit.toString());
  if (params?.status) searchParams.set("status", params.status);
  if (params?.search) searchParams.set("search", params.search);

  return apiGet<UserStoryListResponse>(
    `/api/projects/${projectId}/user-stories?${searchParams}`,
  );
}

export async function getUserStory(
  projectId: string,
  storyId: string,
): Promise<UserStory> {
  return apiGet<UserStory>(
    `/api/projects/${projectId}/user-stories/${storyId}`,
  );
}

export async function createUserStory(
  projectId: string,
  data: CreateUserStoryRequest,
): Promise<UserStory> {
  return apiPost<UserStory>(`/api/projects/${projectId}/user-stories`, data);
}

export async function updateUserStory(
  projectId: string,
  storyId: string,
  data: UpdateUserStoryRequest,
): Promise<UserStory> {
  return apiPatch<UserStory>(
    `/api/projects/${projectId}/user-stories/${storyId}`,
    data,
  );
}

export async function deleteUserStory(
  projectId: string,
  storyId: string,
): Promise<void> {
  await apiDelete(`/api/projects/${projectId}/user-stories/${storyId}`);
}

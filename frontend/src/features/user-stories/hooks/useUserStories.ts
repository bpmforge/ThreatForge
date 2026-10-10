/**
 * User Stories React Query hooks
 */
"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as api from "../services/api";
import type { CreateUserStoryRequest, UpdateUserStoryRequest } from "../types";

const QUERY_KEYS = {
  userStories: (projectId: string, params?: api.ListUserStoriesParams) =>
    ["userStories", projectId, params] as const,
  userStory: (projectId: string, storyId: string) =>
    ["userStory", projectId, storyId] as const,
};

export function useUserStories(
  projectId: string | undefined,
  params?: api.ListUserStoriesParams,
) {
  return useQuery({
    queryKey: QUERY_KEYS.userStories(projectId!, params),
    queryFn: () => api.getUserStories(projectId!, params),
    enabled: !!projectId,
  });
}

export function useUserStory(
  projectId: string | undefined,
  storyId: string | undefined,
) {
  return useQuery({
    queryKey: QUERY_KEYS.userStory(projectId!, storyId!),
    queryFn: () => api.getUserStory(projectId!, storyId!),
    enabled: !!projectId && !!storyId,
  });
}

export function useCreateUserStory(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateUserStoryRequest) =>
      api.createUserStory(projectId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["userStories", projectId],
        exact: false,
      });
    },
  });
}

export function useUpdateUserStory(projectId: string, storyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateUserStoryRequest) =>
      api.updateUserStory(projectId, storyId, data),
    onSuccess: (updated) => {
      queryClient.setQueryData(
        QUERY_KEYS.userStory(projectId, storyId),
        updated,
      );
      queryClient.invalidateQueries({
        queryKey: ["userStories", projectId],
        exact: false,
      });
    },
  });
}

export function useDeleteUserStory(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (storyId: string) => api.deleteUserStory(projectId, storyId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["userStories", projectId],
        exact: false,
      });
    },
  });
}

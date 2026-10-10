"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPatch } from "@/lib/api-client";
import type { TutorialProgress } from "../types";

interface UserPreferences {
  tutorials?: TutorialProgress;
}

async function fetchPreferences(): Promise<UserPreferences> {
  try {
    return await apiGet<UserPreferences>("/api/users/me/preferences");
  } catch {
    return {};
  }
}

function updatePreferences(
  updates: Partial<UserPreferences>,
): Promise<UserPreferences> {
  return apiPatch<UserPreferences>("/api/users/me/preferences", updates);
}

export function useTutorialProgress() {
  const queryClient = useQueryClient();

  const { data: preferences, isLoading } = useQuery({
    queryKey: ["user-preferences"],
    queryFn: fetchPreferences,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  const saveMutation = useMutation({
    mutationFn: (progress: TutorialProgress) =>
      updatePreferences({ tutorials: progress }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-preferences"] });
    },
  });

  const progress: TutorialProgress = preferences?.tutorials || {
    started: false,
    completed: false,
    currentCategory: 0,
    quizAnswers: {},
    correctCount: 0,
  };

  const saveProgress = (updates: Partial<TutorialProgress>) => {
    saveMutation.mutate({ ...progress, ...updates });
  };

  const markTutorialCompleted = (correctCount: number) => {
    saveMutation.mutate({
      ...progress,
      completed: true,
      correctCount,
    });
  };

  const resetProgress = () => {
    saveMutation.mutate({
      started: false,
      completed: false,
      currentCategory: 0,
      quizAnswers: {},
      correctCount: 0,
    });
  };

  return {
    progress,
    isLoading,
    isSaving: saveMutation.isPending,
    saveProgress,
    markTutorialCompleted,
    resetProgress,
    isCompleted: progress.completed,
  };
}

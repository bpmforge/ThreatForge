/**
 * usePrompts Hook - Manage prompt templates
 */
"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import * as api from "../services/api";
import type {
  CreatePromptInput,
  UpdatePromptInput,
  PromptCategory,
} from "../types";

const PROMPTS_KEY = "prompts";

export function usePrompts(
  orgId: string | undefined,
  category?: PromptCategory,
) {
  return useQuery({
    queryKey: [PROMPTS_KEY, orgId, category],
    queryFn: () =>
      orgId ? api.getPrompts(orgId, category) : Promise.resolve([]),
    enabled: !!orgId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useBuiltInPrompts() {
  return useQuery({
    queryKey: [PROMPTS_KEY, "builtin"],
    queryFn: api.getBuiltInPrompts,
    staleTime: 30 * 60 * 1000, // 30 minutes - built-ins rarely change
  });
}

export function usePrompt(
  orgId: string | undefined,
  promptId: string | undefined,
) {
  return useQuery({
    queryKey: [PROMPTS_KEY, orgId, promptId],
    queryFn: () =>
      orgId && promptId
        ? api.getPrompt(orgId, promptId)
        : Promise.reject("Missing IDs"),
    enabled: !!orgId && !!promptId,
  });
}

export function useCreatePrompt(orgId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreatePromptInput) => api.createPrompt(orgId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PROMPTS_KEY, orgId] });
      toast.success("Prompt created successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to create prompt: ${error.message}`);
    },
  });
}

export function useClonePrompt(orgId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ promptId, name }: { promptId: string; name?: string }) =>
      api.clonePrompt(orgId, promptId, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PROMPTS_KEY, orgId] });
      toast.success("Prompt cloned successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to clone prompt: ${error.message}`);
    },
  });
}

export function useUpdatePrompt(orgId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      promptId,
      input,
    }: {
      promptId: string;
      input: UpdatePromptInput;
    }) => api.updatePrompt(orgId, promptId, input),
    onSuccess: (_, { promptId }) => {
      queryClient.invalidateQueries({ queryKey: [PROMPTS_KEY, orgId] });
      queryClient.invalidateQueries({
        queryKey: [PROMPTS_KEY, orgId, promptId],
      });
      toast.success("Prompt updated successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to update prompt: ${error.message}`);
    },
  });
}

export function useDeletePrompt(orgId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (promptId: string) => api.deletePrompt(orgId, promptId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PROMPTS_KEY, orgId] });
      toast.success("Prompt deleted successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete prompt: ${error.message}`);
    },
  });
}

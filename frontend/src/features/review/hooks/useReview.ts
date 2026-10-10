"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost } from "@/lib/api-client";
import type {
  ReviewRequest,
  ReviewDecision,
  ReviewerRole,
  ReviewPriority,
  ReviewType,
  ReviewActivity,
} from "../types";

// Fetch reviews for a threat model
async function fetchModelReviews(modelId: string): Promise<ReviewRequest[]> {
  return apiGet<ReviewRequest[]>(`/api/threat-models/${modelId}/reviews`);
}

// Fetch user's pending reviews
async function fetchPendingReviews(): Promise<ReviewRequest[]> {
  return apiGet<ReviewRequest[]>("/api/reviews/pending");
}

// Fetch review activity
async function fetchReviewActivity(
  reviewId: string,
): Promise<ReviewActivity[]> {
  return apiGet<ReviewActivity[]>(`/api/reviews/${reviewId}/activity`);
}

export function useModelReviews(modelId: string | undefined) {
  return useQuery({
    queryKey: ["reviews", "model", modelId],
    queryFn: () => fetchModelReviews(modelId!),
    enabled: !!modelId,
  });
}

export function usePendingReviews() {
  return useQuery({
    queryKey: ["reviews", "pending"],
    queryFn: fetchPendingReviews,
  });
}

export function useReviewActivity(reviewId: string | undefined) {
  return useQuery({
    queryKey: ["review", reviewId, "activity"],
    queryFn: () => fetchReviewActivity(reviewId!),
    enabled: !!reviewId,
  });
}

interface CreateReviewParams {
  threatModelId: string;
  reviewers: Array<{ userId: string; role: ReviewerRole; required: boolean }>;
  dueDate?: string;
  priority?: ReviewPriority;
  reviewType?: ReviewType;
  description?: string;
  scope?: string;
}

interface SubmitDecisionParams {
  reviewId: string;
  decision: ReviewDecision;
  comments?: string;
}

interface AddCommentParams {
  reviewId: string;
  content: string;
  category?: string;
  referencedItemType?: string;
  referencedItemId?: string;
  parentCommentId?: string;
}

export function useReviewMutations() {
  const queryClient = useQueryClient();

  const createReviewMutation = useMutation({
    mutationFn: async (params: CreateReviewParams) => {
      return apiPost<ReviewRequest>("/api/reviews", params);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["reviews"] });
      queryClient.invalidateQueries({
        queryKey: ["reviews", "model", data.threatModelId],
      });
    },
  });

  const startReviewMutation = useMutation({
    mutationFn: async (reviewId: string) => {
      return apiPost(`/api/reviews/${reviewId}/start`);
    },
    onSuccess: (_, reviewId) => {
      queryClient.invalidateQueries({ queryKey: ["review", reviewId] });
      queryClient.invalidateQueries({ queryKey: ["reviews"] });
    },
  });

  const submitDecisionMutation = useMutation({
    mutationFn: async ({
      reviewId,
      decision,
      comments,
    }: SubmitDecisionParams) => {
      return apiPost(`/api/reviews/${reviewId}/decision`, {
        decision,
        comments,
      });
    },
    onSuccess: (_, { reviewId }) => {
      queryClient.invalidateQueries({ queryKey: ["review", reviewId] });
      queryClient.invalidateQueries({ queryKey: ["reviews"] });
    },
  });

  const addCommentMutation = useMutation({
    mutationFn: async ({ reviewId, ...params }: AddCommentParams) => {
      return apiPost(`/api/reviews/${reviewId}/comments`, params);
    },
    onSuccess: (_, { reviewId }) => {
      queryClient.invalidateQueries({ queryKey: ["review", reviewId] });
    },
  });

  const resolveCommentMutation = useMutation({
    mutationFn: async ({
      reviewId,
      commentId,
    }: {
      reviewId: string;
      commentId: string;
    }) => {
      return apiPost(`/api/reviews/${reviewId}/comments/${commentId}/resolve`);
    },
    onSuccess: (_, { reviewId }) => {
      queryClient.invalidateQueries({ queryKey: ["review", reviewId] });
    },
  });

  const completeChecklistMutation = useMutation({
    mutationFn: async ({
      reviewId,
      checklistItemId,
      notes,
    }: {
      reviewId: string;
      checklistItemId: string;
      notes?: string;
    }) => {
      return apiPost(`/api/reviews/${reviewId}/checklist`, {
        checklistItemId,
        notes,
      });
    },
    onSuccess: (_, { reviewId }) => {
      queryClient.invalidateQueries({ queryKey: ["review", reviewId] });
    },
  });

  const signOffMutation = useMutation({
    mutationFn: async ({
      reviewId,
      statement,
      expiresAt,
    }: {
      reviewId: string;
      statement: string;
      expiresAt?: string;
    }) => {
      return apiPost(`/api/reviews/${reviewId}/sign-off`, {
        statement,
        expiresAt,
      });
    },
    onSuccess: (_, { reviewId }) => {
      queryClient.invalidateQueries({ queryKey: ["review", reviewId] });
      queryClient.invalidateQueries({ queryKey: ["reviews"] });
    },
  });

  return {
    createReview: createReviewMutation.mutate,
    createReviewAsync: createReviewMutation.mutateAsync,
    isCreating: createReviewMutation.isPending,
    startReview: startReviewMutation.mutate,
    isStarting: startReviewMutation.isPending,
    submitDecision: submitDecisionMutation.mutate,
    isSubmitting: submitDecisionMutation.isPending,
    addComment: addCommentMutation.mutate,
    isAddingComment: addCommentMutation.isPending,
    resolveComment: resolveCommentMutation.mutate,
    isResolvingComment: resolveCommentMutation.isPending,
    completeChecklist: completeChecklistMutation.mutate,
    isCompletingChecklist: completeChecklistMutation.isPending,
    signOff: signOffMutation.mutate,
    isSigningOff: signOffMutation.isPending,
  };
}

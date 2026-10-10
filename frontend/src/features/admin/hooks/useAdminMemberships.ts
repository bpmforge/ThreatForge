"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as api from "../services/api";
import type { AddMembershipRequest, UpdateMembershipRequest } from "../types";

const userKey = (id: string) => ["admin", "users", id] as const;

export function useAddMembership() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      userId,
      data,
    }: {
      userId: string;
      data: AddMembershipRequest;
    }) => api.addUserMembership(userId, data),
    onSuccess: (_, { userId }) => {
      queryClient.invalidateQueries({ queryKey: userKey(userId) });
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
    },
  });
}

export function useUpdateMembership() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      userId,
      membershipId,
      data,
    }: {
      userId: string;
      membershipId: string;
      data: UpdateMembershipRequest;
    }) => api.updateUserMembership(userId, membershipId, data),
    onSuccess: (_, { userId }) => {
      queryClient.invalidateQueries({ queryKey: userKey(userId) });
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
    },
  });
}

export function useRemoveMembership() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      userId,
      membershipId,
    }: {
      userId: string;
      membershipId: string;
    }) => api.removeUserMembership(userId, membershipId),
    onSuccess: (_, { userId }) => {
      queryClient.invalidateQueries({ queryKey: userKey(userId) });
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
    },
  });
}

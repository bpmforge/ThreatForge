"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getErrorMessage } from "@/lib/errors";
import { toast } from "sonner";
import * as api from "../services/api";
import type { UpdateUserRequest, InviteUserRequest } from "../types";

const KEYS = {
  users: (params?: Record<string, unknown>) =>
    ["admin", "users", params] as const,
  user: (id: string) => ["admin", "users", id] as const,
};

export function useUsers(params?: {
  search?: string;
  page?: number;
  limit?: number;
}) {
  return useQuery({
    queryKey: KEYS.users(params),
    queryFn: () => api.getUsers(params),
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      userId,
      data,
    }: {
      userId: string;
      data: UpdateUserRequest;
    }) => api.updateUser(userId, data),
    onSuccess: (updated) => {
      queryClient.setQueryData(KEYS.user(updated.id), updated);
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
    },
  });
}

export function useDeleteUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.deleteUser,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] }),
  });
}

export function useInviteUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: InviteUserRequest) => api.inviteUser(data),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] }),
  });
}

export function useBulkInvite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (csv: string) => api.bulkInviteUsers(csv),
    onError: (err) => toast.error(getErrorMessage(err, "Bulk invite failed")),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] }),
  });
}

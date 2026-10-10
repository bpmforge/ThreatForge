import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiDelete } from "@/lib/api-client";
import type { NotificationStats, NotificationsResponse } from "../types";

interface FetchOptions {
  offset?: number;
  limit?: number;
  unreadOnly?: boolean;
}

async function fetchNotifications(
  options: FetchOptions = {},
): Promise<NotificationsResponse> {
  const params = new URLSearchParams();
  if (options.offset) params.set("offset", String(options.offset));
  if (options.limit) params.set("limit", String(options.limit));
  if (options.unreadOnly) params.set("unreadOnly", "true");

  const json = await apiGet<{
    data: NotificationsResponse["notifications"];
    pagination: NotificationsResponse["pagination"];
  }>(`/api/notifications?${params}`);
  return { notifications: json.data, pagination: json.pagination };
}

async function fetchStats(): Promise<NotificationStats> {
  return apiGet<NotificationStats>("/api/notifications/stats");
}

export function useNotifications(options: FetchOptions = {}) {
  const queryClient = useQueryClient();

  const notificationsQuery = useQuery({
    queryKey: ["notifications", options],
    queryFn: () => fetchNotifications(options),
  });

  const statsQuery = useQuery({
    queryKey: ["notifications", "stats"],
    queryFn: fetchStats,
    refetchInterval: 30000, // Poll every 30s for badge updates
  });

  const markAsReadMutation = useMutation({
    mutationFn: async (notificationIds: string[]) => {
      await apiPost("/api/notifications/read", { notificationIds });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      await apiPost("/api/notifications/read-all");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      await apiDelete(`/api/notifications/${notificationId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  return {
    notifications: notificationsQuery.data?.notifications ?? [],
    pagination: notificationsQuery.data?.pagination,
    stats: statsQuery.data,
    unreadCount: statsQuery.data?.unread ?? 0,
    isLoading: notificationsQuery.isLoading,
    isLoadingStats: statsQuery.isLoading,
    error: notificationsQuery.error,
    refetch: notificationsQuery.refetch,
    markAsRead: (id: string) => markAsReadMutation.mutate([id]),
    markMultipleAsRead: (ids: string[]) => markAsReadMutation.mutate(ids),
    markAllRead: () => markAllReadMutation.mutate(),
    deleteNotification: (id: string) => deleteMutation.mutate(id),
    isMarkingRead: markAsReadMutation.isPending,
  };
}

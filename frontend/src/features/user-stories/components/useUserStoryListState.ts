"use client";

import { useState } from "react";
import { useUserStories, useDeleteUserStory } from "../hooks/useUserStories";
import type { UserStoryStatus } from "../types";

export function useUserStoryListState(projectId: string) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<UserStoryStatus | "ALL">(
    "ALL",
  );
  const [page, setPage] = useState(1);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    id: string;
    title: string;
  } | null>(null);

  const { data, isLoading } = useUserStories(projectId, {
    page,
    limit: 20,
    status: statusFilter === "ALL" ? undefined : statusFilter,
    search: search || undefined,
  });

  const deleteStory = useDeleteUserStory(projectId);

  const stories = data?.data ?? [];
  const pagination = data?.pagination;

  const handleDeleteClick = (
    id: string,
    title: string,
    e: React.MouseEvent,
  ) => {
    e.stopPropagation();
    setDeleteConfirm({ id, title });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm) return;
    await deleteStory.mutateAsync(deleteConfirm.id);
    setDeleteConfirm(null);
  };

  return {
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    page,
    setPage,
    deleteConfirm,
    setDeleteConfirm,
    isLoading,
    stories,
    pagination,
    deleteStory,
    handleDeleteClick,
    handleDeleteConfirm,
  };
}

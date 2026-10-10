"use client";

import { useState, useMemo } from "react";
import { usePrompts, useClonePrompt, useDeletePrompt } from "./usePrompts";
import type { PromptTemplateSummary, PromptCategory } from "../types";
import { parseTags } from "../types";

export function usePromptLibrary(orgId: string) {
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<PromptCategory | "all">(
    "all",
  );
  const [showBuiltInOnly, setShowBuiltInOnly] = useState(false);
  const [deletePromptId, setDeletePromptId] = useState<string | null>(null);

  const { data: prompts, isLoading, error } = usePrompts(orgId);
  const cloneMutation = useClonePrompt(orgId);
  const deleteMutation = useDeletePrompt(orgId);

  const filteredPrompts = useMemo(() => {
    if (!prompts) return [];
    return prompts.filter((prompt) => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const tags = parseTags(prompt);
        const matchesSearch =
          prompt.name.toLowerCase().includes(query) ||
          prompt.description?.toLowerCase().includes(query) ||
          tags.some((tag) => tag.toLowerCase().includes(query));
        if (!matchesSearch) return false;
      }
      if (categoryFilter !== "all" && prompt.category !== categoryFilter)
        return false;
      if (showBuiltInOnly && !prompt.isBuiltIn) return false;
      return true;
    });
  }, [prompts, searchQuery, categoryFilter, showBuiltInOnly]);

  const handleClone = async (prompt: PromptTemplateSummary) => {
    await cloneMutation.mutateAsync({ promptId: prompt.id });
  };

  const handleDelete = async () => {
    if (deletePromptId) {
      await deleteMutation.mutateAsync(deletePromptId);
      setDeletePromptId(null);
    }
  };

  return {
    searchQuery,
    setSearchQuery,
    categoryFilter,
    setCategoryFilter,
    showBuiltInOnly,
    setShowBuiltInOnly,
    deletePromptId,
    setDeletePromptId,
    filteredPrompts,
    isLoading,
    error,
    handleClone,
    handleDelete,
  };
}

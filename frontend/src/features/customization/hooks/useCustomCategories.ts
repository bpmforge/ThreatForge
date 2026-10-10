/**
 * Hook for managing custom threat categories
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import * as api from "../services/api";
import type {
  CreateCategoryData,
  UpdateCategoryData,
  CustomThreatCategory,
} from "../types";

const CATEGORY_QUERY_KEYS = {
  categories: (orgId: string) => ["custom-categories", orgId] as const,
};

export function useCustomCategories(orgId: string | null | undefined) {
  return useQuery({
    queryKey: CATEGORY_QUERY_KEYS.categories(orgId!),
    queryFn: () => api.fetchCategories(orgId!),
    enabled: !!orgId,
  });
}

export function useCreateCategory(orgId: string | null | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateCategoryData) => api.createCategory(orgId!, data),
    onSuccess: (newCategory) => {
      queryClient.setQueryData<CustomThreatCategory[]>(
        CATEGORY_QUERY_KEYS.categories(orgId!),
        (old) => (old ? [...old, newCategory] : [newCategory]),
      );
    },
    onError: () => {
      toast.error("Failed to create category");
    },
  });
}

export function useUpdateCategory(orgId: string | null | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      categoryId,
      data,
    }: {
      categoryId: string;
      data: UpdateCategoryData;
    }) => api.updateCategory(orgId!, categoryId, data),
    onSuccess: (updated) => {
      queryClient.setQueryData<CustomThreatCategory[]>(
        CATEGORY_QUERY_KEYS.categories(orgId!),
        (old) => old?.map((c) => (c.id === updated.id ? updated : c)) ?? [],
      );
    },
    onError: () => {
      toast.error("Failed to update category");
    },
  });
}

export function useDeleteCategory(orgId: string | null | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (categoryId: string) => api.deleteCategory(orgId!, categoryId),
    onSuccess: (_, categoryId) => {
      queryClient.setQueryData<CustomThreatCategory[]>(
        CATEGORY_QUERY_KEYS.categories(orgId!),
        (old) => old?.filter((c) => c.id !== categoryId) ?? [],
      );
    },
    onError: () => {
      toast.error("Failed to delete category");
    },
  });
}

export function useReorderCategories(orgId: string | null | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (categoryIds: string[]) =>
      api.reorderCategories(orgId!, categoryIds),
    onMutate: async (categoryIds) => {
      await queryClient.cancelQueries({
        queryKey: CATEGORY_QUERY_KEYS.categories(orgId!),
      });

      const previous = queryClient.getQueryData<CustomThreatCategory[]>(
        CATEGORY_QUERY_KEYS.categories(orgId!),
      );

      if (previous) {
        const reordered = categoryIds
          .map((id, index) => {
            const category = previous.find((c) => c.id === id);
            return category ? { ...category, sortOrder: index } : null;
          })
          .filter(Boolean) as CustomThreatCategory[];

        queryClient.setQueryData(
          CATEGORY_QUERY_KEYS.categories(orgId!),
          reordered,
        );
      }

      return { previous };
    },
    onError: (_, __, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          CATEGORY_QUERY_KEYS.categories(orgId!),
          context.previous,
        );
      }
      toast.error("Failed to reorder categories");
    },
  });
}

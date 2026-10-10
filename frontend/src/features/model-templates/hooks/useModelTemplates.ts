/**
 * Model Templates hooks using TanStack Query
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import * as api from "../services/api";
import type { SaveAsTemplateData, CreateFromTemplateData } from "../types";

const TEMPLATE_QUERY_KEYS = {
  templates: (params?: { category?: string; search?: string }) =>
    ["model-templates", params] as const,
  template: (id: string) => ["model-templates", id] as const,
  categories: () => ["model-templates", "categories"] as const,
};

// List templates
export function useModelTemplates(params?: {
  category?: string;
  search?: string;
  publicOnly?: boolean;
}) {
  return useQuery({
    queryKey: TEMPLATE_QUERY_KEYS.templates(params),
    queryFn: () => api.fetchTemplates(params),
  });
}

// Get categories
export function useTemplateCategories() {
  return useQuery({
    queryKey: TEMPLATE_QUERY_KEYS.categories(),
    queryFn: () => api.fetchCategories(),
  });
}

// Save as template
export function useSaveAsTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      modelId,
      data,
    }: {
      modelId: string;
      data: SaveAsTemplateData;
    }) => api.saveAsTemplate(modelId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["model-templates"] });
    },
    onError: () => {
      toast.error("Failed to save template");
    },
  });
}

// Create from template
export function useCreateFromTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      templateId,
      data,
    }: {
      templateId: string;
      data: CreateFromTemplateData;
    }) => api.createFromTemplate(templateId, data),
    onSuccess: (result) => {
      // Invalidate project models
      queryClient.invalidateQueries({
        queryKey: ["projects", result.projectId, "models"],
      });
      // Invalidate template usage count
      queryClient.invalidateQueries({ queryKey: ["model-templates"] });
    },
    onError: () => {
      toast.error("Failed to create model from template");
    },
  });
}

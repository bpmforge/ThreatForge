/**
 * Threat Library API React Query hooks
 */
"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import * as api from "../services/api";
import type {
  CreateLibraryRequest,
  UpdateLibraryRequest,
  CreateTemplateRequest,
  UpdateTemplateRequest,
  ImportLibraryRequest,
} from "../types";

const QUERY_KEYS = {
  libraries: ["threatLibraries"] as const,
  library: (id: string) => ["threatLibrary", id] as const,
  templates: (libraryId: string) => ["threatTemplates", libraryId] as const,
  template: (libraryId: string, templateId: string) =>
    ["threatTemplate", libraryId, templateId] as const,
};

// =============================================================================
// Library Hooks
// =============================================================================

export function useThreatLibraries() {
  return useQuery({
    queryKey: QUERY_KEYS.libraries,
    queryFn: api.getThreatLibraries,
  });
}

export function useThreatLibraryDetails(libraryId: string | undefined) {
  return useQuery({
    queryKey: QUERY_KEYS.library(libraryId!),
    queryFn: () => api.getThreatLibrary(libraryId!),
    enabled: !!libraryId,
  });
}

export function useCreateThreatLibrary() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateLibraryRequest) => api.createThreatLibrary(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.libraries });
    },
    onError: () => {
      toast.error("Failed to create library");
    },
  });
}

export function useUpdateThreatLibrary(libraryId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateLibraryRequest) =>
      api.updateThreatLibrary(libraryId, data),
    onSuccess: (updated) => {
      queryClient.setQueryData(QUERY_KEYS.library(libraryId), updated);
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.libraries });
    },
    onError: () => {
      toast.error("Failed to update library");
    },
  });
}

export function useDeleteThreatLibrary() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (libraryId: string) => api.deleteThreatLibrary(libraryId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.libraries });
    },
    onError: () => {
      toast.error("Failed to delete library");
    },
  });
}

// =============================================================================
// Template Hooks
// =============================================================================

export function useCreateThreatTemplate(libraryId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateTemplateRequest) =>
      api.createTemplate(libraryId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.templates(libraryId),
      });
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.library(libraryId),
      });
    },
    onError: () => {
      toast.error("Failed to create template");
    },
  });
}

export function useUpdateThreatTemplate(libraryId: string, templateId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateTemplateRequest) =>
      api.updateTemplate(libraryId, templateId, data),
    onSuccess: (updated) => {
      queryClient.setQueryData(
        QUERY_KEYS.template(libraryId, templateId),
        updated,
      );
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.templates(libraryId),
      });
    },
    onError: () => {
      toast.error("Failed to update template");
    },
  });
}

export function useDeleteThreatTemplate(libraryId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (templateId: string) =>
      api.deleteTemplate(libraryId, templateId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.templates(libraryId),
      });
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.library(libraryId),
      });
    },
    onError: () => {
      toast.error("Failed to delete template");
    },
  });
}

// =============================================================================
// Import/Export Hooks
// =============================================================================

export function useImportThreatLibrary() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: ImportLibraryRequest) => api.importLibrary(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.libraries });
    },
    onError: () => {
      toast.error("Failed to import library");
    },
  });
}

export function useExportThreatLibrary() {
  return useMutation({
    mutationFn: (libraryId: string) => api.exportLibrary(libraryId),
    onError: () => {
      toast.error("Failed to export library");
    },
  });
}

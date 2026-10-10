/**
 * Component Templates React Query hooks
 */
"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as api from "../services/api";
import type {
  CreateLibraryRequest,
  UpdateLibraryRequest,
  CreateTemplateRequest,
  UpdateTemplateRequest,
  ImportLibraryRequest,
} from "../types";

const QUERY_KEYS = {
  libraries: (orgId: string) => ["componentTemplateLibraries", orgId] as const,
  library: (orgId: string, libraryId: string) =>
    ["componentTemplateLibrary", orgId, libraryId] as const,
  templates: (orgId: string, libraryId: string) =>
    ["componentTemplates", orgId, libraryId] as const,
};

// =============================================================================
// Library Hooks
// =============================================================================

export function useComponentTemplateLibraries(orgId: string | undefined) {
  return useQuery({
    queryKey: QUERY_KEYS.libraries(orgId!),
    queryFn: () => api.getLibraries(orgId!),
    enabled: !!orgId,
  });
}

export function useComponentTemplateLibrary(
  orgId: string | undefined,
  libraryId: string | undefined,
) {
  return useQuery({
    queryKey: QUERY_KEYS.library(orgId!, libraryId!),
    queryFn: () => api.getLibrary(orgId!, libraryId!),
    enabled: !!orgId && !!libraryId,
  });
}

export function useCreateComponentTemplateLibrary(orgId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateLibraryRequest) => api.createLibrary(orgId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.libraries(orgId) });
    },
  });
}

export function useUpdateComponentTemplateLibrary(
  orgId: string,
  libraryId: string,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateLibraryRequest) =>
      api.updateLibrary(orgId, libraryId, data),
    onSuccess: (updated) => {
      queryClient.setQueryData(QUERY_KEYS.library(orgId, libraryId), updated);
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.libraries(orgId) });
    },
  });
}

export function useDeleteComponentTemplateLibrary(orgId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (libraryId: string) => api.deleteLibrary(orgId, libraryId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.libraries(orgId) });
    },
  });
}

// =============================================================================
// Template Hooks
// =============================================================================

export function useComponentTemplates(
  orgId: string | undefined,
  libraryId: string | undefined,
) {
  return useQuery({
    queryKey: QUERY_KEYS.templates(orgId!, libraryId!),
    queryFn: () => api.getTemplates(orgId!, libraryId!),
    enabled: !!orgId && !!libraryId,
  });
}

export function useCreateComponentTemplate(orgId: string, libraryId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateTemplateRequest) =>
      api.createTemplate(orgId, libraryId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.templates(orgId, libraryId),
      });
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.library(orgId, libraryId),
      });
    },
  });
}

export function useUpdateComponentTemplate(
  orgId: string,
  libraryId: string,
  templateId: string,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateTemplateRequest) =>
      api.updateTemplate(orgId, libraryId, templateId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.templates(orgId, libraryId),
      });
    },
  });
}

export function useDeleteComponentTemplate(orgId: string, libraryId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (templateId: string) =>
      api.deleteTemplate(orgId, libraryId, templateId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.templates(orgId, libraryId),
      });
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.library(orgId, libraryId),
      });
    },
  });
}

// =============================================================================
// Import/Export Hooks
// =============================================================================

export function useImportComponentTemplateLibrary(orgId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: ImportLibraryRequest) => api.importLibrary(orgId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.libraries(orgId) });
    },
  });
}

export function useExportComponentTemplateLibrary(orgId: string) {
  return useMutation({
    mutationFn: (libraryId: string) => api.exportLibrary(orgId, libraryId),
  });
}

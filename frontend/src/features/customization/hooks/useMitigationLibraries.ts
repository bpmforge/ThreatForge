/**
 * Hook for managing mitigation libraries and templates
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import * as api from "../services/api";
import type {
  CreateLibraryData,
  CreateTemplateData,
  MitigationLibrary,
  MitigationTemplate,
} from "../types";

const LIBRARY_QUERY_KEYS = {
  libraries: (orgId: string) => ["mitigation-libraries", orgId] as const,
  templates: (orgId: string, libraryId: string) =>
    ["mitigation-templates", orgId, libraryId] as const,
};

export function useMitigationLibraries(orgId: string | null | undefined) {
  return useQuery({
    queryKey: LIBRARY_QUERY_KEYS.libraries(orgId!),
    queryFn: () => api.fetchLibraries(orgId!),
    enabled: !!orgId,
  });
}

export function useCreateLibrary(orgId: string | null | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateLibraryData) => api.createLibrary(orgId!, data),
    onSuccess: (newLibrary) => {
      queryClient.setQueryData<MitigationLibrary[]>(
        LIBRARY_QUERY_KEYS.libraries(orgId!),
        (old) => (old ? [...old, newLibrary] : [newLibrary]),
      );
    },
    onError: () => {
      toast.error("Failed to create library");
    },
  });
}

export function useDeleteLibrary(orgId: string | null | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (libraryId: string) => api.deleteLibrary(orgId!, libraryId),
    onSuccess: (_, libraryId) => {
      queryClient.setQueryData<MitigationLibrary[]>(
        LIBRARY_QUERY_KEYS.libraries(orgId!),
        (old) => old?.filter((l) => l.id !== libraryId) ?? [],
      );
    },
    onError: () => {
      toast.error("Failed to delete library");
    },
  });
}

export function useMitigationTemplates(
  orgId: string | null | undefined,
  libraryId: string | null | undefined,
) {
  return useQuery({
    queryKey: LIBRARY_QUERY_KEYS.templates(orgId!, libraryId!),
    queryFn: () => api.fetchTemplates(orgId!, libraryId!),
    enabled: !!orgId && !!libraryId,
  });
}

export function useCreateTemplate(
  orgId: string | null | undefined,
  libraryId: string | null | undefined,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateTemplateData) =>
      api.createTemplate(orgId!, libraryId!, data),
    onSuccess: (newTemplate) => {
      queryClient.setQueryData<MitigationTemplate[]>(
        LIBRARY_QUERY_KEYS.templates(orgId!, libraryId!),
        (old) => (old ? [...old, newTemplate] : [newTemplate]),
      );
      // Also update the library's template count
      queryClient.setQueryData<MitigationLibrary[]>(
        LIBRARY_QUERY_KEYS.libraries(orgId!),
        (old) =>
          old?.map((l) =>
            l.id === libraryId
              ? { ...l, templateCount: l.templateCount + 1 }
              : l,
          ) ?? [],
      );
    },
    onError: () => {
      toast.error("Failed to create template");
    },
  });
}

export function useUpdateTemplate(
  orgId: string | null | undefined,
  libraryId: string | null | undefined,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      templateId,
      data,
    }: {
      templateId: string;
      data: Partial<CreateTemplateData>;
    }) => api.updateTemplate(orgId!, libraryId!, templateId, data),
    onSuccess: (updated) => {
      queryClient.setQueryData<MitigationTemplate[]>(
        LIBRARY_QUERY_KEYS.templates(orgId!, libraryId!),
        (old) => old?.map((t) => (t.id === updated.id ? updated : t)) ?? [],
      );
    },
    onError: () => {
      toast.error("Failed to update template");
    },
  });
}

export function useDeleteTemplate(
  orgId: string | null | undefined,
  libraryId: string | null | undefined,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (templateId: string) =>
      api.deleteTemplate(orgId!, libraryId!, templateId),
    onSuccess: (_, templateId) => {
      queryClient.setQueryData<MitigationTemplate[]>(
        LIBRARY_QUERY_KEYS.templates(orgId!, libraryId!),
        (old) => old?.filter((t) => t.id !== templateId) ?? [],
      );
      // Also update the library's template count
      queryClient.setQueryData<MitigationLibrary[]>(
        LIBRARY_QUERY_KEYS.libraries(orgId!),
        (old) =>
          old?.map((l) =>
            l.id === libraryId
              ? { ...l, templateCount: Math.max(0, l.templateCount - 1) }
              : l,
          ) ?? [],
      );
    },
    onError: () => {
      toast.error("Failed to delete template");
    },
  });
}

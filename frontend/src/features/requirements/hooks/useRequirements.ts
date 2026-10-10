/**
 * Hook for requirements CRUD with TanStack Query.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { requirementsApi } from "../services/requirements-api";
import type { CreateRequirementInput, UpdateRequirementInput } from "../types";

export function useRequirements(
  modelId: string,
  filters?: { category?: string; source?: string },
) {
  return useQuery({
    queryKey: ["requirements", modelId, filters],
    queryFn: () => requirementsApi.list(modelId, filters),
    enabled: !!modelId,
  });
}

export function useCreateRequirement(modelId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateRequirementInput) =>
      requirementsApi.create(modelId, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["requirements", modelId] });
      qc.invalidateQueries({ queryKey: ["gap-analysis", modelId] });
      qc.invalidateQueries({ queryKey: ["requirements-coverage", modelId] });
    },
  });
}

export function useUpdateRequirement(modelId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string;
      input: UpdateRequirementInput;
    }) => requirementsApi.update(modelId, id, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["requirements", modelId] });
      qc.invalidateQueries({ queryKey: ["gap-analysis", modelId] });
      qc.invalidateQueries({ queryKey: ["requirements-coverage", modelId] });
    },
  });
}

export function useDeleteRequirement(modelId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => requirementsApi.delete(modelId, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["requirements", modelId] });
      qc.invalidateQueries({ queryKey: ["gap-analysis", modelId] });
      qc.invalidateQueries({ queryKey: ["requirements-coverage", modelId] });
    },
  });
}

"use client";

import {
  useMutation,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";
import * as api from "../services/api";
import type { MitigationStrategy, Threat } from "../types";
import { THREAT_QUERY_KEYS } from "./useThreats";

interface CreateMitigationData {
  description: string;
  priority: string;
  strategy: MitigationStrategy;
  notes?: string;
}

export interface EvidenceLink {
  type: string;
  url: string;
  title: string;
}

export interface RequirementRef {
  docId: string;
  reqId: string;
  text: string;
}

/** Swap an updated mitigation into the cached threat list and refresh dependent views. */
function replaceMitigationInCache(
  queryClient: QueryClient,
  modelId: string | null | undefined,
  threatId: string,
  updatedMitigation: Threat["mitigations"][number],
) {
  if (!modelId) return;
  queryClient.setQueryData<Threat[]>(
    THREAT_QUERY_KEYS.threats(modelId),
    (old) =>
      old?.map((t) =>
        t.id === threatId
          ? {
              ...t,
              mitigations: t.mitigations.map((m) =>
                m.id === updatedMitigation.id ? updatedMitigation : m,
              ),
            }
          : t,
      ),
  );
  queryClient.invalidateQueries({ queryKey: ["gap-analysis", modelId] });
  queryClient.invalidateQueries({
    queryKey: ["requirements-coverage", modelId],
  });
}

export function useCreateMitigation(modelId: string | null | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      threatId,
      data,
    }: {
      threatId: string;
      data: CreateMitigationData;
    }) => api.createMitigation(threatId, data),
    onSuccess: (newMitigation, { threatId }) => {
      if (!modelId) return;
      queryClient.setQueryData<Threat[]>(
        THREAT_QUERY_KEYS.threats(modelId),
        (old) =>
          old?.map((t) =>
            t.id === threatId
              ? { ...t, mitigations: [newMitigation, ...t.mitigations] }
              : t,
          ),
      );
      queryClient.invalidateQueries({ queryKey: ["gap-analysis", modelId] });
      queryClient.invalidateQueries({
        queryKey: ["requirements-coverage", modelId],
      });
    },
    onError: () => {
      toast.error("Failed to create mitigation");
    },
  });
}

export function useUpdateMitigationStatus(modelId: string | null | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      threatId,
      mitigationId,
      status,
    }: {
      threatId: string;
      mitigationId: string;
      status: string;
    }) => api.updateMitigationStatus(threatId, mitigationId, status),
    onSuccess: (updatedMitigation, { threatId }) => {
      replaceMitigationInCache(
        queryClient,
        modelId,
        threatId,
        updatedMitigation,
      );
    },
    onError: () => {
      toast.error("Failed to update mitigation status");
    },
  });
}

export function useUpdateMitigation(modelId: string | null | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      threatId,
      mitigationId,
      data,
    }: {
      threatId: string;
      mitigationId: string;
      data: {
        description?: string;
        status?: string;
        priority?: string;
        strategy?: MitigationStrategy;
        notes?: string | null;
        controlCategory?: string | null;
        testCriteria?: string | null;
        testResult?: string | null;
        evidenceLinks?: EvidenceLink[] | null;
        requirementRefs?: RequirementRef[] | null;
      };
    }) => api.updateMitigation(threatId, mitigationId, data),
    onSuccess: (updatedMitigation, { threatId }) => {
      replaceMitigationInCache(
        queryClient,
        modelId,
        threatId,
        updatedMitigation,
      );
    },
    onError: () => {
      toast.error("Failed to update mitigation");
    },
  });
}

export function useDeleteMitigation(modelId: string | null | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      threatId,
      mitigationId,
    }: {
      threatId: string;
      mitigationId: string;
    }) => api.deleteMitigation(threatId, mitigationId),
    onSuccess: (_, { threatId, mitigationId }) => {
      if (!modelId) return;
      queryClient.setQueryData<Threat[]>(
        THREAT_QUERY_KEYS.threats(modelId),
        (old) =>
          old?.map((t) =>
            t.id === threatId
              ? {
                  ...t,
                  mitigations: t.mitigations.filter(
                    (m) => m.id !== mitigationId,
                  ),
                }
              : t,
          ),
      );
      queryClient.invalidateQueries({ queryKey: ["gap-analysis", modelId] });
      queryClient.invalidateQueries({
        queryKey: ["requirements-coverage", modelId],
      });
    },
    onError: () => {
      toast.error("Failed to delete mitigation");
    },
  });
}

export function useMoveMitigation(modelId: string | null | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      sourceThreatId,
      mitigationId,
      targetThreatId,
    }: {
      sourceThreatId: string;
      mitigationId: string;
      targetThreatId: string;
    }) => api.moveMitigation(sourceThreatId, mitigationId, targetThreatId),
    onSuccess: () => {
      if (!modelId) return;
      queryClient.invalidateQueries({ queryKey: ["threats", modelId] });
      queryClient.invalidateQueries({ queryKey: ["gap-analysis", modelId] });
      queryClient.invalidateQueries({
        queryKey: ["requirements-coverage", modelId],
      });
    },
    onError: () => {
      toast.error("Failed to move mitigation");
    },
  });
}

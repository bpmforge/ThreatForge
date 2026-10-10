"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiPatch } from "@/lib/api-client";
import type {
  ScannerFinding,
  ScanRun,
  FindingStats,
  ScannerType,
  FindingSeverity,
  FindingStatus,
  MappingConfidence,
} from "../types";
interface FindingsFilter {
  scannerType?: ScannerType;
  severity?: FindingSeverity[];
  status?: FindingStatus;
}

// Fetch findings for a project
async function fetchFindings(
  projectId: string,
  filter?: FindingsFilter,
): Promise<ScannerFinding[]> {
  const params = new URLSearchParams();
  if (filter?.scannerType) params.set("scannerType", filter.scannerType);
  if (filter?.severity) params.set("severity", filter.severity.join(","));
  if (filter?.status) params.set("status", filter.status);

  return apiGet<ScannerFinding[]>(
    `/api/projects/${projectId}/scanners/findings?${params}`,
  );
}

// Fetch finding stats
async function fetchStats(projectId: string): Promise<FindingStats> {
  return apiGet<FindingStats>(
    `/api/projects/${projectId}/scanners/findings/stats`,
  );
}

// Fetch scan history
async function fetchHistory(projectId: string): Promise<ScanRun[]> {
  return apiGet<ScanRun[]>(`/api/projects/${projectId}/scanners/history`);
}

export function useFindings(
  projectId: string | undefined,
  filter?: FindingsFilter,
) {
  return useQuery({
    queryKey: ["scanner-findings", projectId, filter],
    queryFn: () => fetchFindings(projectId!, filter),
    enabled: !!projectId,
  });
}

export function useFindingStats(projectId: string | undefined) {
  return useQuery({
    queryKey: ["scanner-stats", projectId],
    queryFn: () => fetchStats(projectId!),
    enabled: !!projectId,
  });
}

export function useScanHistory(projectId: string | undefined) {
  return useQuery({
    queryKey: ["scanner-history", projectId],
    queryFn: () => fetchHistory(projectId!),
    enabled: !!projectId,
  });
}

interface RunSnykScanParams {
  projectId: string;
  snykProjectId: string;
  apiKey: string;
  orgId?: string;
  threatModelId?: string;
}

interface RunSonarScanParams {
  projectId: string;
  sonarProjectKey: string;
  baseUrl: string;
  token: string;
  threatModelId?: string;
}

interface ImportZapParams {
  projectId: string;
  baseUrl: string;
  apiKey?: string;
  targetUrl?: string;
  threatModelId?: string;
}

export function useScannerMutations() {
  const queryClient = useQueryClient();

  const runSnykScan = useMutation({
    mutationFn: async ({ projectId, ...params }: RunSnykScanParams) => {
      return apiPost(`/api/projects/${projectId}/scanners/snyk/scan`, params);
    },
    onSuccess: (_, { projectId }) => {
      queryClient.invalidateQueries({
        queryKey: ["scanner-findings", projectId],
      });
      queryClient.invalidateQueries({ queryKey: ["scanner-stats", projectId] });
      queryClient.invalidateQueries({
        queryKey: ["scanner-history", projectId],
      });
    },
  });

  const runSonarScan = useMutation({
    mutationFn: async ({ projectId, ...params }: RunSonarScanParams) => {
      return apiPost(
        `/api/projects/${projectId}/scanners/sonarqube/scan`,
        params,
      );
    },
    onSuccess: (_, { projectId }) => {
      queryClient.invalidateQueries({
        queryKey: ["scanner-findings", projectId],
      });
      queryClient.invalidateQueries({ queryKey: ["scanner-stats", projectId] });
      queryClient.invalidateQueries({
        queryKey: ["scanner-history", projectId],
      });
    },
  });

  const importZapScan = useMutation({
    mutationFn: async ({ projectId, ...params }: ImportZapParams) => {
      return apiPost(`/api/projects/${projectId}/scanners/zap/import`, params);
    },
    onSuccess: (_, { projectId }) => {
      queryClient.invalidateQueries({
        queryKey: ["scanner-findings", projectId],
      });
      queryClient.invalidateQueries({ queryKey: ["scanner-stats", projectId] });
      queryClient.invalidateQueries({
        queryKey: ["scanner-history", projectId],
      });
    },
  });

  const updateFindingStatus = useMutation({
    mutationFn: async ({
      projectId,
      findingId,
      status,
      dismissReason,
    }: {
      projectId: string;
      findingId: string;
      status: FindingStatus;
      dismissReason?: string;
    }) => {
      return apiPatch(
        `/api/projects/${projectId}/scanners/findings/${findingId}/status`,
        { status, dismissReason },
      );
    },
    onSuccess: (_, { projectId }) => {
      queryClient.invalidateQueries({
        queryKey: ["scanner-findings", projectId],
      });
      queryClient.invalidateQueries({ queryKey: ["scanner-stats", projectId] });
    },
  });

  const mapFindingToComponent = useMutation({
    mutationFn: async ({
      projectId,
      findingId,
      componentId,
      confidence,
      mappingReason,
    }: {
      projectId: string;
      findingId: string;
      componentId: string;
      confidence: MappingConfidence;
      mappingReason?: string;
    }) => {
      return apiPost(
        `/api/projects/${projectId}/scanners/findings/${findingId}/map`,
        { componentId, confidence, mappingReason },
      );
    },
    onSuccess: (_, { projectId }) => {
      queryClient.invalidateQueries({
        queryKey: ["scanner-findings", projectId],
      });
    },
  });

  const autoMapFindings = useMutation({
    mutationFn: async (modelId: string) => {
      return apiPost(`/api/threat-models/${modelId}/scanners/auto-map`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scanner-findings"] });
    },
  });

  return {
    runSnykScan: runSnykScan.mutate,
    runSnykScanAsync: runSnykScan.mutateAsync,
    isRunningSnyk: runSnykScan.isPending,
    runSonarScan: runSonarScan.mutate,
    isRunningSonar: runSonarScan.isPending,
    importZapScan: importZapScan.mutate,
    isImportingZap: importZapScan.isPending,
    updateFindingStatus: updateFindingStatus.mutate,
    isUpdatingStatus: updateFindingStatus.isPending,
    mapFindingToComponent: mapFindingToComponent.mutate,
    isMapping: mapFindingToComponent.isPending,
    autoMapFindings: autoMapFindings.mutate,
    isAutoMapping: autoMapFindings.isPending,
  };
}

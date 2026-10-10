/**
 * Gap Analysis API — wraps /gap-analysis, /scan-code, /scan-from-github
 */
import { apiGet, apiPost } from "@/lib/api-client";

export interface GapThreat {
  id: string;
  name: string;
  category: string | null;
  severity: string;
  cweIds: string[];
  status: string;
  mitigationCount: number;
  effectiveMitigationCount: number;
  controlCategories: string[];
}

export interface GapAnalysisResult {
  summary: {
    total: number;
    covered: number;
    gaps: number;
    coveragePct: number;
    gapsByStrideCategory: Record<string, number>;
    missingControlCategories: string[];
  };
  covered: GapThreat[];
  gaps: GapThreat[];
}

export interface ScanFromGithubResult {
  created: number;
  skipped: number;
  threatId?: string;
  filesScanned: number;
  message?: string;
  controls: Array<{
    id: string;
    description: string;
    controlCategory: string;
    file: string;
    line: number;
    evidenceUrl: string | null;
  }>;
}

export interface CoverageRequirement {
  id: string;
  reqId: string;
  text: string;
  category: string | null;
  docId: string | null;
  source: string;
  isCovered: boolean;
  mitigationCount: number;
  completedCount: number;
  threats: Array<{ id: string; name: string }>;
  controlCategories: string[];
}

export interface RequirementsCoverageResult {
  summary: {
    total: number;
    covered: number;
    uncovered: number;
    coveragePct: number;
  };
  requirements: CoverageRequirement[];
}

export const gapAnalysisApi = {
  getGapAnalysis(modelId: string): Promise<GapAnalysisResult> {
    return apiGet(`/api/threat-models/${modelId}/gap-analysis`);
  },

  scanFromGithub(
    modelId: string,
    payload: { owner: string; repo: string; branch?: string; token?: string },
  ): Promise<ScanFromGithubResult> {
    return apiPost(`/api/threat-models/${modelId}/scan-from-github`, payload);
  },

  getRequirementsCoverage(
    modelId: string,
  ): Promise<RequirementsCoverageResult> {
    return apiGet(`/api/threat-models/${modelId}/requirements-coverage`);
  },

  scanCode(
    modelId: string,
    payload: {
      threatId: string;
      files: Array<{ path: string; content: string }>;
      repoUrl?: string;
      branch?: string;
    },
  ): Promise<{ created: number; skipped: number; controls: unknown[] }> {
    return apiPost(`/api/threat-models/${modelId}/scan-code`, payload);
  },
};

/**
 * Requirements API service
 */
import type {
  Requirement,
  CreateRequirementInput,
  UpdateRequirementInput,
  BulkCreateRequirementsInput,
  BulkCreateResult,
  CsvImportPreviewResult,
  CsvImportResult,
  FrameworkImportResult,
} from "../types";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/api-client";

function base(modelId: string) {
  return `/api/threat-models/${modelId}/requirements`;
}

export const requirementsApi = {
  list(modelId: string, filters?: { category?: string; source?: string }) {
    const params = new URLSearchParams();
    if (filters?.category) params.set("category", filters.category);
    if (filters?.source) params.set("source", filters.source);
    const qs = params.toString();
    return apiGet<Requirement[]>(`${base(modelId)}${qs ? `?${qs}` : ""}`);
  },

  create(modelId: string, input: CreateRequirementInput) {
    return apiPost<Requirement>(base(modelId), input);
  },

  update(modelId: string, id: string, input: UpdateRequirementInput) {
    return apiPatch<Requirement>(`${base(modelId)}/${id}`, input);
  },

  delete(modelId: string, id: string) {
    return apiDelete(`${base(modelId)}/${id}`);
  },

  bulkCreate(modelId: string, input: BulkCreateRequirementsInput) {
    return apiPost<BulkCreateResult>(`${base(modelId)}/bulk`, input);
  },

  importCsvPreview(modelId: string, csvText: string) {
    return apiPost<CsvImportPreviewResult>(
      `${base(modelId)}/import/csv?preview=true`,
      csvText,
    );
  },

  importCsv(modelId: string, csvText: string) {
    return apiPost<CsvImportResult>(`${base(modelId)}/import/csv`, csvText);
  },

  importFramework(modelId: string, frameworkId: string, controlIds: string[]) {
    return apiPost<FrameworkImportResult>(`${base(modelId)}/import/framework`, {
      frameworkId,
      controlIds,
    });
  },
};

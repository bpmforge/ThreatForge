/**
 * Requirement types for the requirements feature.
 */

type RequirementSource =
  | "MANUAL"
  | "DOCUMENT"
  | "CSV"
  | "FRAMEWORK"
  | "AI_SUGGESTED";

type RequirementReviewStatus = "PENDING" | "ACCEPTED" | "REJECTED" | "MODIFIED";

export interface Requirement {
  id: string;
  reqId: string;
  text: string;
  category: string | null;
  docId: string | null;
  source: RequirementSource;
  reviewStatus: RequirementReviewStatus;
  reviewedAt: string | null;
  reviewedById: string | null;
  reviewNotes: string | null;
  frameworkId: string | null;
  threatModelId: string;
  createdById: string;
  requirementFamilyId: string | null;
  version: number;
  supersededAt: string | null;
  createdAt: string;
  updatedAt: string;
  _count: { mitigations: number };
  mitigations: Array<{
    mitigationId: string;
    mitigation: {
      id: string;
      description: string;
      status: string;
      threat: { id: string; name: string; threatModelId: string } | null;
    };
  }>;
}

export interface CreateRequirementInput {
  reqId: string;
  text: string;
  category?: string;
  docId?: string;
  source?: RequirementSource;
  frameworkId?: string;
}

export interface UpdateRequirementInput {
  text?: string;
  category?: string | null;
  docId?: string | null;
  reviewStatus?: RequirementReviewStatus;
  reviewNotes?: string | null;
}

export interface BulkCreateRequirementsInput {
  requirements: CreateRequirementInput[];
  source?: RequirementSource;
}

export interface BulkCreateResult {
  created: number;
  total: number;
  skipped: number;
}

export interface CsvImportPreviewRow {
  reqId: string;
  text: string;
  category?: string;
  status: "new" | "duplicate" | "error";
  error?: string;
}

export interface CsvImportPreviewResult {
  preview: CsvImportPreviewRow[];
  newCount: number;
  duplicateCount: number;
  errorCount: number;
}

export interface CsvImportResult {
  created: number;
  skipped: number;
  errors: CsvImportPreviewRow[];
}

export interface FrameworkImportResult {
  created: number;
  skipped: number;
  framework: string;
  total: number;
}

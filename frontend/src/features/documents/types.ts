/**
 * Document feature types
 */

export interface DocumentSummary {
  id: string;
  name: string;
  type: string;
  sizeBytes: number;
  pageCount: number | null;
  contentTruncated: boolean;
  extractedAt: string | null;
  extractionSummary: string | null;
  extractedComponentCount: number;
  extractedRequirementCount: number;
  documentFamilyId: string;
  version: number;
  supersededAt: string | null;
  contentHash: string;
  importedById: string;
  createdAt: string;
  updatedAt: string;
  _count: { requirements: number };
}

interface DocumentRequirement {
  id: string;
  reqId: string;
  text: string;
  category: string | null;
  _count: { mitigations: number };
}

export interface DocumentDetail extends DocumentSummary {
  content: string;
  requirements: DocumentRequirement[];
}

interface DocumentGapSummary {
  totalRequirements: number;
  covered: number;
  uncovered: number;
  coveragePct: number;
  documentCount: number;
}

export interface DocumentGapGroup {
  documentId: string;
  documentName: string;
  documentType: string;
  requirements: Array<{
    id: string;
    reqId: string;
    text: string;
    category: string | null;
    _count: { mitigations: number };
  }>;
}

export interface DocumentGapResult {
  summary: DocumentGapSummary;
  gaps: DocumentGapGroup[];
}

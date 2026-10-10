/**
 * Documents API service
 */
import { apiGet, apiPost, apiDelete } from "@/lib/api-client";
import type {
  DocumentSummary,
  DocumentDetail,
  DocumentGapResult,
} from "../types";

export async function getDocuments(
  modelId: string,
): Promise<DocumentSummary[]> {
  const data = await apiGet<{ documents: DocumentSummary[] }>(
    `/api/threat-models/${modelId}/documents`,
  );
  return data.documents;
}

export async function getDocument(
  modelId: string,
  docId: string,
): Promise<DocumentDetail> {
  const data = await apiGet<{ document: DocumentDetail }>(
    `/api/threat-models/${modelId}/documents/${docId}`,
  );
  return data.document;
}

export async function createDocument(
  modelId: string,
  input: {
    name: string;
    type: string;
    content: string;
    sizeBytes?: number;
    pageCount?: number;
    contentTruncated?: boolean;
    extractionSummary?: string;
    extractedComponentCount?: number;
    extractedRequirementCount?: number;
  },
): Promise<DocumentDetail> {
  const data = await apiPost<{ document: DocumentDetail }>(
    `/api/threat-models/${modelId}/documents`,
    input,
  );
  return data.document;
}

export async function deleteDocument(
  modelId: string,
  docId: string,
): Promise<void> {
  await apiDelete(`/api/threat-models/${modelId}/documents/${docId}`);
}

export async function getDocumentGaps(
  modelId: string,
): Promise<DocumentGapResult> {
  return apiGet<DocumentGapResult>(
    `/api/threat-models/${modelId}/documents/gaps`,
  );
}

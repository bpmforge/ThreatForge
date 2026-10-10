/**
 * Threat Library API client
 */
import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/api-client";
import type {
  ThreatLibrary,
  ThreatTemplate,
  CreateLibraryRequest,
  UpdateLibraryRequest,
  CreateTemplateRequest,
  UpdateTemplateRequest,
  ImportLibraryRequest,
  ExportLibraryResponse,
} from "../types";

// =============================================================================
// Threat Libraries
// =============================================================================

export async function getThreatLibraries(): Promise<ThreatLibrary[]> {
  return apiGet<ThreatLibrary[]>("/api/threat-libraries");
}

export async function getThreatLibrary(
  libraryId: string,
): Promise<ThreatLibrary> {
  return apiGet<ThreatLibrary>(`/api/threat-libraries/${libraryId}`);
}

export async function createThreatLibrary(
  data: CreateLibraryRequest,
): Promise<ThreatLibrary> {
  return apiPost<ThreatLibrary>("/api/threat-libraries", data);
}

export async function updateThreatLibrary(
  libraryId: string,
  data: UpdateLibraryRequest,
): Promise<ThreatLibrary> {
  return apiPatch<ThreatLibrary>(`/api/threat-libraries/${libraryId}`, data);
}

export async function deleteThreatLibrary(libraryId: string): Promise<void> {
  await apiDelete(`/api/threat-libraries/${libraryId}`);
}

// =============================================================================
// Threat Templates
// =============================================================================

export async function createTemplate(
  libraryId: string,
  data: CreateTemplateRequest,
): Promise<ThreatTemplate> {
  return apiPost<ThreatTemplate>(
    `/api/threat-libraries/${libraryId}/templates`,
    data,
  );
}

export async function updateTemplate(
  libraryId: string,
  templateId: string,
  data: UpdateTemplateRequest,
): Promise<ThreatTemplate> {
  return apiPatch<ThreatTemplate>(
    `/api/threat-libraries/${libraryId}/templates/${templateId}`,
    data,
  );
}

export async function deleteTemplate(
  libraryId: string,
  templateId: string,
): Promise<void> {
  await apiDelete(`/api/threat-libraries/${libraryId}/templates/${templateId}`);
}

// =============================================================================
// Import/Export
// =============================================================================

export async function importLibrary(
  data: ImportLibraryRequest,
): Promise<ThreatLibrary> {
  return apiPost<ThreatLibrary>("/api/threat-libraries/import", data);
}

export async function exportLibrary(
  libraryId: string,
): Promise<ExportLibraryResponse> {
  return apiGet<ExportLibraryResponse>(
    `/api/threat-libraries/${libraryId}/export`,
  );
}

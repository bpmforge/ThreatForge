/**
 * Component Templates API client
 */
import type {
  ComponentTemplateLibrary,
  ComponentTemplate,
  CreateLibraryRequest,
  UpdateLibraryRequest,
  CreateTemplateRequest,
  UpdateTemplateRequest,
  ImportLibraryRequest,
  ExportLibraryResponse,
} from "../types";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/api-client";

export async function getLibraries(
  orgId: string,
): Promise<ComponentTemplateLibrary[]> {
  return apiGet(`/api/organizations/${orgId}/component-templates`);
}

export async function getLibrary(
  orgId: string,
  libraryId: string,
): Promise<ComponentTemplateLibrary> {
  return apiGet(`/api/organizations/${orgId}/component-templates/${libraryId}`);
}

export async function createLibrary(
  orgId: string,
  data: CreateLibraryRequest,
): Promise<ComponentTemplateLibrary> {
  return apiPost(`/api/organizations/${orgId}/component-templates`, data);
}

export async function updateLibrary(
  orgId: string,
  libraryId: string,
  data: UpdateLibraryRequest,
): Promise<ComponentTemplateLibrary> {
  return apiPatch(
    `/api/organizations/${orgId}/component-templates/${libraryId}`,
    data,
  );
}

export async function deleteLibrary(
  orgId: string,
  libraryId: string,
): Promise<void> {
  return apiDelete(
    `/api/organizations/${orgId}/component-templates/${libraryId}`,
  );
}

export async function getTemplates(
  orgId: string,
  libraryId: string,
): Promise<ComponentTemplate[]> {
  return apiGet(
    `/api/organizations/${orgId}/component-templates/${libraryId}/templates`,
  );
}

export async function createTemplate(
  orgId: string,
  libraryId: string,
  data: CreateTemplateRequest,
): Promise<ComponentTemplate> {
  return apiPost(
    `/api/organizations/${orgId}/component-templates/${libraryId}/templates`,
    data,
  );
}

export async function updateTemplate(
  orgId: string,
  libraryId: string,
  templateId: string,
  data: UpdateTemplateRequest,
): Promise<ComponentTemplate> {
  return apiPatch(
    `/api/organizations/${orgId}/component-templates/${libraryId}/templates/${templateId}`,
    data,
  );
}

export async function deleteTemplate(
  orgId: string,
  libraryId: string,
  templateId: string,
): Promise<void> {
  return apiDelete(
    `/api/organizations/${orgId}/component-templates/${libraryId}/templates/${templateId}`,
  );
}

export async function importLibrary(
  orgId: string,
  data: ImportLibraryRequest,
): Promise<ComponentTemplateLibrary> {
  return apiPost(
    `/api/organizations/${orgId}/component-templates/import`,
    data,
  );
}

export async function exportLibrary(
  orgId: string,
  libraryId: string,
): Promise<ExportLibraryResponse> {
  return apiGet(
    `/api/organizations/${orgId}/component-templates/${libraryId}/export`,
  );
}

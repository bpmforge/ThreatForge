/**
 * Customization API service
 */
import { apiGet, apiPost, apiPut, apiDelete } from "@/lib/api-client";
import type {
  CustomThreatCategory,
  CreateCategoryData,
  UpdateCategoryData,
  MitigationLibrary,
  MitigationTemplate,
  CreateLibraryData,
  CreateTemplateData,
} from "../types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

// ============================================
// Custom Threat Categories
// ============================================

export async function fetchCategories(
  orgId: string,
): Promise<CustomThreatCategory[]> {
  return apiGet<CustomThreatCategory[]>(
    `${API_BASE}/api/v1/organizations/${orgId}/custom-categories`,
  );
}

export async function createCategory(
  orgId: string,
  data: CreateCategoryData,
): Promise<CustomThreatCategory> {
  return apiPost<CustomThreatCategory>(
    `${API_BASE}/api/v1/organizations/${orgId}/custom-categories`,
    data,
  );
}

export async function updateCategory(
  orgId: string,
  categoryId: string,
  data: UpdateCategoryData,
): Promise<CustomThreatCategory> {
  return apiPut<CustomThreatCategory>(
    `${API_BASE}/api/v1/organizations/${orgId}/custom-categories/${categoryId}`,
    data,
  );
}

export async function deleteCategory(
  orgId: string,
  categoryId: string,
): Promise<void> {
  await apiDelete(
    `${API_BASE}/api/v1/organizations/${orgId}/custom-categories/${categoryId}`,
  );
}

export async function reorderCategories(
  orgId: string,
  categoryIds: string[],
): Promise<void> {
  await apiPost(
    `${API_BASE}/api/v1/organizations/${orgId}/custom-categories/reorder`,
    {
      categoryIds,
    },
  );
}

// ============================================
// Mitigation Libraries
// ============================================

export async function fetchLibraries(
  orgId: string,
): Promise<MitigationLibrary[]> {
  return apiGet<MitigationLibrary[]>(
    `${API_BASE}/api/v1/organizations/${orgId}/mitigation-libraries`,
  );
}

export async function createLibrary(
  orgId: string,
  data: CreateLibraryData,
): Promise<MitigationLibrary> {
  return apiPost<MitigationLibrary>(
    `${API_BASE}/api/v1/organizations/${orgId}/mitigation-libraries`,
    data,
  );
}

export async function deleteLibrary(
  orgId: string,
  libraryId: string,
): Promise<void> {
  await apiDelete(
    `${API_BASE}/api/v1/organizations/${orgId}/mitigation-libraries/${libraryId}`,
  );
}

export async function fetchTemplates(
  orgId: string,
  libraryId: string,
): Promise<MitigationTemplate[]> {
  return apiGet<MitigationTemplate[]>(
    `${API_BASE}/api/v1/organizations/${orgId}/mitigation-libraries/${libraryId}/templates`,
  );
}

export async function createTemplate(
  orgId: string,
  libraryId: string,
  data: CreateTemplateData,
): Promise<MitigationTemplate> {
  return apiPost<MitigationTemplate>(
    `${API_BASE}/api/v1/organizations/${orgId}/mitigation-libraries/${libraryId}/templates`,
    data,
  );
}

export async function updateTemplate(
  orgId: string,
  libraryId: string,
  templateId: string,
  data: Partial<CreateTemplateData>,
): Promise<MitigationTemplate> {
  return apiPut<MitigationTemplate>(
    `${API_BASE}/api/v1/organizations/${orgId}/mitigation-libraries/${libraryId}/templates/${templateId}`,
    data,
  );
}

export async function deleteTemplate(
  orgId: string,
  libraryId: string,
  templateId: string,
): Promise<void> {
  await apiDelete(
    `${API_BASE}/api/v1/organizations/${orgId}/mitigation-libraries/${libraryId}/templates/${templateId}`,
  );
}

/**
 * Model Templates API service
 */
import { apiGet, apiPost } from "@/lib/api-client";
import type {
  ModelTemplate,
  SaveAsTemplateData,
  CreateFromTemplateData,
  TemplateCategory,
} from "../types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

// List templates
export async function fetchTemplates(params?: {
  category?: string;
  search?: string;
  publicOnly?: boolean;
  limit?: number;
  offset?: number;
}): Promise<{
  data: ModelTemplate[];
  pagination: { total: number; hasMore: boolean };
}> {
  const searchParams = new URLSearchParams();
  if (params?.category) searchParams.set("category", params.category);
  if (params?.search) searchParams.set("search", params.search);
  if (params?.publicOnly) searchParams.set("publicOnly", "true");
  if (params?.limit) searchParams.set("limit", params.limit.toString());
  if (params?.offset) searchParams.set("offset", params.offset.toString());

  const query = searchParams.toString();
  return apiGet<{
    data: ModelTemplate[];
    pagination: { total: number; hasMore: boolean };
  }>(`${API_BASE}/api/v1/model-templates${query ? `?${query}` : ""}`);
}

// Get template categories
export async function fetchCategories(): Promise<TemplateCategory[]> {
  const response = await apiGet<TemplateCategory[]>(
    `${API_BASE}/api/v1/model-templates/categories`,
  );
  return response;
}

// Save threat model as template
export async function saveAsTemplate(
  modelId: string,
  data: SaveAsTemplateData,
): Promise<{
  id: string;
  name: string;
  componentCount: number;
  boundaryCount: number;
  threatCount: number;
}> {
  return apiPost<{
    id: string;
    name: string;
    componentCount: number;
    boundaryCount: number;
    threatCount: number;
  }>(`${API_BASE}/api/v1/threat-models/${modelId}/save-as-template`, data);
}

// Create threat model from template
export async function createFromTemplate(
  templateId: string,
  data: CreateFromTemplateData,
): Promise<{
  id: string;
  name: string;
  projectId: string;
  componentCount: number;
  boundaryCount: number;
  threatCount: number;
}> {
  return apiPost<{
    id: string;
    name: string;
    projectId: string;
    componentCount: number;
    boundaryCount: number;
    threatCount: number;
  }>(`${API_BASE}/api/v1/threat-models/from-template/${templateId}`, data);
}

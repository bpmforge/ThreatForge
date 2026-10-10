import { apiGet, apiPost, apiPut, apiDelete } from "@/lib/api-client";
import type {
  PromptTemplate,
  PromptTemplateSummary,
  DocumentTypeConfig,
  CreatePromptInput,
  UpdatePromptInput,
  PromptCategory,
} from "../types";

export async function getPrompts(
  orgId: string,
  category?: PromptCategory,
): Promise<PromptTemplateSummary[]> {
  const params = category ? `?category=${category}` : "";
  const data = await apiGet<{ prompts: PromptTemplateSummary[] }>(
    `/api/organizations/${orgId}/prompts${params}`,
  );
  return data.prompts;
}

export async function getBuiltInPrompts(): Promise<PromptTemplateSummary[]> {
  const data = await apiGet<{ prompts: PromptTemplateSummary[] }>(
    "/api/prompts/builtin",
  );
  return data.prompts;
}

export async function getPrompt(
  orgId: string,
  promptId: string,
): Promise<PromptTemplate> {
  const data = await apiGet<{ prompt: PromptTemplate }>(
    `/api/organizations/${orgId}/prompts/${promptId}`,
  );
  return data.prompt;
}

export async function createPrompt(
  orgId: string,
  input: CreatePromptInput,
): Promise<PromptTemplate> {
  const data = await apiPost<{ prompt: PromptTemplate }>(
    `/api/organizations/${orgId}/prompts`,
    input,
  );
  return data.prompt;
}

export async function clonePrompt(
  orgId: string,
  promptId: string,
  name?: string,
): Promise<PromptTemplate> {
  const data = await apiPost<{ prompt: PromptTemplate }>(
    `/api/organizations/${orgId}/prompts/${promptId}/clone`,
    { name },
  );
  return data.prompt;
}

export async function updatePrompt(
  orgId: string,
  promptId: string,
  input: UpdatePromptInput,
): Promise<PromptTemplate> {
  const data = await apiPut<{ prompt: PromptTemplate }>(
    `/api/organizations/${orgId}/prompts/${promptId}`,
    input,
  );
  return data.prompt;
}

export async function deletePrompt(
  orgId: string,
  promptId: string,
): Promise<void> {
  await apiDelete(`/api/organizations/${orgId}/prompts/${promptId}`);
}

export async function getDocumentTypes(
  orgId: string,
): Promise<DocumentTypeConfig[]> {
  const data = await apiGet<{ documentTypes: DocumentTypeConfig[] }>(
    `/api/organizations/${orgId}/document-types`,
  );
  return data.documentTypes;
}

export async function deleteDocumentType(
  orgId: string,
  docTypeId: string,
): Promise<void> {
  await apiDelete(`/api/organizations/${orgId}/document-types/${docTypeId}`);
}

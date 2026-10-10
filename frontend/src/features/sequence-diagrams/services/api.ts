import type {
  SequenceDiagram,
  ArchitectureComponent,
  CreateSequenceDiagramRequest,
  UpdateSequenceDiagramRequest,
} from "../types";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/api-client";

export * from "./participants-api";
export * from "./messages-api";

interface ComponentNode {
  id: string;
  type?: string;
  data?: {
    label?: string;
    name?: string;
    description?: string;
    componentType?: string;
  };
}

export async function getArchitectureComponents(
  threatModelId: string,
): Promise<ArchitectureComponent[]> {
  const threatModel = await apiGet<{
    canvasState?: { nodes?: ComponentNode[] };
  }>(`/api/threat-models/${threatModelId}`);
  const nodes = threatModel.canvasState?.nodes || [];

  return nodes
    .filter(
      (node) =>
        node.type &&
        !node.type.includes("group") &&
        !node.type.includes("boundary"),
    )
    .map((node) => ({
      id: node.id,
      name: node.data?.label || node.data?.name || "Unnamed Component",
      type: node.data?.componentType || node.type || "unknown",
      description: node.data?.description || null,
    }));
}

export async function getSequenceDiagrams(
  threatModelId: string,
): Promise<SequenceDiagram[]> {
  return apiGet(`/api/threat-models/${threatModelId}/sequences`);
}

export async function getSequenceDiagram(
  threatModelId: string,
  sequenceId: string,
): Promise<SequenceDiagram> {
  return apiGet(`/api/threat-models/${threatModelId}/sequences/${sequenceId}`);
}

export async function createSequenceDiagram(
  threatModelId: string,
  data: CreateSequenceDiagramRequest,
): Promise<SequenceDiagram> {
  return apiPost(`/api/threat-models/${threatModelId}/sequences`, data);
}

export async function updateSequenceDiagram(
  threatModelId: string,
  sequenceId: string,
  data: UpdateSequenceDiagramRequest,
): Promise<SequenceDiagram> {
  return apiPatch(
    `/api/threat-models/${threatModelId}/sequences/${sequenceId}`,
    data,
  );
}

export async function deleteSequenceDiagram(
  threatModelId: string,
  sequenceId: string,
): Promise<void> {
  if (!threatModelId || !sequenceId) {
    throw new Error(
      "Missing required parameters: threatModelId and sequenceId",
    );
  }
  await apiDelete(
    `/api/threat-models/${threatModelId}/sequences/${sequenceId}`,
  );
}

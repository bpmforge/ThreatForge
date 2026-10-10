/**
 * DFD API client
 */
import type {
  DataFlowDiagram,
  DataFlowDiagramSummary,
  CreateDFDRequest,
  UpdateDFDRequest,
} from "../types";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/api-client";

// =============================================================================
// DFD CRUD
// =============================================================================

export async function getDFDs(
  threatModelId: string,
): Promise<DataFlowDiagramSummary[]> {
  return apiGet<DataFlowDiagramSummary[]>(
    `/api/threat-models/${threatModelId}/dfds`,
  );
}

export async function getDFD(
  threatModelId: string,
  dfdId: string,
): Promise<DataFlowDiagram> {
  return apiGet<DataFlowDiagram>(
    `/api/threat-models/${threatModelId}/dfds/${dfdId}`,
  );
}

export async function createDFD(
  threatModelId: string,
  data: CreateDFDRequest,
): Promise<DataFlowDiagram> {
  return apiPost<DataFlowDiagram>(
    `/api/threat-models/${threatModelId}/dfds`,
    data,
  );
}

export async function updateDFD(
  threatModelId: string,
  dfdId: string,
  data: UpdateDFDRequest,
): Promise<DataFlowDiagram> {
  return apiPatch<DataFlowDiagram>(
    `/api/threat-models/${threatModelId}/dfds/${dfdId}`,
    data,
  );
}

export async function deleteDFD(
  threatModelId: string,
  dfdId: string,
): Promise<void> {
  if (!threatModelId || !dfdId) {
    throw new Error("Missing required parameters: threatModelId and dfdId");
  }

  await apiDelete(`/api/threat-models/${threatModelId}/dfds/${dfdId}`);
}

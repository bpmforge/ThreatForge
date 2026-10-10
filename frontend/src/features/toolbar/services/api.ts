/**
 * Toolbar API service.
 */
import { apiGet, apiPost } from "@/lib/api-client";
import type { ThreatModel } from "../types";
import type { Node, Edge } from "@xyflow/react";

export function fetchModels(): Promise<ThreatModel[]> {
  return apiGet<ThreatModel[]>("/api/threat-models");
}

export function loadModel(modelId: string): Promise<{
  id: string;
  name: string;
  canvasState: { nodes: Node[]; edges: Edge[] };
}> {
  return apiGet(`/api/threat-models/${modelId}`);
}

export function saveCanvas(
  modelId: string,
  nodes: Node[],
  edges: Edge[],
): Promise<void> {
  return apiPost(`/api/threat-models/${modelId}/save-canvas`, { nodes, edges });
}

export function createModel(
  name: string,
  nodes: Node[],
  edges: Edge[],
): Promise<{ id: string; name: string }> {
  return apiPost("/api/threat-models", { name, canvasState: { nodes, edges } });
}

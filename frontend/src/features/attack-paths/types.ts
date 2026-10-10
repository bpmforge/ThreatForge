/**
 * Attack Path Types
 */
import type { StrideCategory } from "@/types/canvas";

// =============================================================================
// AI Attack Chain Types (A11)
// =============================================================================

export type ChainStatus = "AI_SUGGESTED" | "ACCEPTED" | "REJECTED" | "MODIFIED";

export interface AttackChainHop {
  id: string;
  position: number;
  componentId: string;
  componentName: string;
  connectionId?: string;
  threatId?: string;
  description: string;
  technique?: string;
  isMitigated: boolean;
}

export interface AttackChainWithHops {
  id: string;
  name: string;
  description: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  residualSeverity?: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  likelihood?: number;
  status: ChainStatus;
  entryPointId: string;
  entryPointName: string;
  targetAssetId: string;
  targetAssetName: string;
  hops: AttackChainHop[];
  createdAt: string;
}

export interface AttackStep {
  id: string;
  nodeId: string;
  nodeName: string;
  threatId?: string;
  threatName: string;
  category: StrideCategory;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  technique?: string;
  mitigation?: string;
}

export interface AttackPath {
  id: string;
  name: string;
  description: string;
  steps: AttackStep[];
  totalRisk: number;
  entryPoint: string;
  target: string;
  likelihood: "HIGH" | "MEDIUM" | "LOW";
  impact: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
}

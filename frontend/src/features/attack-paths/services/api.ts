/**
 * Attack Chains API service (A11 — AI-powered Attack Chain Analysis).
 */
import { apiGet, apiPatch } from "@/lib/api-client";
import type { AttackChainWithHops, ChainStatus } from "../types";

const base = (modelId: string) => `/api/threat-models/${modelId}/attack-chains`;

/** List all attack chains for a model. */
export function listAttackChains(
  modelId: string,
): Promise<AttackChainWithHops[]> {
  return apiGet(base(modelId));
}

/** Update the status of an attack chain (accept / reject / modify). */
export function updateAttackChainStatus(
  modelId: string,
  chainId: string,
  status: ChainStatus,
): Promise<AttackChainWithHops> {
  return apiPatch(`${base(modelId)}/${chainId}`, { status });
}

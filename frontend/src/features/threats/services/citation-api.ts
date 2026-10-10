import { apiGet, apiPatch } from "@/lib/api-client";
import type { Citation, VerificationStatus } from "../types";

export async function getCitationsForThreat(
  modelId: string,
  threatId: string,
): Promise<Citation[]> {
  return apiGet<Citation[]>(
    `/api/threat-models/${modelId}/threats/${threatId}/citations`,
  );
}

export async function getCitationsForMitigation(
  modelId: string,
  mitigationId: string,
): Promise<Citation[]> {
  return apiGet<Citation[]>(
    `/api/threat-models/${modelId}/mitigations/${mitigationId}/citations`,
  );
}

export async function overrideCitation(
  modelId: string,
  ownerType: "threat" | "mitigation",
  ownerId: string,
  citationId: string,
  body: { status: VerificationStatus; rationale: string },
): Promise<Citation> {
  const segment =
    ownerType === "threat" ? `threats/${ownerId}` : `mitigations/${ownerId}`;
  return apiPatch<Citation>(
    `/api/threat-models/${modelId}/${segment}/citations/${citationId}`,
    body,
  );
}

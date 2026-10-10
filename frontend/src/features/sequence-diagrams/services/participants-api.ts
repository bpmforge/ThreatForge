import type {
  SequenceParticipant,
  CreateParticipantRequest,
  UpdateParticipantRequest,
} from "../types";
import { apiPost, apiPatch, apiDelete } from "@/lib/api-client";

export async function createParticipant(
  threatModelId: string,
  sequenceId: string,
  data: CreateParticipantRequest,
): Promise<SequenceParticipant> {
  return apiPost(
    `/api/threat-models/${threatModelId}/sequences/${sequenceId}/participants`,
    data,
  );
}

export async function updateParticipant(
  threatModelId: string,
  sequenceId: string,
  participantId: string,
  data: UpdateParticipantRequest,
): Promise<SequenceParticipant> {
  return apiPatch(
    `/api/threat-models/${threatModelId}/sequences/${sequenceId}/participants/${participantId}`,
    data,
  );
}

export async function deleteParticipant(
  threatModelId: string,
  sequenceId: string,
  participantId: string,
): Promise<void> {
  await apiDelete(
    `/api/threat-models/${threatModelId}/sequences/${sequenceId}/participants/${participantId}`,
  );
}

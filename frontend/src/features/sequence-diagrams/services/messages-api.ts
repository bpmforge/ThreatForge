import type {
  SequenceMessage,
  CreateMessageRequest,
  UpdateMessageRequest,
} from "../types";
import { apiPost, apiPatch, apiDelete } from "@/lib/api-client";

export async function createMessage(
  threatModelId: string,
  sequenceId: string,
  data: CreateMessageRequest,
): Promise<SequenceMessage> {
  return apiPost(
    `/api/threat-models/${threatModelId}/sequences/${sequenceId}/messages`,
    data,
  );
}

export async function updateMessage(
  threatModelId: string,
  sequenceId: string,
  messageId: string,
  data: UpdateMessageRequest,
): Promise<SequenceMessage> {
  return apiPatch(
    `/api/threat-models/${threatModelId}/sequences/${sequenceId}/messages/${messageId}`,
    data,
  );
}

export async function deleteMessage(
  threatModelId: string,
  sequenceId: string,
  messageId: string,
): Promise<void> {
  await apiDelete(
    `/api/threat-models/${threatModelId}/sequences/${sequenceId}/messages/${messageId}`,
  );
}

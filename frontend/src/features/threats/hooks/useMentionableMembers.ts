"use client";

/**
 * useMentionableMembers — fetches org members who can be @mentioned
 * in a threat model's comment thread.
 */
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api-client";

export interface MentionableMember {
  id: string;
  name: string;
  email: string;
}

function fetchMentionableMembers(
  modelId: string,
): Promise<MentionableMember[]> {
  return apiGet<MentionableMember[]>(`/api/threat-models/${modelId}/members`);
}

export function useMentionableMembers(modelId: string | null | undefined) {
  return useQuery<MentionableMember[]>({
    queryKey: ["threat-model-members", modelId ?? ""],
    queryFn: () => {
      if (!modelId) throw new Error("modelId required");
      return fetchMentionableMembers(modelId);
    },
    enabled: !!modelId,
    staleTime: 60_000, // member list changes infrequently
  });
}

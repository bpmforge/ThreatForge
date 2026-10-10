/**
 * Sequence Diagrams hooks
 */
"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as api from "../services/api";
import type {
  CreateSequenceDiagramRequest,
  UpdateSequenceDiagramRequest,
  CreateParticipantRequest,
  UpdateParticipantRequest,
  CreateMessageRequest,
  UpdateMessageRequest,
} from "../types";

const QUERY_KEYS = {
  sequenceDiagrams: (modelId: string) => ["sequenceDiagrams", modelId] as const,
  sequenceDiagram: (modelId: string, seqId: string) =>
    ["sequenceDiagram", modelId, seqId] as const,
  architectureComponents: (modelId: string) =>
    ["architectureComponents", modelId] as const,
};

// =============================================================================
// Architecture Components
// =============================================================================

/** Get architecture components for linking to sequence diagram participants */
export function useArchitectureComponents(threatModelId: string | undefined) {
  return useQuery({
    queryKey: QUERY_KEYS.architectureComponents(threatModelId!),
    queryFn: () => api.getArchitectureComponents(threatModelId!),
    enabled: !!threatModelId,
    staleTime: 30000, // Cache for 30 seconds
  });
}

// =============================================================================
// Sequence Diagrams
// =============================================================================

/** Get all sequence diagrams for a threat model */
export function useSequenceDiagrams(threatModelId: string | undefined) {
  return useQuery({
    queryKey: QUERY_KEYS.sequenceDiagrams(threatModelId!),
    queryFn: () => api.getSequenceDiagrams(threatModelId!),
    enabled: !!threatModelId,
  });
}

/** Get a single sequence diagram */
export function useSequenceDiagram(
  threatModelId: string | undefined,
  sequenceId: string | undefined,
) {
  return useQuery({
    queryKey: QUERY_KEYS.sequenceDiagram(threatModelId!, sequenceId!),
    queryFn: () => api.getSequenceDiagram(threatModelId!, sequenceId!),
    enabled: !!threatModelId && !!sequenceId,
  });
}

/** Create a new sequence diagram */
export function useCreateSequenceDiagram(threatModelId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateSequenceDiagramRequest) =>
      api.createSequenceDiagram(threatModelId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.sequenceDiagrams(threatModelId),
      });
    },
  });
}

/** Update a sequence diagram */
export function useUpdateSequenceDiagram(
  threatModelId: string,
  sequenceId: string,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpdateSequenceDiagramRequest) =>
      api.updateSequenceDiagram(threatModelId, sequenceId, data),
    onSuccess: (updated) => {
      queryClient.setQueryData(
        QUERY_KEYS.sequenceDiagram(threatModelId, sequenceId),
        updated,
      );
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.sequenceDiagrams(threatModelId),
      });
    },
  });
}

/** Delete a sequence diagram */
export function useDeleteSequenceDiagram(threatModelId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (sequenceId: string) =>
      api.deleteSequenceDiagram(threatModelId, sequenceId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.sequenceDiagrams(threatModelId),
      });
    },
  });
}

// =============================================================================
// Participants
// =============================================================================

/** Create a participant */
export function useCreateParticipant(
  threatModelId: string,
  sequenceId: string,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateParticipantRequest) =>
      api.createParticipant(threatModelId, sequenceId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.sequenceDiagram(threatModelId, sequenceId),
      });
    },
  });
}

/** Update a participant */
export function useUpdateParticipant(
  threatModelId: string,
  sequenceId: string,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      participantId,
      data,
    }: {
      participantId: string;
      data: UpdateParticipantRequest;
    }) => api.updateParticipant(threatModelId, sequenceId, participantId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.sequenceDiagram(threatModelId, sequenceId),
      });
    },
  });
}

/** Delete a participant */
export function useDeleteParticipant(
  threatModelId: string,
  sequenceId: string,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (participantId: string) =>
      api.deleteParticipant(threatModelId, sequenceId, participantId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.sequenceDiagram(threatModelId, sequenceId),
      });
    },
  });
}

// =============================================================================
// Messages
// =============================================================================

/** Create a message */
export function useCreateMessage(threatModelId: string, sequenceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateMessageRequest) =>
      api.createMessage(threatModelId, sequenceId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.sequenceDiagram(threatModelId, sequenceId),
      });
    },
  });
}

/** Update a message */
export function useUpdateMessage(threatModelId: string, sequenceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      messageId,
      data,
    }: {
      messageId: string;
      data: UpdateMessageRequest;
    }) => api.updateMessage(threatModelId, sequenceId, messageId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.sequenceDiagram(threatModelId, sequenceId),
      });
    },
  });
}

/** Delete a message */
export function useDeleteMessage(threatModelId: string, sequenceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (messageId: string) =>
      api.deleteMessage(threatModelId, sequenceId, messageId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.sequenceDiagram(threatModelId, sequenceId),
      });
    },
  });
}

"use client";

import { useState, useCallback } from "react";
import type {
  SequenceParticipant as ParticipantType,
  SequenceMessage as MessageType,
} from "../types";
import {
  useCreateParticipant,
  useUpdateParticipant,
  useDeleteParticipant,
  useCreateMessage,
  useUpdateMessage,
  useDeleteMessage,
} from "../hooks/useSequenceDiagrams";

interface HandlerProps {
  threatModelId: string;
  sequenceDiagramId: string;
  participants: ParticipantType[];
  messages: MessageType[];
}

export function useSequenceCanvasHandlers({
  threatModelId,
  sequenceDiagramId,
  participants,
  messages,
}: HandlerProps) {
  const [showParticipantPicker, setShowParticipantPicker] = useState(false);
  const [showAddMessage, setShowAddMessage] = useState(false);
  const [showComponentLink, setShowComponentLink] = useState(false);
  const [participantToLink, setParticipantToLink] =
    useState<ParticipantType | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<ParticipantType | null>(
    null,
  );

  const createParticipant = useCreateParticipant(
    threatModelId,
    sequenceDiagramId,
  );
  const updateParticipant = useUpdateParticipant(
    threatModelId,
    sequenceDiagramId,
  );
  const deleteParticipant = useDeleteParticipant(
    threatModelId,
    sequenceDiagramId,
  );
  const createMessage = useCreateMessage(threatModelId, sequenceDiagramId);
  const updateMessage = useUpdateMessage(threatModelId, sequenceDiagramId);
  const deleteMessage = useDeleteMessage(threatModelId, sequenceDiagramId);

  const handleAddParticipant = useCallback(
    async (label: string, componentId?: string) => {
      await createParticipant.mutateAsync({
        label,
        order: participants.length,
        componentId,
      });
      setShowParticipantPicker(false);
    },
    [createParticipant, participants.length],
  );

  const handleUpdateParticipant = useCallback(
    (id: string, data: { label?: string; componentId?: string | null }) => {
      updateParticipant.mutate({ participantId: id, data });
    },
    [updateParticipant],
  );

  const handleDeleteParticipantClick = useCallback((p: ParticipantType) => {
    setDeleteConfirm(p);
  }, []);

  const handleDeleteParticipantConfirm = useCallback(() => {
    if (!deleteConfirm) return;
    deleteParticipant.mutate(deleteConfirm.id);
    setDeleteConfirm(null);
  }, [deleteConfirm, deleteParticipant]);

  const handleAddMessage = useCallback(
    async (data: {
      label: string;
      fromId: string;
      toId: string;
      messageType: MessageType["messageType"];
    }) => {
      await createMessage.mutateAsync({
        label: data.label,
        fromId: data.fromId,
        toId: data.toId,
        messageType: data.messageType,
        order: messages.length,
        isReturn: data.messageType === "RETURN",
      });
      setShowAddMessage(false);
    },
    [createMessage, messages.length],
  );

  const handleUpdateMessage = useCallback(
    (id: string, data: Partial<MessageType>) => {
      updateMessage.mutate({ messageId: id, data });
    },
    [updateMessage],
  );

  const handleDeleteMessage = useCallback(
    (id: string) => {
      deleteMessage.mutate(id);
    },
    [deleteMessage],
  );

  const handleLinkComponent = useCallback((p: ParticipantType) => {
    setParticipantToLink(p);
    setShowComponentLink(true);
  }, []);

  const handleComponentLinkChange = useCallback(
    (componentId: string | null) => {
      if (participantToLink) {
        updateParticipant.mutate({
          participantId: participantToLink.id,
          data: { componentId },
        });
      }
      setParticipantToLink(null);
    },
    [participantToLink, updateParticipant],
  );

  return {
    showParticipantPicker,
    setShowParticipantPicker,
    showAddMessage,
    setShowAddMessage,
    showComponentLink,
    setShowComponentLink,
    participantToLink,
    deleteConfirm,
    setDeleteConfirm,
    handleAddParticipant,
    handleUpdateParticipant,
    handleDeleteParticipantClick,
    handleDeleteParticipantConfirm,
    handleAddMessage,
    handleUpdateMessage,
    handleDeleteMessage,
    handleLinkComponent,
    handleComponentLinkChange,
  };
}

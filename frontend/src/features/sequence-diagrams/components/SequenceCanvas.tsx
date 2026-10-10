/**
 * SequenceCanvas - Main sequence diagram editor canvas
 */
"use client";

import { useMemo } from "react";
import { exportSequenceToMermaid } from "@/features/export";
import { useSequenceDiagram } from "../hooks/useSequenceDiagrams";
import { useSequenceCanvasHandlers } from "./useSequenceCanvasHandlers";
import { SequenceCanvasToolbar } from "./SequenceCanvasToolbar";
import { SequenceCanvasDiagram } from "./SequenceCanvasDiagram";
import { SequenceCanvasDialogs } from "./SequenceCanvasDialogs";

interface SequenceCanvasProps {
  threatModelId: string;
  sequenceDiagramId: string;
}

export function SequenceCanvas({
  threatModelId,
  sequenceDiagramId,
}: SequenceCanvasProps) {
  const {
    data: diagram,
    isLoading,
    error,
  } = useSequenceDiagram(threatModelId, sequenceDiagramId);

  const participants = useMemo(
    () =>
      diagram?.participants
        ? [...diagram.participants].sort((a, b) => a.order - b.order)
        : [],
    [diagram],
  );

  const messages = useMemo(
    () =>
      diagram?.messages
        ? [...diagram.messages].sort((a, b) => a.order - b.order)
        : [],
    [diagram],
  );

  const participantIndexMap = useMemo(() => {
    const map = new Map<string, number>();
    participants.forEach((p, i) => map.set(p.id, i));
    return map;
  }, [participants]);

  const h = useSequenceCanvasHandlers({
    threatModelId,
    sequenceDiagramId,
    participants,
    messages,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        Loading sequence diagram...
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex items-center justify-center h-full text-destructive">
        Error loading diagram: {error.message}
      </div>
    );
  }
  if (!diagram) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        Diagram not found
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background">
      <SequenceCanvasToolbar
        participantCount={participants.length}
        messageCount={messages.length}
        canExport={participants.length > 0}
        onAddParticipant={() => h.setShowParticipantPicker(true)}
        onAddMessage={() => h.setShowAddMessage(true)}
        onExport={() => exportSequenceToMermaid(diagram)}
      />
      <div className="flex-1 overflow-auto p-4">
        <SequenceCanvasDiagram
          participants={participants}
          messages={messages}
          participantIndexMap={participantIndexMap}
          onUpdateParticipant={h.handleUpdateParticipant}
          onDeleteParticipant={h.handleDeleteParticipantClick}
          onLinkComponent={h.handleLinkComponent}
          onUpdateMessage={h.handleUpdateMessage}
          onDeleteMessage={h.handleDeleteMessage}
          onAddFirstParticipant={() => h.setShowParticipantPicker(true)}
        />
      </div>
      <SequenceCanvasDialogs
        showParticipantPicker={h.showParticipantPicker}
        onParticipantPickerChange={h.setShowParticipantPicker}
        showAddMessage={h.showAddMessage}
        onAddMessageChange={h.setShowAddMessage}
        showComponentLink={h.showComponentLink}
        onComponentLinkChange={h.setShowComponentLink}
        participantToLink={h.participantToLink}
        deleteConfirm={h.deleteConfirm}
        onClearDeleteConfirm={() => h.setDeleteConfirm(null)}
        participants={participants}
        threatModelId={threatModelId}
        onAddParticipant={h.handleAddParticipant}
        onAddMessage={h.handleAddMessage}
        onLinkChange={h.handleComponentLinkChange}
        onDeleteConfirm={h.handleDeleteParticipantConfirm}
      />
    </div>
  );
}

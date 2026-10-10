"use client";

import { Button } from "@/components/ui/button";
import { UserPlus } from "lucide-react";
import { SequenceParticipant } from "./SequenceParticipant";
import { SequenceMessage } from "./SequenceMessage";
import type {
  SequenceParticipant as ParticipantType,
  SequenceMessage as MessageType,
} from "../types";

interface SequenceCanvasDiagramProps {
  participants: ParticipantType[];
  messages: MessageType[];
  participantIndexMap: Map<string, number>;
  onUpdateParticipant: (
    id: string,
    data: { label?: string; componentId?: string | null },
  ) => void;
  onDeleteParticipant: (participant: ParticipantType) => void;
  onLinkComponent: (participant: ParticipantType) => void;
  onUpdateMessage: (id: string, data: Partial<MessageType>) => void;
  onDeleteMessage: (id: string) => void;
  onAddFirstParticipant: () => void;
}

export function SequenceCanvasDiagram({
  participants,
  messages,
  participantIndexMap,
  onUpdateParticipant,
  onDeleteParticipant,
  onLinkComponent,
  onUpdateMessage,
  onDeleteMessage,
  onAddFirstParticipant,
}: SequenceCanvasDiagramProps) {
  if (participants.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-4">
        <p>
          No participants yet. Add participants to start building your sequence
          diagram.
        </p>
        <Button variant="outline" onClick={onAddFirstParticipant}>
          <UserPlus className="h-4 w-4 mr-2" />
          Add First Participant
        </Button>
      </div>
    );
  }

  const colStyle = {
    gridTemplateColumns: `repeat(${participants.length}, 8rem)`,
  };

  return (
    <div className="min-w-max">
      <div className="grid gap-4" style={colStyle}>
        {participants.map((p) => (
          <SequenceParticipant
            key={p.id}
            participant={p}
            isLinked={!!p.componentId}
            onUpdate={(data) => onUpdateParticipant(p.id, data)}
            onDelete={() => onDeleteParticipant(p)}
            onLinkComponent={() => onLinkComponent(p)}
          />
        ))}
      </div>

      <div className="relative mt-4">
        <div
          className="absolute inset-0 grid gap-4 pointer-events-none"
          style={colStyle}
        >
          {participants.map((p) => (
            <div key={p.id} className="flex justify-center">
              <div className="w-0.5 h-full bg-border" />
            </div>
          ))}
        </div>

        <div className="relative space-y-2 min-h-32">
          {messages.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
              No messages yet
            </div>
          ) : (
            messages.map((msg) => {
              const fromIndex = participantIndexMap.get(msg.fromId) ?? 0;
              const toIndex = participantIndexMap.get(msg.toId) ?? 0;
              return (
                <div key={msg.id} className="grid gap-4" style={colStyle}>
                  <SequenceMessage
                    message={msg}
                    fromIndex={fromIndex}
                    toIndex={toIndex}
                    participantCount={participants.length}
                    onUpdate={(data) => onUpdateMessage(msg.id, data)}
                    onDelete={() => onDeleteMessage(msg.id)}
                  />
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

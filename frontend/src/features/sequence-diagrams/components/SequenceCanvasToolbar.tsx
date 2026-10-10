"use client";

import { Button } from "@/components/ui/button";
import { Plus, UserPlus, Download } from "lucide-react";

interface SequenceCanvasToolbarProps {
  participantCount: number;
  messageCount: number;
  canExport: boolean;
  onAddParticipant: () => void;
  onAddMessage: () => void;
  onExport: () => void;
}

export function SequenceCanvasToolbar({
  participantCount,
  messageCount,
  canExport,
  onAddParticipant,
  onAddMessage,
  onExport,
}: SequenceCanvasToolbarProps) {
  return (
    <div className="flex items-center gap-2 px-4 py-2 border-b">
      <Button variant="outline" size="sm" onClick={onAddParticipant}>
        <UserPlus className="h-4 w-4 mr-2" />
        Add Participant
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={onAddMessage}
        disabled={participantCount < 2}
        title={
          participantCount < 2
            ? "Add at least 2 participants first"
            : "Add message"
        }
      >
        <Plus className="h-4 w-4 mr-2" />
        Add Message
      </Button>
      <div className="flex-1" />
      <span className="text-sm text-muted-foreground">
        {participantCount} participants · {messageCount} messages
      </span>
      <Button
        variant="outline"
        size="sm"
        onClick={onExport}
        disabled={!canExport}
        title="Export to Mermaid"
      >
        <Download className="h-4 w-4 mr-2" />
        Export
      </Button>
    </div>
  );
}

/**
 * SequenceParticipant - Participant header in sequence diagram
 */
"use client";

import { useState, memo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreVertical, Pencil, Trash2, Link2, Link2Off } from "lucide-react";
import type { SequenceParticipant as ParticipantType } from "../types";

interface SequenceParticipantProps {
  participant: ParticipantType;
  isLinked: boolean;
  onUpdate: (data: { label?: string; componentId?: string | null }) => void;
  onDelete: () => void;
  onLinkComponent: () => void;
}

export const SequenceParticipant = memo(function SequenceParticipant({
  participant,
  isLinked,
  onUpdate,
  onDelete,
  onLinkComponent,
}: SequenceParticipantProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(participant.label);

  const handleSave = () => {
    if (editValue.trim() && editValue !== participant.label) {
      onUpdate({ label: editValue.trim() });
    }
    setIsEditing(false);
  };

  const handleUnlink = () => {
    onUpdate({ componentId: null });
  };

  return (
    <div className="flex flex-col items-center w-32">
      {/* Participant box */}
      <div
        className={`
          w-full p-2 border-2 rounded-md bg-background text-foreground text-center
          ${isLinked ? "border-blue-500" : "border-border"}
        `}
      >
        {isEditing ? (
          <Input
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleSave}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave();
              if (e.key === "Escape") {
                setEditValue(participant.label);
                setIsEditing(false);
              }
            }}
            className="h-6 text-xs text-center"
            autoFocus
          />
        ) : (
          <div className="flex items-center justify-between gap-1">
            <span
              className="flex-1 text-xs font-medium truncate cursor-pointer"
              onDoubleClick={() => setIsEditing(true)}
              title={participant.label}
            >
              {participant.label}
            </span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-5 w-5">
                  <MoreVertical className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setIsEditing(true)}>
                  <Pencil className="h-4 w-4 mr-2" />
                  Rename
                </DropdownMenuItem>
                {isLinked ? (
                  <DropdownMenuItem onClick={handleUnlink}>
                    <Link2Off className="h-4 w-4 mr-2" />
                    Unlink Component
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onClick={onLinkComponent}>
                    <Link2 className="h-4 w-4 mr-2" />
                    Link Component
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  onClick={onDelete}
                  className="text-red-600 focus:text-red-600"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>

      {/* Lifeline */}
      <div className="w-0.5 bg-border flex-1 min-h-16" />
    </div>
  );
});

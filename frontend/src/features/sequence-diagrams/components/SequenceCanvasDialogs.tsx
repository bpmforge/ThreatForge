"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ParticipantPicker } from "./ParticipantPicker";
import { AddMessageDialog } from "./AddMessageDialog";
import { ComponentLinkDialog } from "./ComponentLinkDialog";
import type {
  SequenceParticipant as ParticipantType,
  SequenceMessage as MessageType,
} from "../types";

interface SequenceCanvasDialogsProps {
  showParticipantPicker: boolean;
  onParticipantPickerChange: (open: boolean) => void;
  showAddMessage: boolean;
  onAddMessageChange: (open: boolean) => void;
  showComponentLink: boolean;
  onComponentLinkChange: (open: boolean) => void;
  participantToLink: ParticipantType | null;
  deleteConfirm: ParticipantType | null;
  onClearDeleteConfirm: () => void;
  participants: ParticipantType[];
  threatModelId: string;
  onAddParticipant: (label: string, componentId?: string) => Promise<void>;
  onAddMessage: (data: {
    label: string;
    fromId: string;
    toId: string;
    messageType: MessageType["messageType"];
  }) => Promise<void>;
  onLinkChange: (componentId: string | null) => void;
  onDeleteConfirm: () => void;
}

export function SequenceCanvasDialogs({
  showParticipantPicker,
  onParticipantPickerChange,
  showAddMessage,
  onAddMessageChange,
  showComponentLink,
  onComponentLinkChange,
  participantToLink,
  deleteConfirm,
  onClearDeleteConfirm,
  participants,
  threatModelId,
  onAddParticipant,
  onAddMessage,
  onLinkChange,
  onDeleteConfirm,
}: SequenceCanvasDialogsProps) {
  return (
    <>
      <ParticipantPicker
        open={showParticipantPicker}
        onOpenChange={onParticipantPickerChange}
        onAdd={onAddParticipant}
        threatModelId={threatModelId}
      />
      <AddMessageDialog
        open={showAddMessage}
        onOpenChange={onAddMessageChange}
        participants={participants}
        onAdd={onAddMessage}
      />
      <ComponentLinkDialog
        open={showComponentLink}
        onOpenChange={onComponentLinkChange}
        participant={participantToLink}
        threatModelId={threatModelId}
        onLink={onLinkChange}
      />
      <AlertDialog
        open={!!deleteConfirm}
        onOpenChange={() => onClearDeleteConfirm()}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Participant?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{deleteConfirm?.label}
              &quot;? All related messages will be deleted too.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={onDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

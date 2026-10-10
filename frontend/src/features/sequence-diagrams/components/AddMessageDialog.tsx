/**
 * AddMessageDialog - Dialog for adding messages to sequence diagram
 */
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { SequenceParticipant, MessageType } from "../types";

interface AddMessageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  participants: SequenceParticipant[];
  onAdd: (data: {
    label: string;
    fromId: string;
    toId: string;
    messageType: MessageType;
  }) => Promise<void>;
}

const MESSAGE_TYPES: {
  value: MessageType;
  label: string;
  description: string;
}[] = [
  {
    value: "SYNC",
    label: "Synchronous",
    description: "Solid line with filled arrow",
  },
  {
    value: "ASYNC",
    label: "Asynchronous",
    description: "Solid line with open arrow",
  },
  {
    value: "RETURN",
    label: "Return",
    description: "Dashed line with open arrow",
  },
  { value: "SELF", label: "Self", description: "Message to self" },
  {
    value: "CREATE",
    label: "Create",
    description: "Creates a new participant",
  },
  { value: "DESTROY", label: "Destroy", description: "Destroys a participant" },
];

export function AddMessageDialog({
  open,
  onOpenChange,
  participants,
  onAdd,
}: AddMessageDialogProps) {
  const [label, setLabel] = useState("");
  const [fromId, setFromId] = useState("");
  const [toId, setToId] = useState("");
  const [messageType, setMessageType] = useState<MessageType>("SYNC");
  const [isAdding, setIsAdding] = useState(false);

  const handleAdd = async () => {
    if (!label.trim() || !fromId || !toId) return;

    setIsAdding(true);
    try {
      await onAdd({
        label: label.trim(),
        fromId,
        toId,
        messageType,
      });
      // Reset form
      setLabel("");
      setFromId("");
      setToId("");
      setMessageType("SYNC");
    } finally {
      setIsAdding(false);
    }
  };

  const handleClose = () => {
    setLabel("");
    setFromId("");
    setToId("");
    setMessageType("SYNC");
    onOpenChange(false);
  };

  const canAdd = label.trim().length > 0 && fromId && toId;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Message</DialogTitle>
          <DialogDescription>
            Add a message between two participants in the sequence diagram.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* From Participant */}
          <div className="space-y-2">
            <Label htmlFor="from-participant">From</Label>
            <Select value={fromId} onValueChange={setFromId}>
              <SelectTrigger id="from-participant">
                <SelectValue placeholder="Select sender" />
              </SelectTrigger>
              <SelectContent>
                {participants.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* To Participant */}
          <div className="space-y-2">
            <Label htmlFor="to-participant">To</Label>
            <Select value={toId} onValueChange={setToId}>
              <SelectTrigger id="to-participant">
                <SelectValue placeholder="Select receiver" />
              </SelectTrigger>
              <SelectContent>
                {participants.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Message Type */}
          <div className="space-y-2">
            <Label htmlFor="message-type">Message Type</Label>
            <Select
              value={messageType}
              onValueChange={(v) => setMessageType(v as MessageType)}
            >
              <SelectTrigger id="message-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MESSAGE_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    <div className="flex flex-col">
                      <span>{type.label}</span>
                      <span className="text-xs text-muted-foreground">
                        {type.description}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Label */}
          <div className="space-y-2">
            <Label htmlFor="message-label">Message Label</Label>
            <Input
              id="message-label"
              placeholder="e.g., authenticate(), GET /api/users"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && canAdd && handleAdd()}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleAdd} disabled={!canAdd || isAdding}>
            {isAdding ? "Adding..." : "Add Message"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

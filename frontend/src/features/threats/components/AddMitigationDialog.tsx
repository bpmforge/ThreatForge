"use client";

/**
 * AddMitigationDialog - Dialog for creating new mitigations.
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PRIORITY_OPTIONS, MITIGATION_STRATEGY_OPTIONS } from "../constants";
import type { MitigationStrategy } from "../types";

interface AddMitigationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: {
    description: string;
    priority: string;
    strategy: MitigationStrategy;
    notes?: string;
  }) => void;
}

export function AddMitigationDialog({
  open,
  onOpenChange,
  onSubmit,
}: AddMitigationDialogProps) {
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("MEDIUM");
  const [strategy, setStrategy] = useState<MitigationStrategy>("PREVENTION");
  const [notes, setNotes] = useState("");

  const handleSubmit = () => {
    onSubmit({
      description,
      priority,
      strategy,
      notes: notes || undefined,
    });
    resetForm();
  };

  const resetForm = () => {
    setDescription("");
    setPriority("MEDIUM");
    setStrategy("PREVENTION");
    setNotes("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Mitigation</DialogTitle>
          <DialogDescription>
            Add a mitigation strategy for this threat
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="mitigation-description">
              Mitigation Description
            </Label>
            <Textarea
              id="mitigation-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the mitigation approach, implementation details, and expected effectiveness..."
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="mitigation-priority">Priority</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger id="mitigation-priority">
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITY_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="mitigation-strategy">Strategy</Label>
              <Select
                value={strategy}
                onValueChange={(v) => setStrategy(v as MitigationStrategy)}
              >
                <SelectTrigger id="mitigation-strategy">
                  <SelectValue placeholder="Select strategy" />
                </SelectTrigger>
                <SelectContent>
                  {MITIGATION_STRATEGY_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="mitigation-notes">Notes (optional)</Label>
            <Input
              id="mitigation-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional implementation notes..."
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!description.trim()}>
            Add Mitigation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

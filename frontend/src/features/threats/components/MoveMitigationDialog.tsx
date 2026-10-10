"use client";

/**
 * MoveMitigationDialog — Reassign a mitigation to a different threat.
 * Used to move auto-detected code-scan mitigations to the threats they address.
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useThreats, useMoveMitigation } from "../hooks/useThreats";
import type { Threat } from "../types";

interface MoveMitigationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  modelId: string;
  sourceThreat: Threat;
  mitigationId: string;
  mitigationDescription: string;
}

export function MoveMitigationDialog({
  open,
  onOpenChange,
  modelId,
  sourceThreat,
  mitigationId,
  mitigationDescription,
}: MoveMitigationDialogProps) {
  const [targetThreatId, setTargetThreatId] = useState("");
  const { data: threats = [] } = useThreats(modelId);
  const move = useMoveMitigation(modelId);

  const candidates = threats.filter(
    (t) => t.id !== sourceThreat.id && t.category !== "CODE_SCAN",
  );

  const handleMove = () => {
    if (!targetThreatId) return;
    move.mutate(
      { sourceThreatId: sourceThreat.id, mitigationId, targetThreatId },
      {
        onSuccess: () => {
          setTargetThreatId("");
          onOpenChange(false);
        },
      },
    );
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) setTargetThreatId("");
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Move Mitigation</DialogTitle>
          <DialogDescription className="text-xs">
            Reassign this control to the threat it addresses.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-1">
          <p className="text-xs bg-muted/50 rounded p-2 italic">
            &ldquo;{mitigationDescription}&rdquo;
          </p>
          <div className="space-y-1">
            <Label className="text-xs">Move to threat</Label>
            <Select value={targetThreatId} onValueChange={setTargetThreatId}>
              <SelectTrigger className="h-8 text-sm">
                <SelectValue placeholder="Select target threat…" />
              </SelectTrigger>
              <SelectContent>
                {candidates.map((t) => (
                  <SelectItem key={t.id} value={t.id} className="text-sm">
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleMove}
            disabled={!targetThreatId || move.isPending}
          >
            {move.isPending ? "Moving…" : "Move"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

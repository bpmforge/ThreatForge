"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import type { VerificationStatus } from "../types";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  citationId: string;
  currentStatus: VerificationStatus;
  citationLabel: string;
  onConfirm: (status: VerificationStatus, rationale: string) => void;
  isPending: boolean;
}

export function CitationOverrideDialog({
  open,
  onOpenChange,
  citationLabel,
  currentStatus,
  onConfirm,
  isPending,
}: Props) {
  const [rationale, setRationale] = useState("");
  const [newStatus, setNewStatus] = useState<VerificationStatus>("EXEMPT");

  function handleConfirm() {
    if (rationale.trim().length < 10) return;
    onConfirm(newStatus, rationale.trim());
  }

  function handleOpenChange(o: boolean) {
    if (!o) {
      setRationale("");
      setNewStatus("EXEMPT");
    }
    onOpenChange(o);
  }

  const isValid = rationale.trim().length >= 10;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Override Citation Verification</DialogTitle>
          <DialogDescription>
            Citation: <strong>{citationLabel}</strong> — current status:{" "}
            <strong>{currentStatus}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>New status</Label>
            <RadioGroup
              value={newStatus}
              onValueChange={(v) => setNewStatus(v as VerificationStatus)}
              className="flex flex-col gap-2"
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value="EXEMPT" id="status-exempt" />
                <Label htmlFor="status-exempt" className="font-normal">
                  Exempt — accepted by reviewer
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="UNVERIFIED" id="status-unverified" />
                <Label htmlFor="status-unverified" className="font-normal">
                  Unverified — mark as failed
                </Label>
              </div>
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label htmlFor="override-rationale">
              Rationale{" "}
              <span className="text-muted-foreground">(min 10 chars)</span>
            </Label>
            <Textarea
              id="override-rationale"
              value={rationale}
              onChange={(e) => setRationale(e.target.value)}
              placeholder="Explain why this citation status is being overridden…"
              rows={3}
              aria-describedby="rationale-hint"
            />
            {rationale.length > 0 && rationale.trim().length < 10 && (
              <p id="rationale-hint" className="text-xs text-destructive">
                Rationale must be at least 10 characters.
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={!isValid || isPending}>
            {isPending ? "Saving…" : "Confirm Override"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { Loader2 } from "lucide-react";
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

interface RegenerateBackupCodesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  regenerateCode: string;
  onRegenerateCodeChange: (value: string) => void;
  onRegenerate: () => void;
  isRegenerating: boolean;
}

export function RegenerateBackupCodesDialog({
  open,
  onOpenChange,
  regenerateCode,
  onRegenerateCodeChange,
  onRegenerate,
  isRegenerating,
}: RegenerateBackupCodesDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Regenerate Backup Codes</DialogTitle>
          <DialogDescription>
            Enter your verification code to generate new backup codes. Your
            existing codes will be invalidated.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label>Verification Code</Label>
          <Input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            placeholder="000000"
            value={regenerateCode}
            onChange={(e) =>
              onRegenerateCodeChange(e.target.value.replace(/\D/g, ""))
            }
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={onRegenerate}
            disabled={regenerateCode.length !== 6 || isRegenerating}
          >
            {isRegenerating && (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            )}
            Generate New Codes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

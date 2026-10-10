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

interface DisableTwoFactorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  disableCode: string;
  onDisableCodeChange: (value: string) => void;
  disablePassword: string;
  onDisablePasswordChange: (value: string) => void;
  onDisable: () => void;
  isDisabling: boolean;
}

export function DisableTwoFactorDialog({
  open,
  onOpenChange,
  disableCode,
  onDisableCodeChange,
  disablePassword,
  onDisablePasswordChange,
  onDisable,
  isDisabling,
}: DisableTwoFactorDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Disable Two-Factor Authentication</DialogTitle>
          <DialogDescription>
            Enter a verification code and your password to disable 2FA. This
            will make your account less secure.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Verification Code</Label>
            <Input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              placeholder="000000"
              value={disableCode}
              onChange={(e) =>
                onDisableCodeChange(e.target.value.replace(/\D/g, ""))
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="disable-2fa-password">Password</Label>
            <Input
              id="disable-2fa-password"
              type="password"
              autoComplete="current-password"
              placeholder="Leave blank if you only use single sign-on"
              value={disablePassword}
              onChange={(e) => onDisablePasswordChange(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={onDisable}
            disabled={!disableCode || isDisabling}
          >
            {isDisabling && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Disable 2FA
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

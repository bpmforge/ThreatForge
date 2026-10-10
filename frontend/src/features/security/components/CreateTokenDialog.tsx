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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

interface Scope {
  value: string;
  label: string;
}

interface CreateTokenDialogProps {
  open: boolean;
  tokenName: string;
  expiresIn: string;
  selectedScopes: string[];
  availableScopes: Scope[];
  isPending: boolean;
  onNameChange: (value: string) => void;
  onExpiresChange: (value: string) => void;
  onToggleScope: (scope: string) => void;
  onSubmit: () => void;
  onClose: () => void;
}

export function CreateTokenDialog({
  open,
  tokenName,
  expiresIn,
  selectedScopes,
  availableScopes,
  isPending,
  onNameChange,
  onExpiresChange,
  onToggleScope,
  onSubmit,
  onClose,
}: CreateTokenDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create API Token</DialogTitle>
          <DialogDescription>
            Create a new personal access token for API access
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="token-name">Token Name</Label>
            <Input
              id="token-name"
              placeholder="e.g., CI/CD Pipeline"
              value={tokenName}
              onChange={(e) => onNameChange(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Expiration</Label>
            <Select value={expiresIn} onValueChange={onExpiresChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select expiration" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="never">No expiration</SelectItem>
                <SelectItem value="7days">7 days</SelectItem>
                <SelectItem value="30days">30 days</SelectItem>
                <SelectItem value="90days">90 days</SelectItem>
                <SelectItem value="1year">1 year</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Scopes</Label>
            <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto p-2 border rounded-lg">
              {availableScopes.map((scope) => (
                <label
                  key={scope.value}
                  className="flex items-center gap-2 text-sm cursor-pointer"
                >
                  <Checkbox
                    checked={selectedScopes.includes(scope.value)}
                    onCheckedChange={() => onToggleScope(scope.value)}
                  />
                  {scope.label}
                </label>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Select the permissions this token should have
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={onSubmit}
            disabled={isPending || !tokenName || selectedScopes.length === 0}
          >
            {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Create Token
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

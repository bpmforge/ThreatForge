"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { KeyRound } from "lucide-react";
import type { AdminSettings } from "./useAdminSettings";

interface PasswordPolicyCardProps {
  settings: AdminSettings;
  onUpdate: (updates: Partial<AdminSettings>) => void;
}

export function PasswordPolicyCard({
  settings,
  onUpdate,
}: PasswordPolicyCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="h-5 w-5" />
          Password Policy
        </CardTitle>
        <CardDescription>
          Configure password requirements for user accounts
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="passwordMinLength">Minimum Length</Label>
            <Input
              id="passwordMinLength"
              type="number"
              min={8}
              max={128}
              value={settings.passwordMinLength}
              onChange={(e) => onUpdate({ passwordMinLength: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              Minimum number of characters required (8-128)
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <Label className="text-base">Character Requirements</Label>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <Label>Uppercase Letters</Label>
                <p className="text-xs text-muted-foreground">A-Z</p>
              </div>
              <Switch
                checked={settings.passwordRequireUppercase}
                onCheckedChange={(checked) =>
                  onUpdate({ passwordRequireUppercase: checked })
                }
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <Label>Lowercase Letters</Label>
                <p className="text-xs text-muted-foreground">a-z</p>
              </div>
              <Switch
                checked={settings.passwordRequireLowercase}
                onCheckedChange={(checked) =>
                  onUpdate({ passwordRequireLowercase: checked })
                }
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <Label>Numbers</Label>
                <p className="text-xs text-muted-foreground">0-9</p>
              </div>
              <Switch
                checked={settings.passwordRequireNumbers}
                onCheckedChange={(checked) =>
                  onUpdate({ passwordRequireNumbers: checked })
                }
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <Label>Special Characters</Label>
                <p className="text-xs text-muted-foreground">!@#$%^&amp;*...</p>
              </div>
              <Switch
                checked={settings.passwordRequireSpecialChars}
                onCheckedChange={(checked) =>
                  onUpdate({ passwordRequireSpecialChars: checked })
                }
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

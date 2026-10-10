"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Shield } from "lucide-react";
import type { AdminSettings } from "./useAdminSettings";

interface MfaSettingsCardProps {
  settings: AdminSettings;
  onUpdate: (updates: Partial<AdminSettings>) => void;
}

export function MfaSettingsCard({ settings, onUpdate }: MfaSettingsCardProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Multi-Factor Authentication
            </CardTitle>
            <CardDescription>
              Require users to set up two-factor authentication
            </CardDescription>
          </div>
          {settings.mfaRequired && (
            <Badge
              variant="outline"
              className="text-green-600 border-green-600"
            >
              Required
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>Require 2FA for All Users</Label>
            <p className="text-sm text-muted-foreground">
              Users must enable two-factor authentication to access the
              application
            </p>
          </div>
          <Switch
            checked={settings.mfaRequired}
            onCheckedChange={(checked) => onUpdate({ mfaRequired: checked })}
          />
        </div>
        {settings.mfaRequired && (
          <div className="rounded-lg bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 p-4">
            <div className="flex items-start gap-2">
              <Shield className="h-5 w-5 text-blue-600 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                  MFA Enforcement Enabled
                </p>
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  Users without 2FA configured will be redirected to set it up
                  on their next login. Existing sessions will continue until
                  they expire.
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

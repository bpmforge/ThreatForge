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
import { Shield, AlertCircle } from "lucide-react";
import type { AdminSettings } from "./useAdminSettings";

interface IpAllowlistCardProps {
  settings: AdminSettings;
  onUpdate: (updates: Partial<AdminSettings>) => void;
}

export function IpAllowlistCard({ settings, onUpdate }: IpAllowlistCardProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              IP Allowlist
            </CardTitle>
            <CardDescription>
              Restrict API access to specific IP addresses or CIDR ranges
            </CardDescription>
          </div>
          {settings.ipAllowlistEnabled && settings.ipAllowlistText.trim() && (
            <Badge
              variant="outline"
              className="text-green-600 border-green-600"
            >
              Active
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>Enable IP Allowlist</Label>
            <p className="text-sm text-muted-foreground">
              Only allow API access from specified IP addresses
            </p>
          </div>
          <Switch
            checked={settings.ipAllowlistEnabled}
            onCheckedChange={(checked) =>
              onUpdate({ ipAllowlistEnabled: checked })
            }
          />
        </div>
        {settings.ipAllowlistEnabled && (
          <>
            <div className="space-y-2">
              <Label htmlFor="ipAllowlist">Allowed IP Addresses</Label>
              <textarea
                id="ipAllowlist"
                className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 font-mono"
                placeholder={"192.168.1.0/24\n10.0.0.1\n172.16.0.0/16"}
                value={settings.ipAllowlistText}
                onChange={(e) => onUpdate({ ipAllowlistText: e.target.value })}
              />
              <p className="text-sm text-muted-foreground">
                Enter one IP address or CIDR range per line
              </p>
            </div>
            <div className="rounded-lg bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 p-4">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                    Warning: Be careful with this setting
                  </p>
                  <p className="text-sm text-amber-700 dark:text-amber-300">
                    If you enable IP allowlisting and don&apos;t include your
                    current IP address, you will be locked out of the admin
                    panel.
                  </p>
                </div>
              </div>
            </div>
            {settings.ipAllowlistText.trim() && (
              <div className="rounded-lg border p-4 space-y-2">
                <h4 className="font-medium text-sm">Current Allowlist</h4>
                <div className="flex flex-wrap gap-2">
                  {settings.ipAllowlistText
                    .split("\n")
                    .map((line) => line.trim())
                    .filter((line) => line.length > 0)
                    .map((ip, i) => (
                      <Badge key={i} variant="secondary" className="font-mono">
                        {ip}
                      </Badge>
                    ))}
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

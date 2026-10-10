/**
 * General Settings Tab
 *
 * Authentication, organization, AI, and audit settings.
 */
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AdminSettings, MemberRole } from "./useAdminSettings";
import { NvdApiKeyCard } from "./NvdApiKeyCard";

interface GeneralTabProps {
  settings: AdminSettings;
  onUpdate: (updates: Partial<AdminSettings>) => void;
}

export function GeneralTab({ settings, onUpdate }: GeneralTabProps) {
  return (
    <div className="space-y-6">
      {/* Authentication Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Authentication</CardTitle>
          <CardDescription>
            Configure user authentication and session settings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Allow Sign-ups</Label>
              <p className="text-sm text-muted-foreground">
                Allow new users to create accounts
              </p>
            </div>
            <Switch
              checked={settings.allowSignups}
              onCheckedChange={(checked) => onUpdate({ allowSignups: checked })}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Require Email Verification</Label>
              <p className="text-sm text-muted-foreground">
                Users must verify email before accessing
              </p>
            </div>
            <Switch
              checked={settings.requireEmailVerification}
              onCheckedChange={(checked) =>
                onUpdate({ requireEmailVerification: checked })
              }
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="defaultRole">Default User Role</Label>
              <Select
                value={settings.defaultUserRole}
                onValueChange={(v) =>
                  onUpdate({ defaultUserRole: v as MemberRole })
                }
              >
                <SelectTrigger id="defaultRole">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="VIEWER">Viewer</SelectItem>
                  <SelectItem value="EDITOR">Editor</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="sessionTimeout">Session Timeout (hours)</Label>
              <Input
                id="sessionTimeout"
                type="number"
                value={settings.sessionTimeout}
                onChange={(e) => onUpdate({ sessionTimeout: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="maxLoginAttempts">Max Login Attempts</Label>
              <Input
                id="maxLoginAttempts"
                type="number"
                min={1}
                max={20}
                value={settings.maxLoginAttempts}
                onChange={(e) => onUpdate({ maxLoginAttempts: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Number of failed attempts before account lockout
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="lockoutDurationMinutes">
                Lockout Duration (minutes)
              </Label>
              <Input
                id="lockoutDurationMinutes"
                type="number"
                min={1}
                max={1440}
                value={settings.lockoutDurationMinutes}
                onChange={(e) =>
                  onUpdate({ lockoutDurationMinutes: e.target.value })
                }
              />
              <p className="text-xs text-muted-foreground">
                How long accounts are locked after max failed attempts
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Organization Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Organizations</CardTitle>
          <CardDescription>
            Configure organization limits and defaults
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="maxProjects">Max Projects per Organization</Label>
            <Input
              id="maxProjects"
              type="number"
              value={settings.maxProjectsPerOrg}
              onChange={(e) => onUpdate({ maxProjectsPerOrg: e.target.value })}
              className="max-w-xs"
            />
            <p className="text-sm text-muted-foreground">
              Set to 0 for unlimited
            </p>
          </div>
        </CardContent>
      </Card>

      {/* AI Settings */}
      <Card>
        <CardHeader>
          <CardTitle>AI Configuration</CardTitle>
          <CardDescription>
            Configure AI-powered threat analysis
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Enable AI Features</Label>
              <p className="text-sm text-muted-foreground">
                Allow AI-assisted threat identification
              </p>
            </div>
            <Switch
              checked={settings.enableAI}
              onCheckedChange={(checked) => onUpdate({ enableAI: checked })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="aiProvider">AI Provider</Label>
            <Select
              value={settings.aiProvider}
              onValueChange={(v) => onUpdate({ aiProvider: v })}
              disabled={!settings.enableAI}
            >
              <SelectTrigger id="aiProvider" className="max-w-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="anthropic">Anthropic (Claude)</SelectItem>
                <SelectItem value="openai">OpenAI (GPT-4)</SelectItem>
                <SelectItem value="google">Google (Gemini)</SelectItem>
                <SelectItem value="ollama">Ollama (Local)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Audit Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Audit & Compliance</CardTitle>
          <CardDescription>
            Configure audit log retention and compliance settings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="auditRetention">Audit Log Retention (days)</Label>
            <Input
              id="auditRetention"
              type="number"
              value={settings.auditRetentionDays}
              onChange={(e) => onUpdate({ auditRetentionDays: e.target.value })}
              className="max-w-xs"
            />
            <p className="text-sm text-muted-foreground">
              Logs older than this will be automatically deleted
            </p>
          </div>
        </CardContent>
      </Card>
      <NvdApiKeyCard settings={settings} onUpdate={onUpdate} />
    </div>
  );
}

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

interface SmtpConfigCardProps {
  smtpConfig: {
    host: string;
    port: number;
    secure: boolean;
    user: string;
    pass: string;
  };
  onChange: (updates: Partial<SmtpConfigCardProps["smtpConfig"]>) => void;
}

export function SmtpConfigCard({ smtpConfig, onChange }: SmtpConfigCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>SMTP Configuration</CardTitle>
        <CardDescription>Configure your SMTP server settings</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="smtpHost">SMTP Host</Label>
            <Input
              id="smtpHost"
              placeholder="smtp.example.com"
              value={smtpConfig.host}
              onChange={(e) => onChange({ host: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="smtpPort">Port</Label>
            <Input
              id="smtpPort"
              type="number"
              placeholder="587"
              value={smtpConfig.port}
              onChange={(e) =>
                onChange({ port: parseInt(e.target.value) || 587 })
              }
            />
          </div>
        </div>

        <div className="flex items-center justify-between max-w-md">
          <div className="space-y-0.5">
            <Label>Use TLS/SSL</Label>
            <p className="text-sm text-muted-foreground">
              Enable for port 465, disable for 587 with STARTTLS
            </p>
          </div>
          <Switch
            checked={smtpConfig.secure}
            onCheckedChange={(checked) => onChange({ secure: checked })}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="smtpUser">Username</Label>
            <Input
              id="smtpUser"
              placeholder="username"
              value={smtpConfig.user}
              onChange={(e) => onChange({ user: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="smtpPass">Password</Label>
            <Input
              id="smtpPass"
              type="password"
              placeholder="••••••••"
              value={smtpConfig.pass}
              onChange={(e) => onChange({ pass: e.target.value })}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

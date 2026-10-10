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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Mail } from "lucide-react";
import {
  type EmailProvider,
  type SystemSettings,
} from "@/features/admin/services/api";
import { useEmailConfig } from "./useEmailConfig";
import { SmtpConfigCard } from "./SmtpConfigCard";
import { SesConfigCard } from "./SesConfigCard";
import { EmailTestCard } from "./EmailTestCard";

interface EmailConfigTabProps {
  settings: {
    emailProvider: EmailProvider;
    emailFrom: string;
    emailConfig: Record<string, unknown> | null;
  };
  onSettingsChange: (updates: Partial<SystemSettings>) => void;
}

const EMAIL_PROVIDERS: {
  value: EmailProvider;
  label: string;
  description: string;
}[] = [
  {
    value: "none",
    label: "None (Disabled)",
    description: "Email sending is disabled",
  },
  { value: "smtp", label: "SMTP", description: "Connect to any SMTP server" },
  { value: "sendgrid", label: "SendGrid", description: "Use SendGrid API" },
  { value: "resend", label: "Resend", description: "Use Resend API" },
  {
    value: "ses",
    label: "AWS SES",
    description: "Amazon Simple Email Service",
  },
];

export function EmailConfigTab({
  settings,
  onSettingsChange,
}: EmailConfigTabProps) {
  const f = useEmailConfig(settings, onSettingsChange);
  const isConfigured = settings.emailProvider !== "none" && settings.emailFrom;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Email Provider
              </CardTitle>
              <CardDescription>
                Choose how transactional emails are sent
              </CardDescription>
            </div>
            {isConfigured && (
              <Badge
                variant="outline"
                className="text-green-600 border-green-600"
              >
                Configured
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="emailProvider">Provider</Label>
            <Select
              value={settings.emailProvider}
              onValueChange={(v) => f.handleProviderChange(v as EmailProvider)}
            >
              <SelectTrigger id="emailProvider" className="max-w-md">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EMAIL_PROVIDERS.map((provider) => (
                  <SelectItem key={provider.value} value={provider.value}>
                    <div>
                      <span>{provider.label}</span>
                      <span className="text-muted-foreground ml-2 text-xs">
                        - {provider.description}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {settings.emailProvider !== "none" && (
            <div className="space-y-2">
              <Label htmlFor="emailFrom">From Address</Label>
              <Input
                id="emailFrom"
                type="text"
                placeholder="ThreatForge <noreply@example.com>"
                value={settings.emailFrom}
                onChange={(e) => f.handleFromChange(e.target.value)}
                className="max-w-md"
              />
              <p className="text-sm text-muted-foreground">
                The sender name and email address for outgoing emails
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {settings.emailProvider === "smtp" && (
        <SmtpConfigCard
          smtpConfig={f.smtpConfig}
          onChange={f.handleSmtpConfigChange}
        />
      )}

      {(settings.emailProvider === "sendgrid" ||
        settings.emailProvider === "resend") && (
        <Card>
          <CardHeader>
            <CardTitle>
              {settings.emailProvider === "sendgrid" ? "SendGrid" : "Resend"}{" "}
              Configuration
            </CardTitle>
            <CardDescription>
              Enter your API key from the{" "}
              {settings.emailProvider === "sendgrid" ? "SendGrid" : "Resend"}{" "}
              dashboard
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="apiKey">API Key</Label>
              <Input
                id="apiKey"
                type="password"
                placeholder="Enter your API key"
                value={f.apiKeyConfig.apiKey}
                onChange={(e) => f.handleApiKeyChange(e.target.value)}
                className="max-w-md font-mono"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {settings.emailProvider === "ses" && (
        <SesConfigCard
          sesConfig={f.sesConfig}
          onChange={f.handleSesConfigChange}
        />
      )}

      {settings.emailProvider !== "none" && (
        <EmailTestCard
          testStatus={f.testStatus}
          testError={f.testError}
          testEmailAddress={f.testEmailAddress}
          sendingTest={f.sendingTest}
          sendTestStatus={f.sendTestStatus}
          onTestEmailAddressChange={f.setTestEmailAddress}
          onTestConnection={f.handleTestConnection}
          onSendTestEmail={f.handleSendTestEmail}
        />
      )}
    </div>
  );
}

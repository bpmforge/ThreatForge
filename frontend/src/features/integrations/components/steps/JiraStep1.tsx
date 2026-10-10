"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle2, Loader2, ExternalLink } from "lucide-react";

interface JiraStep1Props {
  name: string;
  onNameChange: (value: string) => void;
  baseUrl: string;
  onBaseUrlChange: (value: string) => void;
  email: string;
  onEmailChange: (value: string) => void;
  apiToken: string;
  onApiTokenChange: (value: string) => void;
  connectionVerified: boolean;
  projectCount: number;
  isPending: boolean;
  isTestPending: boolean;
  onTestConnection: () => void;
}

export function JiraStep1({
  name,
  onNameChange,
  baseUrl,
  onBaseUrlChange,
  email,
  onEmailChange,
  apiToken,
  onApiTokenChange,
  connectionVerified,
  projectCount,
  isPending,
  isTestPending,
  onTestConnection,
}: JiraStep1Props) {
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="jira-name">Integration Name</Label>
        <Input
          id="jira-name"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="e.g., Security Team JIRA"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="jira-url">JIRA Site URL</Label>
        <Input
          id="jira-url"
          value={baseUrl}
          onChange={(e) => onBaseUrlChange(e.target.value)}
          placeholder="https://your-domain.atlassian.net"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="jira-email">Email</Label>
        <Input
          id="jira-email"
          type="email"
          value={email}
          onChange={(e) => onEmailChange(e.target.value)}
          placeholder="your-email@company.com"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="jira-token">API Token</Label>
        <Input
          id="jira-token"
          type="password"
          value={apiToken}
          onChange={(e) => onApiTokenChange(e.target.value)}
          placeholder="Your JIRA API token"
        />
        <p className="text-xs text-muted-foreground">
          <a
            href="https://id.atlassian.com/manage-profile/security/api-tokens"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:underline inline-flex items-center gap-1"
          >
            Create an API token
            <ExternalLink className="h-3 w-3" />
          </a>
        </p>
      </div>

      {connectionVerified && (
        <Alert className="bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-700 dark:text-green-300">
            Connection successful! Found {projectCount} projects.
          </AlertDescription>
        </Alert>
      )}

      {!connectionVerified && (
        <Button
          onClick={onTestConnection}
          disabled={!baseUrl || !email || !apiToken || isPending}
          variant="outline"
          className="w-full"
        >
          {isTestPending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Testing Connection...
            </>
          ) : (
            "Test Connection"
          )}
        </Button>
      )}
    </>
  );
}

"use client";

import { Shield, Loader2, Key, Globe, Lock } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useSSOSettings } from "../hooks/useSSOSettings";
import { SSOProviderCard } from "./sso/SSOProviderCard";
import { SSOConfigForm } from "./sso/SSOConfigForm";
import { SSOTestResult } from "./sso/SSOTestResult";

interface SSOSettingsProps {
  orgId: string;
  canEdit: boolean;
}

export function SSOSettings({ orgId, canEdit }: SSOSettingsProps) {
  const s = useSSOSettings(orgId);

  if (s.isLoading) {
    return (
      <Card>
        <CardContent className="py-12 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  const isSAML = s.provider === "SAML";
  const isOIDC = ["OIDC", "AZURE_AD", "GOOGLE", "OKTA"].includes(s.provider);

  const testResultProps = {
    domain: s.domain,
    enforced: s.enforced,
    canEdit,
    enabled: s.enabled,
    isCurrentlyEnabled: !!s.settings?.enabled,
    hasChanges: s.hasChanges,
    isUpdatePending: s.updateMutation.isPending,
    isDeletePending: s.deleteMutation.isPending,
    isTestPending: s.testMutation.isPending,
    onDomainChange: s.setDomain,
    onEnforcedChange: s.setEnforced,
    onTest: () => s.testMutation.mutate(),
    onDisable: () => s.deleteMutation.mutate(),
    onSave: s.handleSave,
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="size-5" />
          Single Sign-On (SSO)
        </CardTitle>
        <CardDescription>
          Configure SAML or OIDC authentication for your organization members.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="sso-enabled">Enable SSO</Label>
            <p className="text-sm text-muted-foreground">
              Allow members to sign in with your identity provider
            </p>
          </div>
          <Switch
            id="sso-enabled"
            checked={s.enabled}
            onCheckedChange={s.setEnabled}
            disabled={!canEdit}
          />
        </div>

        {s.enabled && (
          <>
            <SSOProviderCard
              provider={s.provider}
              callbackUrls={s.callbackUrls}
              copiedField={s.copiedField}
              canEdit={canEdit}
              onProviderChange={s.setProvider}
              onCopy={s.handleCopy}
            />

            <Tabs defaultValue="credentials" className="space-y-4">
              <TabsList>
                <TabsTrigger value="credentials">
                  <Key className="size-4 mr-2" />
                  Credentials
                </TabsTrigger>
                <TabsTrigger value="endpoints">
                  <Globe className="size-4 mr-2" />
                  Endpoints
                </TabsTrigger>
                <TabsTrigger value="security">
                  <Lock className="size-4 mr-2" />
                  Security
                </TabsTrigger>
              </TabsList>
              <SSOConfigForm
                config={s.config}
                isSAML={isSAML}
                isOIDC={isOIDC}
                canEdit={canEdit}
                onUpdateConfig={s.updateConfig}
              />
              <SSOTestResult {...testResultProps} />
            </Tabs>
          </>
        )}

        {!s.enabled && <SSOTestResult {...testResultProps} />}
      </CardContent>
    </Card>
  );
}

"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Shield, ExternalLink } from "lucide-react";
import type { AdminSettings } from "./useAdminSettings";

interface SamlSettingsCardProps {
  settings: AdminSettings;
  onUpdate: (updates: Partial<AdminSettings>) => void;
}

export function SamlSettingsCard({
  settings,
  onUpdate,
}: SamlSettingsCardProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              SAML Single Sign-On
            </CardTitle>
            <CardDescription>
              Configure enterprise SSO using SAML 2.0 via BoxyHQ Jackson
            </CardDescription>
          </div>
          {settings.samlEnabled && settings.samlJacksonUrl && (
            <Badge
              variant="outline"
              className="text-green-600 border-green-600"
            >
              Enabled
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>Enable SAML SSO</Label>
            <p className="text-sm text-muted-foreground">
              Allow users to sign in with their corporate identity provider
            </p>
          </div>
          <Switch
            checked={settings.samlEnabled}
            onCheckedChange={(checked) => onUpdate({ samlEnabled: checked })}
          />
        </div>
        {settings.samlEnabled && (
          <>
            <div className="space-y-2">
              <Label htmlFor="jacksonUrl">BoxyHQ Jackson URL</Label>
              <Input
                id="jacksonUrl"
                type="url"
                placeholder="https://jackson.yourdomain.com"
                value={settings.samlJacksonUrl}
                onChange={(e) => onUpdate({ samlJacksonUrl: e.target.value })}
              />
              <p className="text-sm text-muted-foreground">
                The URL of your BoxyHQ Jackson SAML service
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="productId">Product ID</Label>
              <Input
                id="productId"
                placeholder="flow-threat-model"
                value={settings.samlProductId}
                onChange={(e) => onUpdate({ samlProductId: e.target.value })}
              />
              <p className="text-sm text-muted-foreground">
                Unique identifier for this application in Jackson
              </p>
            </div>
            <div className="rounded-lg bg-muted/50 p-4 space-y-3">
              <h4 className="font-medium text-sm">Setup Instructions</h4>
              <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                <li>Deploy BoxyHQ Jackson (self-hosted or cloud)</li>
                <li>
                  Configure your Identity Provider (Okta, Azure AD, etc.) in
                  Jackson
                </li>
                <li>Enter the Jackson URL above</li>
                <li>
                  Set the following environment variables:
                  <code className="block mt-1 p-2 bg-background rounded text-xs">
                    AUTH_BOXYHQ_SAML_ISSUER=
                    {settings.samlJacksonUrl ||
                      "https://jackson.yourdomain.com"}
                    <br />
                    AUTH_BOXYHQ_SAML_ID=dummy
                    <br />
                    AUTH_BOXYHQ_SAML_SECRET=dummy
                  </code>
                </li>
                <li>Restart the application</li>
              </ol>
              <div className="pt-2">
                <Button variant="outline" size="sm" asChild>
                  <a
                    href="https://boxyhq.com/docs/jackson/overview"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    BoxyHQ Documentation
                  </a>
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

"use client";

/**
 * SSOConfigForm — Credentials and Endpoints tab content for SSO configuration.
 *
 * Renders the Credentials tab (client ID, secret, certificate) and
 * Endpoints tab (issuer URL, entry point, OIDC discovery URLs).
 *
 * Extracted from SSOSettings to keep the page-level orchestrator ≤200 lines.
 */

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { TabsContent } from "@/components/ui/tabs";

interface SSOConfig {
  clientId: string;
  clientSecret: string;
  issuer?: string;
  entryPoint?: string;
  certificate?: string;
  authorizationUrl?: string;
  tokenUrl?: string;
  userinfoUrl?: string;
}

interface SSOConfigFormProps {
  config: SSOConfig;
  isSAML: boolean;
  isOIDC: boolean;
  canEdit: boolean;
  onUpdateConfig: (key: keyof SSOConfig, value: string) => void;
}

export function SSOConfigForm({
  config,
  isSAML,
  isOIDC,
  canEdit,
  onUpdateConfig,
}: SSOConfigFormProps) {
  return (
    <>
      <TabsContent value="credentials" className="space-y-4">
        <div className="grid gap-4">
          <div className="space-y-2">
            <Label htmlFor="client-id">Client ID / Entity ID</Label>
            <Input
              id="client-id"
              value={config.clientId}
              onChange={(e) => onUpdateConfig("clientId", e.target.value)}
              placeholder="Enter your IdP client ID"
              disabled={!canEdit}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="client-secret">Client Secret</Label>
            <Input
              id="client-secret"
              type="password"
              value={config.clientSecret}
              onChange={(e) => onUpdateConfig("clientSecret", e.target.value)}
              placeholder="Enter your IdP client secret"
              disabled={!canEdit}
            />
          </div>
          {isSAML && (
            <div className="space-y-2">
              <Label htmlFor="certificate">IdP Certificate (X.509)</Label>
              <Textarea
                id="certificate"
                value={config.certificate}
                onChange={(e) => onUpdateConfig("certificate", e.target.value)}
                placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----"
                rows={4}
                className="font-mono text-xs"
                disabled={!canEdit}
              />
            </div>
          )}
        </div>
      </TabsContent>

      <TabsContent value="endpoints" className="space-y-4">
        <div className="grid gap-4">
          <div className="space-y-2">
            <Label htmlFor="issuer">Issuer URL</Label>
            <Input
              id="issuer"
              value={config.issuer}
              onChange={(e) => onUpdateConfig("issuer", e.target.value)}
              placeholder={
                isSAML
                  ? "https://idp.example.com/saml"
                  : "https://idp.example.com"
              }
              disabled={!canEdit}
            />
          </div>
          {isSAML && (
            <div className="space-y-2">
              <Label htmlFor="entry-point">SSO Entry Point URL</Label>
              <Input
                id="entry-point"
                value={config.entryPoint}
                onChange={(e) => onUpdateConfig("entryPoint", e.target.value)}
                placeholder="https://idp.example.com/saml/sso"
                disabled={!canEdit}
              />
            </div>
          )}
          {isOIDC && (
            <>
              <div className="space-y-2">
                <Label htmlFor="auth-url">Authorization URL (optional)</Label>
                <Input
                  id="auth-url"
                  value={config.authorizationUrl}
                  onChange={(e) =>
                    onUpdateConfig("authorizationUrl", e.target.value)
                  }
                  placeholder="Auto-discovered from issuer"
                  disabled={!canEdit}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="token-url">Token URL (optional)</Label>
                <Input
                  id="token-url"
                  value={config.tokenUrl}
                  onChange={(e) => onUpdateConfig("tokenUrl", e.target.value)}
                  placeholder="Auto-discovered from issuer"
                  disabled={!canEdit}
                />
              </div>
            </>
          )}
        </div>
      </TabsContent>
    </>
  );
}

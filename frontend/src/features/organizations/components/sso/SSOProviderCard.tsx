"use client";

/**
 * SSOProviderCard — provider selector and callback URL display.
 *
 * Shows the identity provider <Select> and the Alert with callback URLs
 * that the admin must configure in their IdP.
 *
 * Extracted from SSOSettings to keep the page-level orchestrator ≤200 lines.
 */

import { Check, Copy, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";

type SSOProvider = "SAML" | "OIDC" | "AZURE_AD" | "GOOGLE" | "OKTA";

interface CallbackUrls {
  saml: string;
  oidc: string;
  acsUrl: string;
  entityId: string;
}

const PROVIDER_LABELS: Record<SSOProvider, string> = {
  SAML: "SAML 2.0",
  OIDC: "OpenID Connect (OIDC)",
  AZURE_AD: "Microsoft Entra ID",
  GOOGLE: "Google Workspace",
  OKTA: "Okta",
};

interface SSOProviderCardProps {
  provider: SSOProvider;
  callbackUrls: CallbackUrls | undefined;
  copiedField: string | null;
  canEdit: boolean;
  onProviderChange: (provider: SSOProvider) => void;
  onCopy: (text: string, field: string) => void;
}

export function SSOProviderCard({
  provider,
  callbackUrls,
  copiedField,
  canEdit,
  onProviderChange,
  onCopy,
}: SSOProviderCardProps) {
  const isSAML = provider === "SAML";

  return (
    <>
      <div className="space-y-2">
        <Label>Identity Provider</Label>
        <Select
          value={provider}
          onValueChange={(value) => onProviderChange(value as SSOProvider)}
          disabled={!canEdit}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(PROVIDER_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {callbackUrls && (
        <Alert>
          <ExternalLink className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-2 mt-2">
              <p className="font-medium">Configure these URLs in your IdP:</p>
              <div className="grid gap-2 text-sm">
                <div className="flex items-center justify-between bg-muted p-2 rounded">
                  <span className="font-mono text-xs truncate flex-1">
                    {isSAML ? callbackUrls.acsUrl : callbackUrls.oidc}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      onCopy(
                        isSAML ? callbackUrls.acsUrl : callbackUrls.oidc,
                        "callback",
                      )
                    }
                  >
                    {copiedField === "callback" ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                {isSAML && (
                  <div className="flex items-center justify-between bg-muted p-2 rounded">
                    <span className="text-muted-foreground mr-2">
                      Entity ID:
                    </span>
                    <span className="font-mono text-xs truncate flex-1">
                      {callbackUrls.entityId}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onCopy(callbackUrls.entityId, "entity")}
                    >
                      {copiedField === "entity" ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </AlertDescription>
        </Alert>
      )}
    </>
  );
}

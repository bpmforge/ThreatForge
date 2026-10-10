"use client";

/**
 * The install's NVD API key, used by supply-chain scans and threat research
 * to look up CVEs. Each install registers its own free key with NIST; the
 * key is stored encrypted and never shown again after saving.
 */
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Bug } from "lucide-react";
import type { AdminSettings } from "./useAdminSettings";

interface NvdApiKeyCardProps {
  settings: AdminSettings;
  onUpdate: (updates: Partial<AdminSettings>) => void;
}

const SOURCE_LABEL: Record<AdminSettings["nvdApiKeySource"], string> = {
  settings: "Key saved here",
  environment: "Key from NVD_API_KEY",
  none: "No key: rate limited",
};

export function NvdApiKeyCard({ settings, onUpdate }: NvdApiKeyCardProps) {
  const hasStoredKey = settings.nvdApiKeySource === "settings";
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bug className="h-5 w-5" aria-hidden="true" />
          Vulnerability database (NVD)
          <Badge
            variant={
              settings.nvdApiKeySource === "none" ? "outline" : "secondary"
            }
          >
            {SOURCE_LABEL[settings.nvdApiKeySource]}
          </Badge>
        </CardTitle>
        <CardDescription>
          Supply-chain scans and threat research look up CVEs in the National
          Vulnerability Database. Without an API key NVD allows 5 requests per
          30 seconds, so larger scans report many dependencies as unknown; with
          a key it allows 50. Request a free key at nvd.nist.gov/developers.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <Label htmlFor="nvdApiKey">
            {hasStoredKey ? "Replace API key" : "API key"}
          </Label>
          <Input
            id="nvdApiKey"
            type="password"
            autoComplete="off"
            placeholder={
              hasStoredKey
                ? "Saved (hidden)"
                : "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            }
            value={settings.nvdApiKeyInput}
            onChange={(e) =>
              onUpdate({
                nvdApiKeyInput: e.target.value,
                nvdApiKeyClear: false,
              })
            }
          />
          <p className="text-sm text-muted-foreground">
            Saved encrypted and never shown again. A key saved here takes
            precedence over the NVD_API_KEY environment variable.
          </p>
        </div>
        {hasStoredKey && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              onUpdate({ nvdApiKeyInput: "", nvdApiKeyClear: true })
            }
            disabled={settings.nvdApiKeyClear}
          >
            {settings.nvdApiKeyClear
              ? "Key will be removed on save"
              : "Remove saved key"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

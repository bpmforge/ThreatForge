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
import { AlertCircle, CheckCircle, Loader2, ExternalLink } from "lucide-react";
import type {
  OAuthProviderType,
  OAuthProviderConfig,
} from "@/features/admin/services/api";
import type { ProviderInfo } from "./useOAuthProviders";

interface OAuthProviderCardProps {
  provider: ProviderInfo;
  status: "env" | "database" | "disabled";
  config: OAuthProviderConfig | undefined;
  isEditing: boolean;
  editForm: OAuthProviderConfig;
  saving: OAuthProviderType | null;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  onFormChange: (form: OAuthProviderConfig) => void;
}

export function OAuthProviderCard({
  provider,
  status,
  config,
  isEditing,
  editForm,
  saving,
  onEdit,
  onSave,
  onCancel,
  onFormChange,
}: OAuthProviderCardProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{provider.icon}</span>
            <div>
              <CardTitle className="flex items-center gap-2">
                {provider.name}
                {status === "env" && (
                  <Badge
                    variant="outline"
                    className="text-blue-600 border-blue-600"
                  >
                    ENV
                  </Badge>
                )}
                {status === "database" && (
                  <Badge
                    variant="outline"
                    className="text-green-600 border-green-600"
                  >
                    Enabled
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>{provider.description}</CardDescription>
            </div>
          </div>
          {!isEditing && status !== "env" && (
            <Button variant="outline" onClick={onEdit}>
              {config ? "Edit" : "Configure"}
            </Button>
          )}
        </div>
      </CardHeader>

      {status === "env" && (
        <CardContent>
          <div className="rounded-lg bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 p-4">
            <div className="flex items-start gap-2">
              <CheckCircle className="h-5 w-5 text-blue-600 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                  Configured via environment variables
                </p>
                <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                  To modify, update the environment variables and restart the
                  application.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      )}

      {isEditing && (
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Enable Provider</Label>
              <p className="text-sm text-muted-foreground">
                Allow users to sign in with {provider.name}
              </p>
            </div>
            <Switch
              checked={editForm.enabled}
              onCheckedChange={(checked) =>
                onFormChange({ ...editForm, enabled: checked })
              }
            />
          </div>

          {editForm.enabled && (
            <>
              <div className="space-y-2">
                <Label htmlFor={`${provider.id}-clientId`}>Client ID</Label>
                <Input
                  id={`${provider.id}-clientId`}
                  placeholder="Enter client ID"
                  value={editForm.clientId}
                  onChange={(e) =>
                    onFormChange({ ...editForm, clientId: e.target.value })
                  }
                  className="font-mono"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor={`${provider.id}-clientSecret`}>
                  Client Secret
                </Label>
                <Input
                  id={`${provider.id}-clientSecret`}
                  type="password"
                  placeholder="Enter client secret"
                  value={editForm.clientSecret}
                  onChange={(e) =>
                    onFormChange({ ...editForm, clientSecret: e.target.value })
                  }
                  className="font-mono"
                />
              </div>

              {provider.id === "oidc" && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="oidc-issuer">Issuer URL</Label>
                    <Input
                      id="oidc-issuer"
                      placeholder="https://auth.example.com"
                      value={editForm.issuer || ""}
                      onChange={(e) =>
                        onFormChange({ ...editForm, issuer: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="oidc-name">Display Name</Label>
                    <Input
                      id="oidc-name"
                      placeholder="Company SSO"
                      value={editForm.name || ""}
                      onChange={(e) =>
                        onFormChange({ ...editForm, name: e.target.value })
                      }
                    />
                  </div>
                </>
              )}

              {provider.docsUrl && (
                <div className="pt-2">
                  <Button
                    variant="link"
                    size="sm"
                    asChild
                    className="p-0 h-auto"
                  >
                    <a
                      href={provider.docsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="h-4 w-4 mr-1" />
                      Open {provider.name} Developer Console
                    </a>
                  </Button>
                </div>
              )}
            </>
          )}

          <div className="flex items-center gap-2 pt-4 border-t">
            <Button onClick={onSave} disabled={saving === provider.id}>
              {saving === provider.id ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save"
              )}
            </Button>
            <Button variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        </CardContent>
      )}

      {!isEditing && status === "database" && config && (
        <CardContent>
          <div className="flex items-center gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Client ID:</span>{" "}
              <code className="bg-muted px-1 rounded">{config.clientId}</code>
            </div>
          </div>
        </CardContent>
      )}

      {!isEditing && status === "disabled" && (
        <CardContent>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <AlertCircle className="h-4 w-4" />
            Not configured
          </div>
        </CardContent>
      )}
    </Card>
  );
}

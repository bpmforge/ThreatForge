"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, KeyRound, Copy } from "lucide-react";
import type { CallbackUrlsResponse } from "@/features/admin/services/api";
import { useOAuthProviders, PROVIDERS } from "./useOAuthProviders";
import { OAuthProviderCard } from "./OAuthProviderCard";

export function OAuthProvidersTab() {
  const m = useOAuthProviders();

  if (m.loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5" />
            OAuth Provider Configuration
          </CardTitle>
          <CardDescription>
            Configure social login providers. Providers can be configured via
            environment variables (recommended for production) or through this
            admin panel.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg bg-muted/50 p-4 text-sm text-muted-foreground">
            <p className="font-medium text-foreground mb-2">How it works:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>
                <Badge
                  variant="outline"
                  className="text-blue-600 border-blue-600 mr-1"
                >
                  ENV
                </Badge>
                Providers configured via environment variables (takes
                precedence)
              </li>
              <li>
                <Badge
                  variant="outline"
                  className="text-green-600 border-green-600 mr-1"
                >
                  DB
                </Badge>
                Providers configured through this admin panel
              </li>
              <li>
                Environment variables are more secure for production deployments
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {m.callbackUrls && (
        <Card>
          <CardHeader>
            <CardTitle>Callback URLs</CardTitle>
            <CardDescription>
              Use these URLs when configuring OAuth applications
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {PROVIDERS.filter((p) => p.id !== "oidc").map((provider) => (
                <div
                  key={provider.id}
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <span>{provider.icon}</span>
                    <span className="text-sm font-medium">
                      {provider.name}:
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="bg-muted px-2 py-1 rounded text-xs">
                      {
                        m.callbackUrls?.[
                          provider.id as keyof CallbackUrlsResponse
                        ]
                      }
                    </code>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        m.copyToClipboard(
                          m.callbackUrls![
                            provider.id as keyof CallbackUrlsResponse
                          ],
                        )
                      }
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {PROVIDERS.map((provider) => (
        <OAuthProviderCard
          key={provider.id}
          provider={provider}
          status={m.getProviderStatus(provider.id)}
          config={m.providers[provider.id]}
          isEditing={m.editingProvider === provider.id}
          editForm={m.editForm}
          saving={m.saving}
          onEdit={() => m.handleEdit(provider.id)}
          onSave={m.handleSave}
          onCancel={m.handleCancel}
          onFormChange={m.setEditForm}
        />
      ))}
    </div>
  );
}

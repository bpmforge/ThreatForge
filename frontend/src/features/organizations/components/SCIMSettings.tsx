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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Copy,
  RefreshCw,
  Trash2,
  CheckCircle,
  AlertTriangle,
  Eye,
  EyeOff,
  Shield,
} from "lucide-react";
import { useState } from "react";
import { useScimSettings } from "../hooks/useScimSettings";
import { ScimSetupGuides } from "./ScimSetupGuides";

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={handleCopy}
      className="ml-2 text-muted-foreground hover:text-foreground transition-colors"
      aria-label={`Copy ${label}`}
      title={`Copy ${label}`}
    >
      {copied ? (
        <CheckCircle className="h-3.5 w-3.5 text-green-500" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
    </button>
  );
}

interface Props {
  orgId: string;
  canEdit: boolean;
}

export function SCIMSettings({ orgId, canEdit }: Props) {
  const {
    config,
    isLoading,
    newToken,
    showToken,
    setShowToken,
    rotateMutation,
    revokeMutation,
  } = useScimSettings(orgId);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground text-sm">
          Loading SCIM configuration…
        </CardContent>
      </Card>
    );
  }

  const endpoints = config?.endpoints;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Shield className="h-4 w-4" />
            SCIM 2.0 Provisioning
          </CardTitle>
          <CardDescription>
            Automate user lifecycle management via Okta, Azure AD, or any
            SCIM-compatible identity provider.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {config?.enabled ? (
                <>
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span className="text-sm font-medium">Active</span>
                  {config.token && (
                    <Badge variant="secondary" className="font-mono text-xs">
                      {config.token.prefix}…
                    </Badge>
                  )}
                </>
              ) : (
                <>
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  <span className="text-sm text-muted-foreground">
                    No active token — generate one to enable provisioning
                  </span>
                </>
              )}
            </div>
            {canEdit && (
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={config?.enabled ? "outline" : "default"}
                  onClick={() => rotateMutation.mutate()}
                  disabled={rotateMutation.isPending}
                >
                  <RefreshCw
                    className={`h-3.5 w-3.5 mr-1.5 ${rotateMutation.isPending ? "animate-spin" : ""}`}
                  />
                  {config?.enabled ? "Rotate Token" : "Generate Token"}
                </Button>
                {config?.enabled && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="sm" variant="destructive">
                        <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                        Revoke
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Revoke SCIM Token?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Your IdP will immediately lose access to provision
                          users. Update the token in your IdP before revoking.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => revokeMutation.mutate()}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Revoke
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            )}
          </div>

          {config?.token?.lastUsedAt && (
            <p className="text-xs text-muted-foreground">
              Last used:{" "}
              {new Date(config.token.lastUsedAt).toLocaleString("en-US", {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </p>
          )}

          {newToken && (
            <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/20 p-3 space-y-2">
              <p className="text-xs font-semibold text-amber-800 dark:text-amber-300 flex items-center gap-1">
                <AlertTriangle className="h-3.5 w-3.5" />
                Save this token now — it will not be shown again
              </p>
              <div className="flex items-center gap-2 font-mono text-xs bg-background rounded border px-2 py-1.5">
                <span className="flex-1 truncate">
                  {showToken ? newToken : "•".repeat(newToken.length)}
                </span>
                <button
                  onClick={() => setShowToken((p) => !p)}
                  className="text-muted-foreground hover:text-foreground"
                  aria-label={showToken ? "Hide token" : "Show token"}
                >
                  {showToken ? (
                    <EyeOff className="h-3.5 w-3.5" />
                  ) : (
                    <Eye className="h-3.5 w-3.5" />
                  )}
                </button>
                <CopyButton value={newToken} label="SCIM token" />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {endpoints && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">SCIM Endpoints</CardTitle>
            <CardDescription className="text-xs">
              Use these URLs when configuring your identity provider.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            {[
              { label: "Base URL", value: endpoints.base },
              { label: "Users", value: endpoints.users },
              { label: "Groups", value: endpoints.groups },
              {
                label: "Service Provider Config",
                value: endpoints.serviceProviderConfig,
              },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center gap-2">
                <span className="w-44 text-muted-foreground shrink-0">
                  {label}
                </span>
                <code className="font-mono bg-muted px-1.5 py-0.5 rounded text-xs flex-1 truncate">
                  {value}
                </code>
                <CopyButton value={value} label={label} />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <ScimSetupGuides />
    </div>
  );
}

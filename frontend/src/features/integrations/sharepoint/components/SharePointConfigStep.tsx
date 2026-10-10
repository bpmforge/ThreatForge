"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ExternalLink } from "lucide-react";
import type { useSharePointImport } from "./useSharePointImport";

type H = ReturnType<typeof useSharePointImport>;

const CONFIG_FIELDS = [
  {
    key: "tenantId" as const,
    label: "Tenant ID",
    placeholder: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  },
  {
    key: "clientId" as const,
    label: "Client ID",
    placeholder: "App (client) ID from Azure AD",
  },
  {
    key: "clientSecret" as const,
    label: "Client Secret",
    placeholder: "Client secret value",
    type: "password",
  },
  {
    key: "hostname" as const,
    label: "SharePoint Hostname",
    placeholder: "yourcompany.sharepoint.com",
  },
];

export function SharePointConfigStep({ h }: { h: H }) {
  return (
    <div className="space-y-3 py-2">
      {CONFIG_FIELDS.map(({ key, label, placeholder, type }) => (
        <div key={key} className="space-y-1">
          <Label htmlFor={`sp-${key}`} className="text-sm">
            {label}
          </Label>
          <Input
            id={`sp-${key}`}
            type={type ?? "text"}
            placeholder={placeholder}
            value={h.config[key]}
            onChange={(e) =>
              h.setConfig((c) => ({ ...c, [key]: e.target.value }))
            }
          />
        </div>
      ))}
      <p className="text-xs text-muted-foreground">
        Register an Azure AD app with{" "}
        <code className="text-[11px] bg-muted px-1 py-0.5 rounded">
          Sites.Read.All
        </code>{" "}
        application permission.{" "}
        <a
          href="https://learn.microsoft.com/en-us/graph/auth-register-app-v2"
          target="_blank"
          rel="noopener noreferrer"
          className="underline inline-flex items-center gap-0.5"
        >
          Docs <ExternalLink className="h-3 w-3" />
        </a>
      </p>
      {h.error && <p className="text-sm text-destructive">{h.error}</p>}
      <Button
        onClick={h.handleConnect}
        disabled={!h.canConnect || h.busy}
        className="w-full"
      >
        {h.busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
        Connect
      </Button>
    </div>
  );
}

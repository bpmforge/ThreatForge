"use client";

/**
 * DerivedSecurityControls - Shows security controls applied to a connection.
 *
 * Derives "automatic mitigations" from edge security properties like
 * encryption, authentication method, etc.
 */
import { Shield, Lock, Key, CheckCircle } from "lucide-react";
import type { ConnectionData, AuthMethod } from "@/types/canvas";

interface DerivedSecurityControlsProps {
  connectionData: ConnectionData | undefined;
}

interface SecurityControl {
  id: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

/** Map authentication methods to descriptive labels */
const authMethodLabels: Record<AuthMethod, string> = {
  None: "",
  API_KEY: "API Key Authentication",
  JWT: "JWT Token Authentication",
  OAuth2: "OAuth 2.0 Authorization",
  mTLS: "Mutual TLS (mTLS)",
  Basic: "Basic Authentication",
  SAML: "SAML Authentication",
  Custom: "Custom Authentication",
};

export function DerivedSecurityControls({
  connectionData,
}: DerivedSecurityControlsProps) {
  if (!connectionData) return null;

  const controls: SecurityControl[] = [];

  // Encryption control
  if (connectionData.encrypted) {
    controls.push({
      id: "tls",
      label: "TLS Encryption",
      description: "Data is encrypted in transit",
      icon: Lock,
    });
  }

  // Authentication method control
  if (
    connectionData.authentication &&
    connectionData.authentication !== "None"
  ) {
    const label = authMethodLabels[connectionData.authentication];
    if (label) {
      controls.push({
        id: `auth-${connectionData.authentication}`,
        label,
        description: "Authentication required for this connection",
        icon: Key,
      });
    }
  }

  // Generic authenticated flag (only if no specific method)
  if (connectionData.authenticated && !connectionData.authentication) {
    controls.push({
      id: "authenticated",
      label: "Authentication Required",
      description: "Connection requires authentication",
      icon: Key,
    });
  }

  // HTTPS protocol implies encryption
  if (connectionData.protocol === "HTTPS" && !connectionData.encrypted) {
    controls.push({
      id: "https",
      label: "HTTPS Protocol",
      description: "Transport layer security via HTTPS",
      icon: Lock,
    });
  }

  if (controls.length === 0) return null;

  return (
    <div className="mt-2 pt-2 border-t border-dashed">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
        <Shield className="h-3 w-3" />
        <span>Applied Security Controls</span>
      </div>
      <div className="space-y-1">
        {controls.map((control) => {
          const Icon = control.icon;
          return (
            <div
              key={control.id}
              className="flex items-center gap-2 px-2 py-1 bg-green-50 dark:bg-green-950/30 rounded text-xs"
            >
              <CheckCircle className="h-3 w-3 text-green-600 dark:text-green-400 shrink-0" />
              <Icon className="h-3 w-3 text-green-600 dark:text-green-400 shrink-0" />
              <span className="text-green-700 dark:text-green-300">
                {control.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

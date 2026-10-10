"use client";

import { useState } from "react";
import type { AttackSurfaceComponent, AttackSurfaceInterface } from "../types";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Shield,
  Globe,
  Lock,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Network,
  Database,
  Server,
} from "lucide-react";

interface ComponentCardProps {
  component: AttackSurfaceComponent;
  onClick?: (id: string) => void;
}

export function ComponentCard({ component, onClick }: ComponentCardProps) {
  const [expanded, setExpanded] = useState(false);

  const getRiskColor = (score: number) => {
    if (score >= 8) return "text-red-600 bg-red-100";
    if (score >= 5) return "text-orange-600 bg-orange-100";
    if (score >= 3) return "text-yellow-600 bg-yellow-100";
    return "text-green-600 bg-green-100";
  };

  const getTypeIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case "database":
        return <Database className="h-4 w-4" />;
      case "api":
      case "service":
        return <Server className="h-4 w-4" />;
      default:
        return <Network className="h-4 w-4" />;
    }
  };

  return (
    <Card className="overflow-hidden">
      <div
        className={cn(
          "p-3 cursor-pointer transition-colors hover:bg-muted/50",
          onClick && "hover:cursor-pointer",
        )}
        onClick={() => onClick?.(component.id)}
      >
        <div className="flex justify-between items-start">
          <div className="flex items-start gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 shrink-0"
              onClick={(e) => {
                e.stopPropagation();
                setExpanded(!expanded);
              }}
              aria-label={
                expanded ? "Collapse interfaces" : "Expand interfaces"
              }
            >
              {expanded ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
            </Button>
            <div>
              <div className="flex items-center gap-2">
                {getTypeIcon(component.type)}
                <h3 className="font-semibold text-sm">{component.name}</h3>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {component.type} • {component.totalInterfaces} interface
                {component.totalInterfaces !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
          <Badge className={cn("text-xs", getRiskColor(component.riskScore))}>
            {component.riskScore.toFixed(1)}
          </Badge>
        </div>

        <div className="flex items-center gap-3 mt-2 ml-7 text-xs text-muted-foreground">
          {component.exposedInterfaces > 0 && (
            <span className="flex items-center gap-1">
              <Globe className="h-3 w-3 text-blue-500" />
              {component.exposedInterfaces} exposed
            </span>
          )}
          {component.highRiskInterfaces > 0 && (
            <span className="flex items-center gap-1">
              <AlertTriangle className="h-3 w-3 text-orange-500" />
              {component.highRiskInterfaces} high-risk
            </span>
          )}
          <span className="flex items-center gap-1">
            <Shield className="h-3 w-3" />
            {component.mitigatedThreatCount}/{component.threatCount} mitigated
          </span>
        </div>
      </div>

      {expanded && component.interfaces.length > 0 && (
        <div className="border-t bg-muted/30 px-3 py-2 space-y-2">
          {component.interfaces.map((iface) => (
            <InterfaceRow key={iface.id} iface={iface} />
          ))}
        </div>
      )}
    </Card>
  );
}

function InterfaceRow({ iface }: { iface: AttackSurfaceInterface }) {
  const getExposureBadge = (exposure: string) => {
    switch (exposure) {
      case "INTERNET_FACING":
        return (
          <Badge variant="destructive" className="text-xs">
            Internet
          </Badge>
        );
      case "PUBLIC_CLOUD":
        return <Badge className="bg-orange-500 text-xs">Public Cloud</Badge>;
      case "PRIVATE_CLOUD":
        return <Badge className="bg-yellow-500 text-xs">Private Cloud</Badge>;
      case "VPN_PROTECTED":
        return <Badge className="bg-blue-500 text-xs">VPN</Badge>;
      default:
        return (
          <Badge variant="secondary" className="text-xs">
            Internal
          </Badge>
        );
    }
  };

  const getAuthBadge = (auth: string) => {
    const authLabels: Record<string, string> = {
      NONE: "No Auth",
      API_KEY: "API Key",
      BASIC: "Basic",
      OAUTH2: "OAuth2",
      MUTUAL_TLS: "mTLS",
      CERTIFICATE: "Cert",
      MULTI_FACTOR: "MFA",
    };
    return authLabels[auth] || auth;
  };

  return (
    <div className="flex items-center justify-between text-xs p-2 rounded bg-background">
      <div className="flex items-center gap-2">
        {iface.authLevel === "NONE" ? (
          <Lock className="h-3 w-3 text-red-500" />
        ) : (
          <Lock className="h-3 w-3 text-green-500" />
        )}
        <span className="font-medium">{iface.name}</span>
        <Badge variant="outline" className="text-xs">
          {iface.type.replace(/_/g, " ")}
        </Badge>
      </div>
      <div className="flex items-center gap-2">
        {getExposureBadge(iface.networkExposure)}
        <Badge variant="secondary" className="text-xs">
          {getAuthBadge(iface.authLevel)}
        </Badge>
        {iface.cvssBase && (
          <span className="text-muted-foreground">
            CVSS: {iface.cvssBase.toFixed(1)}
          </span>
        )}
      </div>
    </div>
  );
}

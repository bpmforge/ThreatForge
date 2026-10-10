"use client";

import { severityBadge, toSeverity } from "@/lib/severity";
import { Button } from "@/components/ui/button";
import { VerificationBadge } from "@/features/threats/components/VerificationBadge";
import type { AISuggestedThreat } from "../types";

const CATEGORY_LABELS: Record<string, string> = {
  SPOOFING: "Spoofing",
  TAMPERING: "Tampering",
  REPUDIATION: "Repudiation",
  INFO_DISCLOSURE: "Info Disclosure",
  INFORMATION_DISCLOSURE: "Info Disclosure",
  DENIAL_OF_SERVICE: "DoS",
  ELEVATION_OF_PRIVILEGE: "Elevation",
};

interface ThreatCardProps {
  threat: AISuggestedThreat;
  onAdd: (threat: AISuggestedThreat) => void;
}

export function ThreatCard({ threat, onAdd }: ThreatCardProps) {
  return (
    <div className="p-3 bg-background border rounded-lg hover:border-blue-300 transition-colors">
      <div className="flex items-start justify-between gap-2 mb-2">
        <h4 className="text-sm font-medium text-foreground">{threat.title}</h4>
        <div className="flex items-center gap-1 shrink-0">
          <span
            className={`text-xs px-2 py-0.5 rounded ${severityBadge({ severity: toSeverity(threat.severity), variant: "soft" })}`}
          >
            {threat.severity}
          </span>
          <VerificationBadge status={threat.verification?.status} />
        </div>
      </div>

      <p className="text-xs text-muted-foreground mb-2">{threat.description}</p>

      {threat.verification &&
        threat.verification.status !== "VERIFIED" &&
        threat.verification.status !== "EXEMPT" &&
        threat.verification.citations.length > 0 && (
          <p className="text-[11px] text-amber-700 mb-2 italic">
            {threat.verification.citations[0].rationale}
          </p>
        )}

      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {CATEGORY_LABELS[threat.category] ?? threat.category}
          {threat.confidence > 0 &&
            ` (${Math.round(threat.confidence * 100)}%)`}
        </span>
        <Button
          size="sm"
          variant="outline"
          onClick={() => onAdd(threat)}
          className="text-xs h-7"
        >
          Add Threat
        </Button>
      </div>
    </div>
  );
}

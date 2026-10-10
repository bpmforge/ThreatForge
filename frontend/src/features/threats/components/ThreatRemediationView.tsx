"use client";

import { RemediationTracker } from "./RemediationTracker";
import type { RemediationItem } from "./RemediationTracker";
import type { Threat } from "../types";

interface ThreatRemediationViewProps {
  threats: Threat[];
  onStatusChange: (threatId: string, dbStatus: string) => void;
}

const STATUS_MAP: Record<string, RemediationItem["status"]> = {
  OPEN: "IDENTIFIED",
  IN_PROGRESS: "IN_PROGRESS",
  MITIGATED: "IMPLEMENTED",
  ACCEPTED: "VERIFIED",
  NOT_APPLICABLE: "VERIFIED",
};

const REVERSE_STATUS_MAP: Record<string, string> = {
  IDENTIFIED: "OPEN",
  PLANNED: "OPEN",
  IN_PROGRESS: "IN_PROGRESS",
  IMPLEMENTED: "MITIGATED",
  VERIFIED: "ACCEPTED",
};

export function ThreatRemediationView({
  threats,
  onStatusChange,
}: ThreatRemediationViewProps) {
  const items: RemediationItem[] = threats.map((t) => {
    const topMitigation = t.mitigations[0];
    const createdAt = (t as unknown as { createdAt?: string }).createdAt;
    return {
      id: t.id,
      threatName: t.name,
      severity: t.severity as RemediationItem["severity"],
      status: STATUS_MAP[t.status] ?? "IDENTIFIED",
      mitigationDescription: topMitigation?.description,
      daysOpen: createdAt
        ? Math.floor((Date.now() - new Date(createdAt).getTime()) / 86_400_000)
        : 0,
    };
  });

  return (
    <div className="flex-1 min-h-0 overflow-auto">
      <RemediationTracker
        items={items}
        onStatusChange={(id, status) =>
          onStatusChange(id, REVERSE_STATUS_MAP[status] ?? "OPEN")
        }
      />
    </div>
  );
}

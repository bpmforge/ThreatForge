"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

import { severityDot } from "@/lib/severity";
const STRIDE_LABELS: Record<string, string> = {
  SPOOFING: "Spoofing",
  TAMPERING: "Tampering",
  REPUDIATION: "Repudiation",
  INFORMATION_DISCLOSURE: "Info Disclosure",
  DENIAL_OF_SERVICE: "DoS",
  ELEVATION_OF_PRIVILEGE: "Privilege Escalation",
};

interface OrgRiskBreakdownsProps {
  bySeverity: Record<string, number>;
  byStride: Record<string, number>;
  totalThreats: number;
}

export function OrgRiskBreakdowns({
  bySeverity,
  byStride,
  totalThreats,
}: OrgRiskBreakdownsProps) {
  return (
    <>
      <Card className="py-4">
        <CardHeader className="pb-0 pt-0">
          <CardTitle className="text-sm">Threats by Severity</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {Object.entries(bySeverity).map(([severity, count]) => {
            const pct = Math.round((count / (totalThreats || 1)) * 100);
            return (
              <div key={severity} className="flex items-center gap-3">
                <span className="text-xs w-20 text-muted-foreground">
                  {severity}
                </span>
                <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full ${severityDot(severity)}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-xs font-mono w-12 text-right">
                  {count}
                </span>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card className="py-4">
        <CardHeader className="pb-0 pt-0">
          <CardTitle className="text-sm">STRIDE Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {Object.entries(byStride).map(([category, count]) => (
              <div
                key={category}
                className="flex items-center justify-between rounded-md border px-3 py-2"
              >
                <span className="text-xs text-muted-foreground">
                  {STRIDE_LABELS[category] ?? category}
                </span>
                <span className="text-sm font-medium">{count}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </>
  );
}

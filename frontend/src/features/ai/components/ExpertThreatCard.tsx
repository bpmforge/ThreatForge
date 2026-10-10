"use client";

/**
 * ExpertThreatCard — Single threat card for ExpertAnalysisResults.
 * Extracted to keep ExpertAnalysisResults.tsx under the 150-line component limit.
 */
import { severityBadge, toSeverity } from "@/lib/severity";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  AlertTriangle,
  Shield,
  XCircle,
  Zap,
} from "lucide-react";
import type { ExpertAnalysisThreat } from "../types";

const ANALYSIS_ICONS: Record<string, typeof Shield> = {
  component_risk: Shield,
  data_flow: Zap,
  missing_control: AlertTriangle,
  attack_chain: AlertTriangle,
};

export function ExpertThreatCard({ threat }: { threat: ExpertAnalysisThreat }) {
  const Icon =
    ANALYSIS_ICONS[threat.analysisType ?? "component_risk"] ?? Shield;
  return (
    <div className="p-3 border rounded-lg space-y-2">
      <div className="flex items-start gap-2">
        <Icon className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium">{threat.title}</span>
            {threat.verificationFailed ? (
              <span title="Verification failed">
                <XCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />
              </span>
            ) : (
              threat.verifiedInPass5 && (
                <span title="Verified in Pass 5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
                </span>
              )
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
            {threat.description}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-1.5 flex-wrap">
        <Badge
          variant="outline"
          className={severityBadge({
            severity: toSeverity(threat.severity),
            variant: "soft",
          })}
        >
          {threat.severity}
        </Badge>
        <Badge variant="secondary" className="text-xs">
          {threat.category.replace("_", " ")}
        </Badge>
        {threat.analysisType && (
          <Badge variant="outline" className="text-xs">
            {threat.analysisType.replace("_", " ")}
          </Badge>
        )}
        {threat.confidence > 0 && (
          <span className="text-xs text-muted-foreground ml-auto">
            {Math.round(threat.confidence * 100)}% conf
          </span>
        )}
      </div>
      {threat.attackVector && (
        <p className="text-xs text-muted-foreground">
          <strong>Attack:</strong> {threat.attackVector}
        </p>
      )}
      {threat.mitigation && (
        <p className="text-xs text-muted-foreground">
          <strong>Mitigation:</strong> {threat.mitigation}
        </p>
      )}
      {threat.mitigationEffectiveness != null &&
        threat.mitigationEffectiveness > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              Effectiveness:
            </span>
            <div className="h-1.5 w-20 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${threat.mitigationEffectiveness >= 0.6 ? "bg-green-500" : threat.mitigationEffectiveness >= 0.3 ? "bg-yellow-500" : "bg-red-400"}`}
                style={{
                  width: `${Math.round(threat.mitigationEffectiveness * 100)}%`,
                }}
              />
            </div>
            <span className="text-xs font-medium">
              {Math.round(threat.mitigationEffectiveness * 100)}%
            </span>
            <span className="text-xs text-red-500/70 ml-auto">
              {Math.round((1 - threat.mitigationEffectiveness) * 100)}% residual
            </span>
          </div>
        )}
      {threat.residualRisk && (
        <p className="text-xs text-red-500/70 italic">{threat.residualRisk}</p>
      )}
    </div>
  );
}

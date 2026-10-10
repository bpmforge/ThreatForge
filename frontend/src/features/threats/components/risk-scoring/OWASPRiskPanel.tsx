"use client";

import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import type {
  OWASPRiskRatingMetrics,
  OWASPThreatAgentFactors,
  OWASPVulnerabilityFactors,
  OWASPTechnicalImpactFactors,
  OWASPBusinessImpactFactors,
} from "../../types/risk-frameworks";
import {
  OWASP_THREAT_AGENT_FACTORS,
  OWASP_VULNERABILITY_FACTORS,
  OWASP_TECHNICAL_IMPACT_FACTORS,
  OWASP_BUSINESS_IMPACT_FACTORS,
} from "../../constants/risk-frameworks";
import {
  calculateOWASPRiskRating,
  getOWASPRiskColor,
  getOWASPRiskSummary,
  getOWASPRiskBreakdown,
} from "../../utils";
import { useOWASPRiskHandlers } from "./useOWASPRiskHandlers";
import { FactorSection } from "./FactorSection";
import { FactorSelect } from "./FactorSelect";

interface OWASPRiskPanelProps {
  value: OWASPRiskRatingMetrics;
  onChange: (value: OWASPRiskRatingMetrics) => void;
  readonly?: boolean;
}

export function OWASPRiskPanel({
  value,
  onChange,
  readonly = false,
}: OWASPRiskPanelProps) {
  const {
    expandedSections,
    toggleSection,
    handleThreatAgentChange,
    handleVulnerabilityChange,
    handleTechnicalImpactChange,
    handleBusinessImpactChange,
  } = useOWASPRiskHandlers({ value, onChange });

  const score = calculateOWASPRiskRating(value);
  const breakdown = getOWASPRiskBreakdown(value);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">OWASP Risk Rating</Label>
        <div className="flex items-center gap-2">
          <span
            className={`px-2 py-0.5 rounded text-xs text-white font-medium ${getOWASPRiskColor(score.riskLevel)}`}
          >
            {score.overallRiskScore.toFixed(1)}
          </span>
          <span className="text-xs text-muted-foreground">
            {score.riskLevel}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 text-xs">
        <div className="p-2 rounded-lg bg-muted/50">
          <div className="text-muted-foreground">Likelihood</div>
          <div className="font-medium">{score.likelihoodScore.toFixed(1)}</div>
        </div>
        <div className="p-2 rounded-lg bg-muted/50">
          <div className="text-muted-foreground">Tech Impact</div>
          <div className="font-medium">
            {score.technicalImpactScore.toFixed(1)}
          </div>
        </div>
        <div className="p-2 rounded-lg bg-muted/50">
          <div className="text-muted-foreground">Biz Impact</div>
          <div className="font-medium">
            {score.businessImpactScore.toFixed(1)}
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <FactorSection
          title="Threat Agent Factors"
          expanded={expandedSections.has("threatAgent")}
          onToggle={() => toggleSection("threatAgent")}
          avgScore={score.likelihoodScore}
        >
          {OWASP_THREAT_AGENT_FACTORS.map((factor) => (
            <FactorSelect
              key={factor.key}
              label={factor.label}
              description={factor.description}
              options={factor.options}
              value={
                value.threatAgentFactors[
                  factor.key as keyof OWASPThreatAgentFactors
                ]
              }
              onChange={(v) =>
                handleThreatAgentChange(
                  factor.key as keyof OWASPThreatAgentFactors,
                  v,
                )
              }
              readonly={readonly}
            />
          ))}
        </FactorSection>

        <FactorSection
          title="Vulnerability Factors"
          expanded={expandedSections.has("vulnerability")}
          onToggle={() => toggleSection("vulnerability")}
          avgScore={score.likelihoodScore}
        >
          {OWASP_VULNERABILITY_FACTORS.map((factor) => (
            <FactorSelect
              key={factor.key}
              label={factor.label}
              description={factor.description}
              options={factor.options}
              value={
                value.vulnerabilityFactors[
                  factor.key as keyof OWASPVulnerabilityFactors
                ]
              }
              onChange={(v) =>
                handleVulnerabilityChange(
                  factor.key as keyof OWASPVulnerabilityFactors,
                  v,
                )
              }
              readonly={readonly}
            />
          ))}
        </FactorSection>

        <FactorSection
          title="Technical Impact"
          expanded={expandedSections.has("technicalImpact")}
          onToggle={() => toggleSection("technicalImpact")}
          avgScore={score.technicalImpactScore}
        >
          {OWASP_TECHNICAL_IMPACT_FACTORS.map((factor) => (
            <FactorSelect
              key={factor.key}
              label={factor.label}
              description={factor.description}
              options={factor.options}
              value={
                value.technicalImpactFactors[
                  factor.key as keyof OWASPTechnicalImpactFactors
                ]
              }
              onChange={(v) =>
                handleTechnicalImpactChange(
                  factor.key as keyof OWASPTechnicalImpactFactors,
                  v,
                )
              }
              readonly={readonly}
            />
          ))}
        </FactorSection>

        <FactorSection
          title="Business Impact"
          expanded={expandedSections.has("businessImpact")}
          onToggle={() => toggleSection("businessImpact")}
          avgScore={score.businessImpactScore}
        >
          {OWASP_BUSINESS_IMPACT_FACTORS.map((factor) => (
            <FactorSelect
              key={factor.key}
              label={factor.label}
              description={factor.description}
              options={factor.options}
              value={
                value.businessImpactFactors[
                  factor.key as keyof OWASPBusinessImpactFactors
                ]
              }
              onChange={(v) =>
                handleBusinessImpactChange(
                  factor.key as keyof OWASPBusinessImpactFactors,
                  v,
                )
              }
              readonly={readonly}
            />
          ))}
        </FactorSection>
      </div>

      {(breakdown.highRiskFactors.length > 0 ||
        breakdown.lowRiskFactors.length > 0) && (
        <div className="pt-2 border-t space-y-2">
          {breakdown.highRiskFactors.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {breakdown.highRiskFactors.slice(0, 4).map((factor) => (
                <Badge
                  key={factor}
                  variant="destructive"
                  className="text-[10px] gap-1"
                >
                  <AlertTriangle className="h-3 w-3" />
                  {factor}
                </Badge>
              ))}
              {breakdown.highRiskFactors.length > 4 && (
                <Badge variant="outline" className="text-[10px]">
                  +{breakdown.highRiskFactors.length - 4} more
                </Badge>
              )}
            </div>
          )}
          {breakdown.lowRiskFactors.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {breakdown.lowRiskFactors.slice(0, 3).map((factor) => (
                <Badge
                  key={factor}
                  variant="secondary"
                  className="text-[10px] gap-1 bg-green-100 text-green-700"
                >
                  <CheckCircle2 className="h-3 w-3" />
                  {factor}
                </Badge>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="pt-2 border-t">
        <p className="text-xs text-muted-foreground italic">
          {getOWASPRiskSummary(score)}
        </p>
      </div>
    </div>
  );
}

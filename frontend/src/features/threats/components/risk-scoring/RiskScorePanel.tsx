"use client";

import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Info } from "lucide-react";
import type {
  RiskFramework,
  ThreatRiskScores,
  CIATriadScore,
  CVSS31BaseMetrics,
  CVSS40BaseMetrics,
  DREADMetrics,
  OWASPRiskRatingMetrics,
  FAIRFactors,
} from "../../types/risk-frameworks";
import {
  RISK_FRAMEWORKS,
  DEFAULT_ENABLED_FRAMEWORKS,
  DEFAULT_CIA_TRIAD,
  DEFAULT_CVSS31_BASE_METRICS,
  DEFAULT_CVSS40_BASE_METRICS,
  DEFAULT_DREAD_METRICS,
  DEFAULT_OWASP_METRICS,
  DEFAULT_FAIR_FACTORS,
} from "../../constants/risk-frameworks";
import { CIATriadPanel } from "./CIATriadPanel";
import { CVSS31Panel } from "./CVSS31Panel";
import { CVSS40Panel } from "./CVSS40Panel";
import { DREADPanel } from "./DREADPanel";
import { OWASPRiskPanel } from "./OWASPRiskPanel";
import { FAIRPanel } from "./FAIRPanel";
import { FrameworkCollapsible } from "./FrameworkCollapsible";
import { FrameworkCompare } from "./FrameworkCompare";
import {
  calculateCVSS31Score,
  calculateCVSS40Score,
  calculateDREADScore,
  calculateCIAImpactScore,
  calculateOWASPRiskRating,
} from "../../utils";
import { calculateFAIR, formatCurrency } from "../../utils/fair-calculator";

interface RiskScorePanelProps {
  value?: ThreatRiskScores;
  onChange: (value: ThreatRiskScores) => void;
  readonly?: boolean;
  compact?: boolean;
}

export function RiskScorePanel({
  value,
  onChange,
  readonly = false,
  compact = false,
}: RiskScorePanelProps) {
  const [expandedFrameworks, setExpandedFrameworks] = useState<
    Set<RiskFramework>
  >(new Set(value?.enabledFrameworks || DEFAULT_ENABLED_FRAMEWORKS));

  const enabledFrameworks =
    value?.enabledFrameworks || DEFAULT_ENABLED_FRAMEWORKS;

  const toggleFramework = (framework: RiskFramework) => {
    const newEnabled = enabledFrameworks.includes(framework)
      ? enabledFrameworks.filter((f) => f !== framework)
      : [...enabledFrameworks, framework];
    onChange({ ...value, enabledFrameworks: newEnabled });
  };

  const toggleExpanded = (framework: RiskFramework) => {
    const next = new Set(expandedFrameworks);
    next.has(framework) ? next.delete(framework) : next.add(framework);
    setExpandedFrameworks(next);
  };

  const handleCIAChange = (cia: CIATriadScore) =>
    onChange({ ...value, enabledFrameworks, ciaTriad: cia });
  const handleCVSS31Change = (metrics: CVSS31BaseMetrics) =>
    onChange({
      ...value,
      enabledFrameworks,
      cvss31: calculateCVSS31Score(metrics),
    });
  const handleCVSS40Change = (metrics: CVSS40BaseMetrics) =>
    onChange({
      ...value,
      enabledFrameworks,
      cvss40: calculateCVSS40Score(metrics),
    });
  const handleDREADChange = (metrics: DREADMetrics) =>
    onChange({
      ...value,
      enabledFrameworks,
      dread: calculateDREADScore(metrics),
    });
  const handleOWASPChange = (metrics: OWASPRiskRatingMetrics) =>
    onChange({
      ...value,
      enabledFrameworks,
      owaspRiskRating: calculateOWASPRiskRating(metrics),
    });
  const handleFAIRChange = (factors: FAIRFactors) =>
    onChange({ ...value, enabledFrameworks, fair: calculateFAIR(factors) });

  const ciaScore = value?.ciaTriad
    ? calculateCIAImpactScore(value.ciaTriad)
    : null;
  const cvss31Score = value?.cvss31?.baseScore ?? null;
  const cvss40Score = value?.cvss40?.baseScore ?? null;
  const dreadScore = value?.dread?.averageScore ?? null;
  const owaspScore = value?.owaspRiskRating?.overallRiskScore ?? null;
  const fairALE = value?.fair?.annualizedLossExpectancy ?? null;

  return (
    <div className="space-y-4">
      {!readonly && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label className="text-sm font-medium">Risk Frameworks</Label>
            <Info className="w-3 h-3 text-muted-foreground" />
          </div>
          <div className="flex flex-wrap gap-2">
            {RISK_FRAMEWORKS.map((framework) => (
              <label
                key={framework.value}
                className={`flex items-center gap-2 px-2 py-1 rounded border cursor-pointer hover:bg-muted/50 transition-colors ${
                  framework.value === "CVSS_3_1" ? "border-primary/50" : ""
                }`}
              >
                <Checkbox
                  checked={enabledFrameworks.includes(framework.value)}
                  onCheckedChange={() => toggleFramework(framework.value)}
                />
                <span className="text-xs">{framework.shortLabel}</span>
                {framework.value === "CVSS_3_1" && (
                  <span className="text-[9px] bg-primary/10 text-primary px-1 rounded">
                    Rec
                  </span>
                )}
              </label>
            ))}
          </div>
        </div>
      )}

      {compact && (
        <div className="flex flex-wrap gap-2 text-xs">
          {enabledFrameworks.includes("CIA_TRIAD") && ciaScore !== null && (
            <span className="px-2 py-1 bg-muted rounded">CIA: {ciaScore}</span>
          )}
          {enabledFrameworks.includes("CVSS_3_1") && cvss31Score !== null && (
            <span className="px-2 py-1 bg-muted rounded">
              CVSS 3.1: {cvss31Score}
            </span>
          )}
          {enabledFrameworks.includes("CVSS_4_0") && cvss40Score !== null && (
            <span className="px-2 py-1 bg-muted rounded">
              CVSS 4.0: {cvss40Score}
            </span>
          )}
          {enabledFrameworks.includes("DREAD") && dreadScore !== null && (
            <span className="px-2 py-1 bg-muted rounded">
              DREAD: {dreadScore}
            </span>
          )}
          {enabledFrameworks.includes("OWASP_RISK_RATING") &&
            owaspScore !== null && (
              <span className="px-2 py-1 bg-muted rounded">
                OWASP: {owaspScore}
              </span>
            )}
          {enabledFrameworks.includes("FAIR") && fairALE !== null && (
            <span className="px-2 py-1 bg-muted rounded">
              ALE: {formatCurrency(fairALE)}
            </span>
          )}
        </div>
      )}

      <div className="space-y-2">
        {enabledFrameworks.includes("CIA_TRIAD") && (
          <FrameworkCollapsible
            framework="CIA_TRIAD"
            expanded={expandedFrameworks.has("CIA_TRIAD")}
            onToggle={() => toggleExpanded("CIA_TRIAD")}
            score={ciaScore !== null ? `${ciaScore}/10` : undefined}
          >
            <CIATriadPanel
              value={value?.ciaTriad || DEFAULT_CIA_TRIAD}
              onChange={handleCIAChange}
              readonly={readonly}
            />
          </FrameworkCollapsible>
        )}
        {enabledFrameworks.includes("CVSS_3_1") && (
          <FrameworkCollapsible
            framework="CVSS_3_1"
            expanded={expandedFrameworks.has("CVSS_3_1")}
            onToggle={() => toggleExpanded("CVSS_3_1")}
            score={cvss31Score !== null ? String(cvss31Score) : undefined}
            severity={value?.cvss31?.severity}
          >
            <CVSS31Panel
              value={value?.cvss31?.baseMetrics || DEFAULT_CVSS31_BASE_METRICS}
              onChange={handleCVSS31Change}
              readonly={readonly}
            />
          </FrameworkCollapsible>
        )}
        {enabledFrameworks.includes("CVSS_4_0") && (
          <FrameworkCollapsible
            framework="CVSS_4_0"
            expanded={expandedFrameworks.has("CVSS_4_0")}
            onToggle={() => toggleExpanded("CVSS_4_0")}
            score={cvss40Score !== null ? String(cvss40Score) : undefined}
            severity={value?.cvss40?.severity}
          >
            <CVSS40Panel
              value={value?.cvss40?.baseMetrics || DEFAULT_CVSS40_BASE_METRICS}
              onChange={handleCVSS40Change}
              readonly={readonly}
            />
          </FrameworkCollapsible>
        )}
        {enabledFrameworks.includes("DREAD") && (
          <FrameworkCollapsible
            framework="DREAD"
            expanded={expandedFrameworks.has("DREAD")}
            onToggle={() => toggleExpanded("DREAD")}
            score={dreadScore !== null ? String(dreadScore) : undefined}
            severity={value?.dread?.severity}
          >
            <DREADPanel
              value={value?.dread?.metrics || DEFAULT_DREAD_METRICS}
              onChange={handleDREADChange}
              readonly={readonly}
            />
          </FrameworkCollapsible>
        )}
        {enabledFrameworks.includes("OWASP_RISK_RATING") && (
          <FrameworkCollapsible
            framework="OWASP_RISK_RATING"
            expanded={expandedFrameworks.has("OWASP_RISK_RATING")}
            onToggle={() => toggleExpanded("OWASP_RISK_RATING")}
            score={owaspScore !== null ? String(owaspScore) : undefined}
            severity={value?.owaspRiskRating?.riskLevel}
          >
            <OWASPRiskPanel
              value={value?.owaspRiskRating?.metrics || DEFAULT_OWASP_METRICS}
              onChange={handleOWASPChange}
              readonly={readonly}
            />
          </FrameworkCollapsible>
        )}
        {enabledFrameworks.includes("FAIR") && (
          <FrameworkCollapsible
            framework="FAIR"
            expanded={expandedFrameworks.has("FAIR")}
            onToggle={() => toggleExpanded("FAIR")}
            score={fairALE !== null ? formatCurrency(fairALE) : undefined}
            severity={value?.fair?.riskLevel}
          >
            <FAIRPanel
              value={value?.fair?.factors || DEFAULT_FAIR_FACTORS}
              onChange={handleFAIRChange}
              readonly={readonly}
            />
          </FrameworkCollapsible>
        )}
      </div>

      {enabledFrameworks.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">
          Select at least one risk framework to score this threat.
        </p>
      )}

      {!compact && value && enabledFrameworks.length >= 2 && (
        <FrameworkCompare scores={value} />
      )}
    </div>
  );
}

"use client";

/**
 * CVSS40Panel - CVSS 4.0 score calculator component.
 */
import { Label } from "@/components/ui/label";
import {
  CVSSScoreHeader,
  CVSSVectorFooter,
  MetricSelect,
} from "./CVSSPanelParts";
import type {
  CVSS40BaseMetrics,
  CVSS40Score,
} from "../../types/risk-frameworks";
import {
  CVSS40_ATTACK_VECTOR,
  CVSS40_ATTACK_COMPLEXITY,
  CVSS40_ATTACK_REQUIREMENTS,
  CVSS40_PRIVILEGES_REQUIRED,
  CVSS40_USER_INTERACTION,
  CVSS40_IMPACT,
} from "../../constants/risk-frameworks";
import { calculateCVSS40Score, getCVSS40Summary } from "../../utils";

interface CVSS40PanelProps {
  value: CVSS40BaseMetrics;
  onChange: (value: CVSS40BaseMetrics) => void;
  readonly?: boolean;
}

export function CVSS40Panel({
  value,
  onChange,
  readonly = false,
}: CVSS40PanelProps) {
  const score: CVSS40Score = calculateCVSS40Score(value);

  const handleChange = <K extends keyof CVSS40BaseMetrics>(
    key: K,
    newValue: CVSS40BaseMetrics[K],
  ) => {
    onChange({ ...value, [key]: newValue });
  };

  return (
    <div className="space-y-3">
      {/* Header with score */}
      <CVSSScoreHeader
        title="CVSS 4.0"
        baseScore={score.baseScore}
        severity={score.severity}
      />

      {/* Exploitability Metrics */}
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Exploitability</Label>
        <div className="grid grid-cols-2 gap-2">
          <MetricSelect
            label="Attack Vector"
            value={value.attackVector}
            options={CVSS40_ATTACK_VECTOR}
            onChange={(v) => handleChange("attackVector", v)}
            disabled={readonly}
          />
          <MetricSelect
            label="Attack Complexity"
            value={value.attackComplexity}
            options={CVSS40_ATTACK_COMPLEXITY}
            onChange={(v) => handleChange("attackComplexity", v)}
            disabled={readonly}
          />
          <MetricSelect
            label="Attack Requirements"
            value={value.attackRequirements}
            options={CVSS40_ATTACK_REQUIREMENTS}
            onChange={(v) => handleChange("attackRequirements", v)}
            disabled={readonly}
          />
          <MetricSelect
            label="Privileges Required"
            value={value.privilegesRequired}
            options={CVSS40_PRIVILEGES_REQUIRED}
            onChange={(v) => handleChange("privilegesRequired", v)}
            disabled={readonly}
          />
          <MetricSelect
            label="User Interaction"
            value={value.userInteraction}
            options={CVSS40_USER_INTERACTION}
            onChange={(v) => handleChange("userInteraction", v)}
            disabled={readonly}
          />
        </div>
      </div>

      {/* Vulnerable System Impact */}
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">
          Vulnerable System Impact (C/I/A)
        </Label>
        <div className="grid grid-cols-3 gap-2">
          <MetricSelect
            label="Confidentiality"
            value={value.vulnConfidentialityImpact}
            options={CVSS40_IMPACT}
            onChange={(v) => handleChange("vulnConfidentialityImpact", v)}
            disabled={readonly}
          />
          <MetricSelect
            label="Integrity"
            value={value.vulnIntegrityImpact}
            options={CVSS40_IMPACT}
            onChange={(v) => handleChange("vulnIntegrityImpact", v)}
            disabled={readonly}
          />
          <MetricSelect
            label="Availability"
            value={value.vulnAvailabilityImpact}
            options={CVSS40_IMPACT}
            onChange={(v) => handleChange("vulnAvailabilityImpact", v)}
            disabled={readonly}
          />
        </div>
      </div>

      <CVSSVectorFooter
        vectorString={score.vectorString}
        summary={getCVSS40Summary(score)}
      />
    </div>
  );
}

"use client";

/**
 * CVSS31Panel - CVSS 3.1 score calculator component.
 */
import { Label } from "@/components/ui/label";
import {
  CVSSScoreHeader,
  CVSSVectorFooter,
  MetricSelect,
} from "./CVSSPanelParts";
import type {
  CVSS31BaseMetrics,
  CVSS31Score,
} from "../../types/risk-frameworks";
import {
  CVSS31_ATTACK_VECTOR,
  CVSS31_ATTACK_COMPLEXITY,
  CVSS31_PRIVILEGES_REQUIRED,
  CVSS31_USER_INTERACTION,
  CVSS31_SCOPE,
  CVSS31_IMPACT,
} from "../../constants/risk-frameworks";
import { calculateCVSS31Score, getCVSS31Summary } from "../../utils";

interface CVSS31PanelProps {
  value: CVSS31BaseMetrics;
  onChange: (value: CVSS31BaseMetrics) => void;
  readonly?: boolean;
}

export function CVSS31Panel({
  value,
  onChange,
  readonly = false,
}: CVSS31PanelProps) {
  const score: CVSS31Score = calculateCVSS31Score(value);

  const handleChange = <K extends keyof CVSS31BaseMetrics>(
    key: K,
    newValue: CVSS31BaseMetrics[K],
  ) => {
    onChange({ ...value, [key]: newValue });
  };

  return (
    <div className="space-y-3">
      {/* Header with score */}
      <CVSSScoreHeader
        title="CVSS 3.1"
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
            options={CVSS31_ATTACK_VECTOR}
            onChange={(v) => handleChange("attackVector", v)}
            disabled={readonly}
          />
          <MetricSelect
            label="Attack Complexity"
            value={value.attackComplexity}
            options={CVSS31_ATTACK_COMPLEXITY}
            onChange={(v) => handleChange("attackComplexity", v)}
            disabled={readonly}
          />
          <MetricSelect
            label="Privileges Required"
            value={value.privilegesRequired}
            options={CVSS31_PRIVILEGES_REQUIRED}
            onChange={(v) => handleChange("privilegesRequired", v)}
            disabled={readonly}
          />
          <MetricSelect
            label="User Interaction"
            value={value.userInteraction}
            options={CVSS31_USER_INTERACTION}
            onChange={(v) => handleChange("userInteraction", v)}
            disabled={readonly}
          />
        </div>
      </div>

      {/* Scope */}
      <div className="space-y-2">
        <MetricSelect
          label="Scope"
          value={value.scope}
          options={CVSS31_SCOPE}
          onChange={(v) => handleChange("scope", v)}
          disabled={readonly}
        />
      </div>

      {/* Impact Metrics */}
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Impact (C/I/A)</Label>
        <div className="grid grid-cols-3 gap-2">
          <MetricSelect
            label="Confidentiality"
            value={value.confidentialityImpact}
            options={CVSS31_IMPACT}
            onChange={(v) => handleChange("confidentialityImpact", v)}
            disabled={readonly}
          />
          <MetricSelect
            label="Integrity"
            value={value.integrityImpact}
            options={CVSS31_IMPACT}
            onChange={(v) => handleChange("integrityImpact", v)}
            disabled={readonly}
          />
          <MetricSelect
            label="Availability"
            value={value.availabilityImpact}
            options={CVSS31_IMPACT}
            onChange={(v) => handleChange("availabilityImpact", v)}
            disabled={readonly}
          />
        </div>
      </div>

      <CVSSVectorFooter
        vectorString={score.vectorString}
        summary={getCVSS31Summary(score)}
      />
    </div>
  );
}

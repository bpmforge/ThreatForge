"use client";

/**
 * FAIRPanel - FAIR quantitative risk calculator.
 * Translates threat factors into dollar-denominated Annualized Loss Expectancy (ALE).
 */
import { severityDot } from "@/lib/severity";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import type { FAIRFactors } from "../../types/risk-frameworks";
import { calculateFAIR, formatCurrency } from "../../utils/fair-calculator";

interface FAIRPanelProps {
  value: FAIRFactors;
  onChange: (value: FAIRFactors) => void;
  readonly?: boolean;
}

function CurrencyField({
  label,
  description,
  value,
  onChange,
  readonly,
}: {
  label: string;
  description: string;
  value: number;
  onChange: (v: number) => void;
  readonly?: boolean;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <Label className="text-xs">{label}</Label>
        <span className="text-xs text-muted-foreground">
          {formatCurrency(value)}
        </span>
      </div>
      <p className="text-[10px] text-muted-foreground">{description}</p>
      {!readonly && (
        <Input
          type="number"
          min={0}
          value={value}
          onChange={(e) => onChange(Math.max(0, Number(e.target.value)))}
          className="h-7 text-xs"
          aria-label={label}
        />
      )}
    </div>
  );
}

export function FAIRPanel({
  value,
  onChange,
  readonly = false,
}: FAIRPanelProps) {
  const result = calculateFAIR(value);

  const update = (key: keyof FAIRFactors, v: number) =>
    onChange({ ...value, [key]: v });

  return (
    <div className="space-y-4">
      {/* ALE result banner */}
      <div className="rounded-lg border p-3 flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground">
            Annualized Loss Expectancy (ALE)
          </p>
          <p className="text-2xl font-bold">
            {formatCurrency(result.annualizedLossExpectancy)}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            LEF {result.lossEventFrequency}/yr × SLE{" "}
            {formatCurrency(result.singleLossExpectancy)}
          </p>
        </div>
        <span
          className={`px-3 py-1 rounded text-xs font-semibold text-white ${severityDot(result.riskLevel)}`}
        >
          {result.riskLevel}
        </span>
      </div>

      {/* Loss Event Frequency inputs */}
      <div className="space-y-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Loss Event Frequency
        </p>

        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Threat Event Frequency</Label>
            <span className="text-xs font-medium">
              {value.threatEventFrequency}×/yr
            </span>
          </div>
          <p className="text-[10px] text-muted-foreground">
            How many times per year does an attacker attempt this?
          </p>
          <Slider
            value={[value.threatEventFrequency]}
            onValueChange={([v]) => update("threatEventFrequency", v)}
            min={0}
            max={52}
            step={1}
            disabled={readonly}
            className="h-1"
            aria-label="Threat event frequency"
          />
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Vulnerability</Label>
            <span className="text-xs font-medium">
              {Math.round(value.vulnerability * 100)}%
            </span>
          </div>
          <p className="text-[10px] text-muted-foreground">
            Probability the attacker succeeds per attempt (0–100%)
          </p>
          <Slider
            value={[Math.round(value.vulnerability * 100)]}
            onValueChange={([v]) => update("vulnerability", v / 100)}
            min={0}
            max={100}
            step={5}
            disabled={readonly}
            className="h-1"
            aria-label="Vulnerability probability"
          />
        </div>
      </div>

      {/* Loss Magnitude inputs */}
      <div className="space-y-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Loss Magnitude
        </p>
        <CurrencyField
          label="Primary Loss"
          description="Direct cost per incident: remediation, recovery, notifications ($)"
          value={value.primaryLoss}
          onChange={(v) => update("primaryLoss", v)}
          readonly={readonly}
        />

        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Secondary Loss Probability</Label>
            <span className="text-xs font-medium">
              {Math.round(value.secondaryLossEventFrequency * 100)}%
            </span>
          </div>
          <p className="text-[10px] text-muted-foreground">
            Probability that secondary losses (fines, litigation) also occur
          </p>
          <Slider
            value={[Math.round(value.secondaryLossEventFrequency * 100)]}
            onValueChange={([v]) =>
              update("secondaryLossEventFrequency", v / 100)
            }
            min={0}
            max={100}
            step={5}
            disabled={readonly}
            className="h-1"
            aria-label="Secondary loss event frequency"
          />
        </div>

        <CurrencyField
          label="Secondary Loss"
          description="Regulatory fines, reputation loss, litigation costs ($)"
          value={value.secondaryLoss}
          onChange={(v) => update("secondaryLoss", v)}
          readonly={readonly}
        />
      </div>
    </div>
  );
}

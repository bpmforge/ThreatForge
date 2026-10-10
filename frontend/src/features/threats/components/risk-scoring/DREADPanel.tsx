"use client";

/**
 * DREADPanel - DREAD risk rating component.
 */
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import type { DREADMetrics, DREADRating } from "../../types/risk-frameworks";
import { DREAD_CATEGORIES } from "../../constants/risk-frameworks";
import {
  calculateDREADScore,
  getDREADSummary,
  getDREADSeverityColor,
} from "../../utils";

interface DREADPanelProps {
  value: DREADMetrics;
  onChange: (value: DREADMetrics) => void;
  readonly?: boolean;
}

export function DREADPanel({
  value,
  onChange,
  readonly = false,
}: DREADPanelProps) {
  const score = calculateDREADScore(value);

  const handleChange = (key: keyof DREADMetrics, rating: number) => {
    onChange({ ...value, [key]: rating as DREADRating });
  };

  return (
    <div className="space-y-3">
      {/* Header with score */}
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">DREAD</Label>
        <div className="flex items-center gap-2">
          <span
            className={`px-2 py-0.5 rounded text-xs text-white font-medium ${getDREADSeverityColor(score.averageScore)}`}
          >
            {score.averageScore}
          </span>
          <span className="text-xs text-muted-foreground">
            {score.severity}
          </span>
        </div>
      </div>

      {/* DREAD Factors */}
      <div className="space-y-3">
        {DREAD_CATEGORIES.map((category) => {
          const key = category.key as keyof DREADMetrics;
          return (
            <div key={category.key} className="space-y-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-muted text-[10px] font-bold">
                    {category.short}
                  </span>
                  <Label className="text-xs">{category.label}</Label>
                </div>
                <span className="text-xs font-medium w-6 text-right">
                  {value[key]}
                </span>
              </div>
              <Slider
                value={[value[key]]}
                onValueChange={([v]) => handleChange(key, v)}
                max={10}
                step={1}
                disabled={readonly}
                className="h-1"
              />
              <p className="text-[10px] text-muted-foreground">
                {category.guidance}
              </p>
            </div>
          );
        })}
      </div>

      {/* Summary */}
      <div className="pt-2 border-t">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Total Score</span>
          <span className="font-medium">{score.totalScore}/50</span>
        </div>
        <p className="text-xs text-muted-foreground italic mt-1">
          {getDREADSummary(score)}
        </p>
      </div>
    </div>
  );
}

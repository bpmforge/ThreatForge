"use client";

/**
 * CIATriadPanel - CIA Triad impact assessment component.
 */
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CIATriadScore, CIALevel } from "../../types/risk-frameworks";
import {
  CIA_LEVELS,
  CIA_TRIAD_DESCRIPTIONS,
} from "../../constants/risk-frameworks";
import {
  getCIALevelColor,
  getCIATriadSummary,
  calculateCIAImpactScore,
} from "../../utils";

interface CIATriadPanelProps {
  value: CIATriadScore;
  onChange: (value: CIATriadScore) => void;
  readonly?: boolean;
}

export function CIATriadPanel({
  value,
  onChange,
  readonly = false,
}: CIATriadPanelProps) {
  const handleChange = (dimension: keyof CIATriadScore, level: CIALevel) => {
    onChange({ ...value, [dimension]: level });
  };

  const impactScore = calculateCIAImpactScore(value);
  const summary = getCIATriadSummary(value);

  const dimensions: (keyof CIATriadScore)[] = [
    "confidentiality",
    "integrity",
    "availability",
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">CIA Triad Impact</Label>
        <span className="text-xs text-muted-foreground">
          Score: {impactScore}/10
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {dimensions.map((dim) => (
          <div key={dim} className="space-y-1">
            <Label className="text-xs capitalize">
              {dim.slice(0, 1).toUpperCase()}
            </Label>
            <Select
              value={value[dim]}
              onValueChange={(v) => handleChange(dim, v as CIALevel)}
              disabled={readonly}
            >
              <SelectTrigger className="h-8 text-xs">
                <div className="flex items-center gap-1">
                  <span
                    className={`w-2 h-2 rounded-full ${getCIALevelColor(value[dim])}`}
                  />
                  <SelectValue />
                </div>
              </SelectTrigger>
              <SelectContent>
                {CIA_LEVELS.map((level) => (
                  <SelectItem key={level.value} value={level.value}>
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-2 h-2 rounded-full ${getCIALevelColor(level.value)}`}
                      />
                      <span>{level.label}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p
              className="text-[10px] text-muted-foreground truncate"
              title={CIA_TRIAD_DESCRIPTIONS[dim]}
            >
              {CIA_TRIAD_DESCRIPTIONS[dim]}
            </p>
          </div>
        ))}
      </div>

      <p className="text-xs text-muted-foreground italic">{summary}</p>
    </div>
  );
}

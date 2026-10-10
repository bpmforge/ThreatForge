"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import type { StrideCategory, Severity } from "@/types/canvas";

const STRIDE_NAMES: Record<StrideCategory, string> = {
  SPOOFING: "Spoofing",
  TAMPERING: "Tampering",
  REPUDIATION: "Repudiation",
  INFORMATION_DISCLOSURE: "Information Disclosure",
  DENIAL_OF_SERVICE: "Denial of Service",
  ELEVATION_OF_PRIVILEGE: "Elevation of Privilege",
};

interface TemplateCategorySelectsProps {
  strideCategory: StrideCategory;
  severity: Severity;
  onStrideCategoryChange: (v: StrideCategory) => void;
  onSeverityChange: (v: Severity) => void;
}

export function TemplateCategorySelects({
  strideCategory,
  severity,
  onStrideCategoryChange,
  onSeverityChange,
}: TemplateCategorySelectsProps) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="space-y-2">
        <Label>STRIDE Category</Label>
        <Select
          value={strideCategory}
          onValueChange={(v) => onStrideCategoryChange(v as StrideCategory)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(STRIDE_NAMES).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Default Severity</Label>
        <Select
          value={severity}
          onValueChange={(v) => onSeverityChange(v as Severity)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="CRITICAL">Critical</SelectItem>
            <SelectItem value="HIGH">High</SelectItem>
            <SelectItem value="MEDIUM">Medium</SelectItem>
            <SelectItem value="LOW">Low</SelectItem>
            <SelectItem value="INFO">Info</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

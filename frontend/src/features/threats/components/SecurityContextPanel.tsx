"use client";

/**
 * Security Context Panel
 *
 * Added to the component properties panel. Lets users specify
 * data classification, compliance requirements, access patterns,
 * and existing controls for context-aware threat generation.
 */

import { Shield, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SecurityContextFields } from "./SecurityContextFields";
import { type SecurityContext } from "./security-context-data";

interface SecurityContextPanelProps {
  value: SecurityContext;
  onChange: (ctx: SecurityContext) => void;
  onAnalyze?: () => void;
  isAnalyzing?: boolean;
  componentType?: string;
}

export function SecurityContextPanel({
  value,
  onChange,
  onAnalyze,
  isAnalyzing,
}: SecurityContextPanelProps) {
  const toggle = (
    field: "dataTypes" | "complianceFrameworks" | "existingControls",
    item: string,
  ) => {
    const current = value[field];
    const updated = current.includes(item)
      ? current.filter((i) => i !== item)
      : [...current, item];
    onChange({ ...value, [field]: updated });
  };

  return (
    <div className="space-y-4 border rounded-lg p-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Shield className="h-4 w-4" />
        Security Context
      </div>

      <div className="space-y-4">
        <SecurityContextFields
          value={value}
          onChange={onChange}
          toggle={toggle}
        />

        {/* Analyze Button */}
        {onAnalyze && (
          <Button onClick={onAnalyze} disabled={isAnalyzing} className="w-full">
            <Wand2 className="h-4 w-4" />
            {isAnalyzing ? "Analyzing..." : "Analyze Threats (Context-Aware)"}
          </Button>
        )}
      </div>
    </div>
  );
}

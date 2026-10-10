"use client";

/**
 * AIGuardrails - Security and cost controls for AI.
 */
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { AISettings } from "../types";

interface AIGuardrailsProps {
  guardrails?: AISettings["guardrails"];
  onChange: (guardrails: AISettings["guardrails"]) => void;
  disabled?: boolean;
}

const DEFAULT_GUARDRAILS: AISettings["guardrails"] = {
  monthlyBudget: 0,
  anonymizeData: false,
  logInteractions: true,
};

export function AIGuardrails({
  guardrails,
  onChange,
  disabled,
}: AIGuardrailsProps) {
  const safeGuardrails = guardrails ?? DEFAULT_GUARDRAILS;

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-medium text-foreground">
        Security & Cost Controls
      </h4>
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="budget">Monthly Budget (USD)</Label>
          <Input
            id="budget"
            type="number"
            min={0}
            value={safeGuardrails.monthlyBudget}
            onChange={(e) =>
              onChange({
                ...safeGuardrails,
                monthlyBudget: parseInt(e.target.value) || 0,
              })
            }
            placeholder="0 = unlimited"
            disabled={disabled}
            className="w-32"
          />
          <p className="text-xs text-muted-foreground">
            Set to 0 for unlimited. AI features pause when reached.
          </p>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="anonymize">Anonymize Data</Label>
            <p className="text-xs text-muted-foreground">
              Strip component names before sending to AI
            </p>
          </div>
          <Switch
            id="anonymize"
            checked={safeGuardrails.anonymizeData}
            onCheckedChange={(checked) =>
              onChange({ ...safeGuardrails, anonymizeData: checked })
            }
            disabled={disabled}
          />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="log">Audit Logging</Label>
            <p className="text-xs text-muted-foreground">
              Log all AI interactions for compliance
            </p>
          </div>
          <Switch
            id="log"
            checked={safeGuardrails.logInteractions}
            onCheckedChange={(checked) =>
              onChange({ ...safeGuardrails, logInteractions: checked })
            }
            disabled={disabled}
          />
        </div>
      </div>
    </div>
  );
}

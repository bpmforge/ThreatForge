"use client";

/**
 * AIFeatureToggles - Toggle switches for AI features.
 */
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { AISettings } from "../types";

interface AIFeatureTogglesProps {
  features?: AISettings["features"];
  onChange: (features: AISettings["features"]) => void;
  disabled?: boolean;
}

const DEFAULT_FEATURES: AISettings["features"] = {
  autoSuggestThreats: true,
  autoSuggestMitigations: true,
  enableChat: true,
  agentChainV2: true,
};

export function AIFeatureToggles({
  features,
  onChange,
  disabled,
}: AIFeatureTogglesProps) {
  const safeFeatures = features ?? DEFAULT_FEATURES;

  const handleToggle = (key: keyof AISettings["features"]) => {
    onChange({ ...safeFeatures, [key]: !safeFeatures[key] });
  };

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-medium text-foreground">Features</h4>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="auto-threats">Auto-suggest Threats</Label>
            <p className="text-xs text-muted-foreground">
              Suggest threats when selecting a component
            </p>
          </div>
          <Switch
            id="auto-threats"
            checked={safeFeatures.autoSuggestThreats}
            onCheckedChange={() => handleToggle("autoSuggestThreats")}
            disabled={disabled}
          />
        </div>
        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="auto-mitigations">Auto-suggest Mitigations</Label>
            <p className="text-xs text-muted-foreground">
              Suggest mitigations for identified threats
            </p>
          </div>
          <Switch
            id="auto-mitigations"
            checked={safeFeatures.autoSuggestMitigations}
            onCheckedChange={() => handleToggle("autoSuggestMitigations")}
            disabled={disabled}
          />
        </div>
        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="enable-chat">AI Chat Assistant</Label>
            <p className="text-xs text-muted-foreground">
              Enable contextual AI chat panel
            </p>
          </div>
          <Switch
            id="enable-chat"
            checked={safeFeatures.enableChat}
            onCheckedChange={() => handleToggle("enableChat")}
            disabled={disabled}
          />
        </div>
        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="agent-chain-v2">
              Unified Orchestrator (agent-chain-v2)
            </Label>
            <p className="text-xs text-muted-foreground">
              Route threat suggestions through the 8-stage pipeline. Roll out
              per-org; see A6_ROLLOUT.md before enabling.
            </p>
          </div>
          <Switch
            id="agent-chain-v2"
            checked={safeFeatures.agentChainV2 ?? true}
            onCheckedChange={() => handleToggle("agentChainV2")}
            disabled={disabled}
          />
        </div>
      </div>
    </div>
  );
}

"use client";

/**
 * AISettingsPanel - Main panel for configuring AI settings.
 */
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AISettings, AIProvider } from "../types";
import { apiGet } from "@/lib/api-client";
import { AI_MODELS } from "../types";
import { AIProviderSelect } from "./AIProviderSelect";
import { AIApiKeyInput } from "./AIApiKeyInput";
import { AIFeatureToggles } from "./AIFeatureToggles";
import { AIGuardrails } from "./AIGuardrails";

interface DynamicModel {
  value: string;
  label: string;
}

/** Fetch models dynamically from local providers (LM Studio, Ollama) */
async function fetchDynamicModels(
  provider: AIProvider,
): Promise<DynamicModel[]> {
  if (provider !== "lmstudio" && provider !== "ollama") {
    return [];
  }
  try {
    const data = await apiGet<{ models?: DynamicModel[] }>(
      `/api/ai/providers/${provider}/models`,
    );
    return data.models || [];
  } catch {
    return [];
  }
}

interface AISettingsPanelProps {
  settings: AISettings;
  onSave: (settings: Partial<AISettings>) => void;
  saving?: boolean;
  error?: string | null;
}

export function AISettingsPanel({
  settings,
  onSave,
  saving,
  error,
}: AISettingsPanelProps) {
  // Component should be keyed by the parent when settings identity changes
  const [draft, setDraft] = useState<AISettings>(settings);
  const [hasChanges, setHasChanges] = useState(false);
  const [dynamicModels, setDynamicModels] = useState<DynamicModel[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);

  // Fetch dynamic models when provider changes to lmstudio or ollama
  useEffect(() => {
    const isLocalProvider =
      draft.provider === "lmstudio" || draft.provider === "ollama";
    if (isLocalProvider && draft.enabled) {
      let cancelled = false;
      // Use microtask to avoid synchronous setState during render
      queueMicrotask(() => {
        if (!cancelled) setLoadingModels(true);
      });
      fetchDynamicModels(draft.provider)
        .then((models) => {
          if (cancelled) return;
          setDynamicModels(models);
          // Auto-select first model if none selected
          if (models.length > 0 && !draft.model) {
            setDraft((prev) => ({ ...prev, model: models[0].value }));
          }
        })
        .finally(() => {
          if (!cancelled) setLoadingModels(false);
        });
      return () => {
        cancelled = true;
      };
    } else {
      // Use microtask to avoid synchronous setState during render
      queueMicrotask(() => setDynamicModels([]));
    }
  }, [draft.provider, draft.enabled]);

  const updateDraft = (updates: Partial<AISettings>) => {
    setDraft((prev) => ({ ...prev, ...updates }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    await onSave(draft);
    setHasChanges(false);
  };

  // Use dynamic models for local providers, static for others
  const isLocalProvider =
    draft.provider === "lmstudio" || draft.provider === "ollama";
  const models =
    isLocalProvider && dynamicModels.length > 0
      ? dynamicModels
      : AI_MODELS[draft.provider] || [];

  return (
    <div className="space-y-6">
      {/* Master Toggle */}
      <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
        <div>
          <Label className="text-base font-medium">Enable AI Features</Label>
          <p className="text-sm text-muted-foreground">
            {draft.enabled
              ? "AI features are enabled for this organization"
              : "AI features are disabled"}
          </p>
        </div>
        <Switch
          checked={draft.enabled}
          onCheckedChange={(enabled) => updateDraft({ enabled })}
          disabled={saving}
        />
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
          {error}
        </div>
      )}

      <Separator />

      {/* Provider Selection */}
      <div className="space-y-4">
        <AIProviderSelect
          value={draft.provider}
          onChange={(provider) =>
            updateDraft({ provider, model: AI_MODELS[provider]?.[0]?.value })
          }
          disabled={saving || !draft.enabled}
        />

        {draft.provider !== "none" && (
          <>
            <AIApiKeyInput
              value={draft.apiKey || ""}
              provider={draft.provider}
              onChange={(apiKey) => updateDraft({ apiKey })}
              disabled={saving || !draft.enabled}
            />

            {(models.length > 0 || loadingModels) && (
              <div className="space-y-2">
                <Label htmlFor="model">Model</Label>
                <Select
                  value={draft.model || models[0]?.value}
                  onValueChange={(model) => updateDraft({ model })}
                  disabled={saving || !draft.enabled || loadingModels}
                >
                  <SelectTrigger id="model">
                    <SelectValue
                      placeholder={
                        loadingModels ? "Loading models..." : "Select model"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {models.map((model) => (
                      <SelectItem key={model.value} value={model.value}>
                        {model.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {isLocalProvider && dynamicModels.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {dynamicModels.length} model
                    {dynamicModels.length !== 1 ? "s" : ""} available from{" "}
                    {draft.provider === "lmstudio" ? "LM Studio" : "Ollama"}
                  </p>
                )}
                {isLocalProvider &&
                  !loadingModels &&
                  dynamicModels.length === 0 && (
                    <p className="text-xs text-amber-600">
                      No models found. Make sure{" "}
                      {draft.provider === "lmstudio" ? "LM Studio" : "Ollama"}{" "}
                      is running with models loaded.
                    </p>
                  )}
              </div>
            )}
          </>
        )}
      </div>

      <Separator />

      {/* Feature Toggles */}
      <AIFeatureToggles
        features={draft.features}
        onChange={(features) => updateDraft({ features })}
        disabled={saving || !draft.enabled || draft.provider === "none"}
      />

      <Separator />

      {/* Guardrails */}
      <AIGuardrails
        guardrails={draft.guardrails}
        onChange={(guardrails) => updateDraft({ guardrails })}
        disabled={saving || !draft.enabled}
      />

      {/* Save Button */}
      <div className="flex justify-end pt-4">
        <Button onClick={handleSave} disabled={!hasChanges || saving}>
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </div>
  );
}

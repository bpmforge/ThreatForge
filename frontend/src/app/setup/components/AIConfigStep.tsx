"use client";

/**
 * AI Configuration Step
 * Configure the AI provider for threat analysis.
 */
import { getErrorMessage } from "@/lib/errors";
import { useState } from "react";
import { apiPost } from "@/lib/api-client";
import { setupTokenHeaders, useSetupStore } from "../store";
import { StepNavigation } from "./StepControls";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Brain, CheckCircle, XCircle, Loader2 } from "lucide-react";
const providers = [
  {
    value: "anthropic",
    label: "Anthropic (Claude)",
    description: "Claude AI for intelligent threat analysis",
    requiresApiKey: true,
  },
  {
    value: "openai",
    label: "OpenAI (GPT-4)",
    description: "GPT-4 for threat modeling assistance",
    requiresApiKey: true,
  },
  {
    value: "google",
    label: "Google (Gemini)",
    description: "Gemini AI for threat identification",
    requiresApiKey: true,
  },
  {
    value: "ollama",
    label: "Ollama (Local)",
    description: "Self-hosted LLM for privacy",
    requiresApiKey: false,
    requiresBaseUrl: true,
  },
  {
    value: "lmstudio",
    label: "LM Studio (Local)",
    description: "Run local models with LM Studio",
    requiresApiKey: false,
    requiresBaseUrl: true,
  },
  {
    value: "none",
    label: "Disabled",
    description: "AI features will be disabled",
    requiresApiKey: false,
  },
];

export function AIConfigStep() {
  const { ai, setAIConfigData, setupToken } = useSetupStore();
  const [isTesting, setIsTesting] = useState(false);

  const selectedProvider = providers.find((p) => p.value === ai.provider);

  const handleProviderChange = (value: string) => {
    setAIConfigData({
      provider: value as typeof ai.provider,
      testStatus: "idle",
      testMessage: "",
    });
  };

  const testConnection = async () => {
    setIsTesting(true);
    setAIConfigData({ testStatus: "testing", testMessage: "" });

    try {
      const data = await apiPost<{
        success?: boolean;
        message?: string;
        error?: string;
      }>(
        "/api/setup/test-ai",
        {
          provider: ai.provider,
          apiKey: ai.apiKey,
          baseUrl: ai.baseUrl,
        },
        { sameOrigin: true, ...setupTokenHeaders(setupToken) },
      );

      if (data.success) {
        setAIConfigData({
          testStatus: "success",
          testMessage: data.message || "Connection successful!",
        });
      } else {
        setAIConfigData({
          testStatus: "error",
          testMessage: data.error || "Connection failed",
        });
      }
    } catch (error) {
      setAIConfigData({
        testStatus: "error",
        testMessage: getErrorMessage(error, "Connection test failed"),
      });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">AI Configuration</h2>
        <p className="mt-1 text-muted-foreground">
          Configure AI-powered threat analysis (optional)
        </p>
      </div>

      <div className="flex items-center justify-between rounded-lg border border-border bg-card p-4">
        <div className="flex items-center gap-3">
          <Brain className="h-6 w-6 text-blue-500" />
          <div>
            <h3 className="font-medium text-foreground">Enable AI Features</h3>
            <p className="text-sm text-muted-foreground">
              Get intelligent threat suggestions and STRIDE analysis
            </p>
          </div>
        </div>
        <Switch
          checked={ai.enabled}
          onCheckedChange={(enabled) => setAIConfigData({ enabled })}
        />
      </div>

      {ai.enabled && (
        <div className="space-y-4">
          {/* Provider Selection */}
          <div className="space-y-2">
            <Label className="text-slate-200">AI Provider</Label>
            <Select value={ai.provider} onValueChange={handleProviderChange}>
              <SelectTrigger className="bg-background border-border text-foreground">
                <SelectValue placeholder="Select a provider" />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                {providers.map((provider) => (
                  <SelectItem
                    key={provider.value}
                    value={provider.value}
                    className="text-foreground focus:bg-muted focus:text-foreground"
                  >
                    <div>
                      <div className="font-medium">{provider.label}</div>
                      <div className="text-sm text-muted-foreground">
                        {provider.description}
                      </div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* API Key (for cloud providers) */}
          {selectedProvider?.requiresApiKey && (
            <div className="space-y-2">
              <Label htmlFor="api-key" className="text-slate-200">
                API Key
              </Label>
              <Input
                id="api-key"
                type="password"
                placeholder={`Enter your ${selectedProvider.label.split(" ")[0]} API key`}
                value={ai.apiKey}
                onChange={(e) => setAIConfigData({ apiKey: e.target.value })}
                className="bg-background border-border text-foreground placeholder:text-muted-foreground"
              />
              <p className="text-sm text-muted-foreground">
                Your API key is stored securely and never shared
              </p>
            </div>
          )}

          {/* Base URL (for local providers) */}
          {selectedProvider?.requiresBaseUrl && (
            <div className="space-y-2">
              <Label htmlFor="base-url" className="text-slate-200">
                Base URL
              </Label>
              <Input
                id="base-url"
                placeholder={
                  ai.provider === "ollama"
                    ? "http://localhost:11434"
                    : "http://localhost:1234/v1"
                }
                value={ai.baseUrl}
                onChange={(e) => setAIConfigData({ baseUrl: e.target.value })}
                className="bg-background border-border text-foreground placeholder:text-muted-foreground"
              />
            </div>
          )}

          {/* Test Connection */}
          {ai.provider !== "none" && (
            <div className="space-y-2">
              <Button
                variant="outline"
                onClick={testConnection}
                disabled={isTesting}
                className="border-border"
              >
                {isTesting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Testing...
                  </>
                ) : (
                  "Test Connection"
                )}
              </Button>

              {ai.testStatus === "success" && (
                <div className="flex items-center gap-2 text-green-400">
                  <CheckCircle className="h-4 w-4" />
                  <span className="text-sm">{ai.testMessage}</span>
                </div>
              )}

              {ai.testStatus === "error" && (
                <div className="flex items-center gap-2 text-red-400">
                  <XCircle className="h-4 w-4" />
                  <span className="text-sm">{ai.testMessage}</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {!ai.enabled && (
        <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-4">
          <p className="text-sm text-yellow-400">
            AI features can be enabled later in the admin settings.
          </p>
        </div>
      )}

      <StepNavigation />
    </div>
  );
}

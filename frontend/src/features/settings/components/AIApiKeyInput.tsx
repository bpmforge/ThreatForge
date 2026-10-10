"use client";

/**
 * AIApiKeyInput - Secure input for API keys.
 */
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import type { AIProvider } from "../types";

interface AIApiKeyInputProps {
  value: string;
  provider: AIProvider;
  onChange: (key: string) => void;
  disabled?: boolean;
}

const API_KEY_HINTS: Record<AIProvider, string> = {
  none: "",
  claude: "sk-ant-api...",
  openai: "sk-proj-...",
  ollama: "Not required for local Ollama",
  lmstudio: "Not required for LM Studio",
};

export function AIApiKeyInput({
  value,
  provider,
  onChange,
  disabled,
}: AIApiKeyInputProps) {
  const [showKey, setShowKey] = useState(false);
  const isMasked = value?.includes("••••");
  const isLocalProvider = provider === "ollama" || provider === "lmstudio";

  if (provider === "none") return null;

  return (
    <div className="space-y-2">
      <Label htmlFor="api-key">API Key</Label>
      <div className="flex gap-2">
        <Input
          id="api-key"
          type={showKey ? "text" : "password"}
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={API_KEY_HINTS[provider]}
          disabled={disabled || isLocalProvider}
          className="flex-1"
        />
        {!isLocalProvider && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowKey(!showKey)}
            disabled={disabled}
          >
            {showKey ? "Hide" : "Show"}
          </Button>
        )}
      </div>
      {isMasked && (
        <p className="text-xs text-amber-600">
          Enter a new key to replace the existing one
        </p>
      )}
      {isLocalProvider && (
        <p className="text-xs text-muted-foreground">
          {provider === "lmstudio" ? "LM Studio" : "Ollama"} runs locally and
          doesn&apos;t require an API key
        </p>
      )}
    </div>
  );
}

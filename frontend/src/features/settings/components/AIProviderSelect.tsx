"use client";

/**
 * AIProviderSelect - Dropdown for selecting AI provider.
 */
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AIProvider } from "../types";
import { AI_PROVIDERS } from "../types";

interface AIProviderSelectProps {
  value: AIProvider;
  onChange: (provider: AIProvider) => void;
  disabled?: boolean;
}

export function AIProviderSelect({
  value,
  onChange,
  disabled,
}: AIProviderSelectProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor="ai-provider">AI Provider</Label>
      <Select
        value={value}
        onValueChange={(v) => onChange(v as AIProvider)}
        disabled={disabled}
      >
        <SelectTrigger id="ai-provider">
          <SelectValue placeholder="Select provider" />
        </SelectTrigger>
        <SelectContent>
          {AI_PROVIDERS.map((provider) => (
            <SelectItem key={provider.value} value={provider.value}>
              <div className="flex flex-col">
                <span>{provider.label}</span>
                <span className="text-xs text-muted-foreground">
                  {provider.description}
                </span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

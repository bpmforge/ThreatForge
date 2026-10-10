"use client";

/**
 * AddProviderDialog - Dialog for adding a new AI provider.
 */
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { ProviderDialogFooter } from "./ProviderDialogFooter";
import { useCreateAIProvider } from "../hooks/useAIProviders";
import type { AIProviderType, AIProviderInput } from "../types";
import { AI_PROVIDER_TYPES } from "../types";
import { getErrorMessage } from "@/lib/errors";

interface AddProviderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgId: string;
}

export function AddProviderDialog({
  open,
  onOpenChange,
  orgId,
}: AddProviderDialogProps) {
  const createMutation = useCreateAIProvider(orgId);
  const [formData, setFormData] = useState<AIProviderInput>({
    name: "",
    type: "ANTHROPIC",
    apiKey: "",
    model: "",
    baseUrl: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createMutation.mutateAsync(formData);
      toast.success("Provider added");
      onOpenChange(false);
      setFormData({
        name: "",
        type: "ANTHROPIC",
        apiKey: "",
        model: "",
        baseUrl: "",
      });
    } catch (err) {
      toast.error("Failed to add provider", {
        description: getErrorMessage(err, "Unknown error"),
      });
    }
  };

  const needsApiKey = !["OLLAMA", "LMSTUDIO"].includes(formData.type);
  const needsBaseUrl = [
    "OLLAMA",
    "LMSTUDIO",
    "AZURE_OPENAI",
    "CUSTOM",
  ].includes(formData.type);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add AI Provider</DialogTitle>
          <DialogDescription>
            Configure a new AI provider for your organization.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Display Name</Label>
            <Input
              id="name"
              placeholder="e.g., Production Claude"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="type">Provider Type</Label>
            <Select
              value={formData.type}
              onValueChange={(value: AIProviderType) =>
                setFormData({ ...formData, type: value })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AI_PROVIDER_TYPES.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    <div>
                      <div>{p.label}</div>
                      <div className="text-xs text-muted-foreground">
                        {p.description}
                      </div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {needsApiKey && (
            <div className="space-y-2">
              <Label htmlFor="apiKey">API Key</Label>
              <Input
                id="apiKey"
                type="password"
                placeholder="sk-..."
                value={formData.apiKey || ""}
                onChange={(e) =>
                  setFormData({ ...formData, apiKey: e.target.value })
                }
              />
            </div>
          )}

          {needsBaseUrl && (
            <div className="space-y-2">
              <Label htmlFor="baseUrl">Base URL</Label>
              <Input
                id="baseUrl"
                placeholder={
                  formData.type === "OLLAMA"
                    ? "http://localhost:11434"
                    : formData.type === "LMSTUDIO"
                      ? "http://localhost:1234/v1"
                      : "https://api.example.com"
                }
                value={formData.baseUrl || ""}
                onChange={(e) =>
                  setFormData({ ...formData, baseUrl: e.target.value })
                }
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="model">Model (optional)</Label>
            <Input
              id="model"
              placeholder="e.g., claude-3-5-sonnet-20241022"
              value={formData.model || ""}
              onChange={(e) =>
                setFormData({ ...formData, model: e.target.value })
              }
            />
          </div>

          <ProviderDialogFooter
            onCancel={() => onOpenChange(false)}
            isPending={createMutation.isPending}
            disabled={!formData.name}
            submitLabel="Add Provider"
          />
        </form>
      </DialogContent>
    </Dialog>
  );
}

"use client";

/**
 * EditProviderDialog - Dialog for editing an AI provider.
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
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/errors";
import { ProviderDialogFooter } from "./ProviderDialogFooter";
import { useUpdateAIProvider } from "../hooks/useAIProviders";
import type { AIProviderConfig, AIProviderInput } from "../types";

interface EditProviderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgId: string;
  provider: AIProviderConfig;
}

export function EditProviderDialog({
  open,
  onOpenChange,
  orgId,
  provider,
}: EditProviderDialogProps) {
  const updateMutation = useUpdateAIProvider(orgId);
  const [formData, setFormData] = useState({
    name: provider.name,
    apiKey: "",
    model: provider.model || "",
    baseUrl: provider.baseUrl || "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const data: Partial<AIProviderInput> = {
        name: formData.name,
        model: formData.model || undefined,
        baseUrl: formData.baseUrl || undefined,
      };
      if (formData.apiKey) {
        data.apiKey = formData.apiKey;
      }
      await updateMutation.mutateAsync({ providerId: provider.id, data });
      toast.success("Provider updated");
      onOpenChange(false);
    } catch (err) {
      toast.error("Failed to update provider", {
        description: getErrorMessage(err, "Unknown error"),
      });
    }
  };

  const needsApiKey = !["OLLAMA", "LMSTUDIO"].includes(provider.type);
  const needsBaseUrl = [
    "OLLAMA",
    "LMSTUDIO",
    "AZURE_OPENAI",
    "CUSTOM",
  ].includes(provider.type);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Provider</DialogTitle>
          <DialogDescription>
            Update the configuration for {provider.name}.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-name">Display Name</Label>
            <Input
              id="edit-name"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              required
            />
          </div>

          {needsApiKey && (
            <div className="space-y-2">
              <Label htmlFor="edit-apiKey">API Key</Label>
              <Input
                id="edit-apiKey"
                type="password"
                placeholder={
                  provider.hasApiKey ? "••••••••" : "Enter new API key"
                }
                value={formData.apiKey}
                onChange={(e) =>
                  setFormData({ ...formData, apiKey: e.target.value })
                }
              />
              <p className="text-xs text-muted-foreground">
                Leave blank to keep existing key
              </p>
            </div>
          )}

          {needsBaseUrl && (
            <div className="space-y-2">
              <Label htmlFor="edit-baseUrl">Base URL</Label>
              <Input
                id="edit-baseUrl"
                value={formData.baseUrl}
                onChange={(e) =>
                  setFormData({ ...formData, baseUrl: e.target.value })
                }
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="edit-model">Model</Label>
            <Input
              id="edit-model"
              value={formData.model}
              onChange={(e) =>
                setFormData({ ...formData, model: e.target.value })
              }
            />
          </div>

          <ProviderDialogFooter
            onCancel={() => onOpenChange(false)}
            isPending={updateMutation.isPending}
            disabled={!formData.name}
            submitLabel="Save Changes"
          />
        </form>
      </DialogContent>
    </Dialog>
  );
}

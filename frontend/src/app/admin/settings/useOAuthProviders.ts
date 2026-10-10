"use client";

import { useState, useEffect } from "react";
import {
  type OAuthProviderType,
  type OAuthProviderConfig,
  type CallbackUrlsResponse,
  getOAuthProviders,
  updateOAuthProvider,
  getOAuthCallbackUrls,
} from "@/features/admin/services/api";
import { toast } from "sonner";

export interface ProviderInfo {
  id: OAuthProviderType;
  name: string;
  icon: string;
  docsUrl: string;
  description: string;
}

export const PROVIDERS: ProviderInfo[] = [
  {
    id: "google",
    name: "Google",
    icon: "🔵",
    docsUrl: "https://console.cloud.google.com/apis/credentials",
    description: "Sign in with Google accounts",
  },
  {
    id: "github",
    name: "GitHub",
    icon: "⚫",
    docsUrl: "https://github.com/settings/developers",
    description: "Sign in with GitHub accounts",
  },
  {
    id: "microsoft",
    name: "Microsoft",
    icon: "🟦",
    docsUrl: "https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps",
    description: "Sign in with Microsoft / Azure AD accounts",
  },
  {
    id: "oidc",
    name: "Custom OIDC",
    icon: "🔐",
    docsUrl: "",
    description: "Connect any OpenID Connect provider",
  },
];

const EMPTY_FORM: OAuthProviderConfig = {
  enabled: false,
  clientId: "",
  clientSecret: "",
};

export function useOAuthProviders() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<OAuthProviderType | null>(null);
  const [providers, setProviders] = useState<
    Record<string, OAuthProviderConfig>
  >({});
  const [envProviders, setEnvProviders] = useState<
    Record<string, { enabled: boolean; source: string }>
  >({});
  const [callbackUrls, setCallbackUrls] = useState<CallbackUrlsResponse | null>(
    null,
  );
  const [editingProvider, setEditingProvider] =
    useState<OAuthProviderType | null>(null);
  const [editForm, setEditForm] = useState<OAuthProviderConfig>(EMPTY_FORM);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [providersData, urlsData] = await Promise.all([
        getOAuthProviders(),
        getOAuthCallbackUrls(),
      ]);
      setProviders(providersData.providers);
      setEnvProviders(providersData.envProviders);
      setCallbackUrls(urlsData);
    } catch {
      toast.error("Failed to load OAuth providers");
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (providerId: OAuthProviderType) => {
    const existing = providers[providerId];
    setEditingProvider(providerId);
    setEditForm(existing || EMPTY_FORM);
  };

  const handleSave = async () => {
    if (!editingProvider) return;
    setSaving(editingProvider);
    try {
      const result = await updateOAuthProvider(editingProvider, editForm);
      setProviders((prev) => ({ ...prev, [editingProvider]: result.config }));
      setEditingProvider(null);
      toast.success(
        `${PROVIDERS.find((p) => p.id === editingProvider)?.name} configuration saved`,
      );
    } catch {
      toast.error("Failed to save configuration");
    } finally {
      setSaving(null);
    }
  };

  const handleCancel = () => {
    setEditingProvider(null);
    setEditForm(EMPTY_FORM);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  const getProviderStatus = (
    providerId: OAuthProviderType,
  ): "env" | "database" | "disabled" => {
    if (envProviders[providerId]?.enabled) return "env";
    if (providers[providerId]?.enabled) return "database";
    return "disabled";
  };

  return {
    loading,
    saving,
    providers,
    callbackUrls,
    editingProvider,
    editForm,
    setEditForm,
    handleEdit,
    handleSave,
    handleCancel,
    copyToClipboard,
    getProviderStatus,
  };
}

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiGet, apiPut, apiDelete, apiPost } from "@/lib/api-client";

export type SSOProvider = "SAML" | "OIDC" | "AZURE_AD" | "GOOGLE" | "OKTA";

export interface SSOConfig {
  clientId: string;
  clientSecret: string;
  issuer?: string;
  entryPoint?: string;
  certificate?: string;
  authorizationUrl?: string;
  tokenUrl?: string;
  userinfoUrl?: string;
}

export interface SSOSettingsData {
  enabled: boolean;
  provider: SSOProvider | null;
  domain: string | null;
  enforced: boolean;
  config: Partial<SSOConfig> | null;
}

export interface CallbackUrls {
  saml: string;
  oidc: string;
  acsUrl: string;
  entityId: string;
}

export function useSSOSettings(orgId: string) {
  const queryClient = useQueryClient();
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [provider, setProvider] = useState<SSOProvider>("SAML");
  const [domain, setDomain] = useState("");
  const [enforced, setEnforced] = useState(false);
  const [config, setConfig] = useState<SSOConfig>({
    clientId: "",
    clientSecret: "",
    issuer: "",
    entryPoint: "",
    certificate: "",
  });
  const [hasChanges, setHasChanges] = useState(false);

  const { data: settings, isLoading } = useQuery({
    queryKey: ["sso-settings", orgId],
    queryFn: () => apiGet<SSOSettingsData>(`/api/organizations/${orgId}/sso`),
    enabled: !!orgId,
  });

  const { data: callbackUrls } = useQuery({
    queryKey: ["sso-callback-urls", orgId],
    queryFn: () =>
      apiGet<CallbackUrls>(`/api/organizations/${orgId}/sso/callback-url`),
    enabled: !!orgId,
  });

  useEffect(() => {
    if (settings) {
      setEnabled(settings.enabled);
      setProvider(settings.provider || "SAML");
      setDomain(settings.domain || "");
      setEnforced(settings.enforced);
      setConfig({
        clientId: settings.config?.clientId || "",
        clientSecret: settings.config?.clientSecret || "",
        issuer: settings.config?.issuer || "",
        entryPoint: settings.config?.entryPoint || "",
        certificate: settings.config?.certificate || "",
        authorizationUrl: settings.config?.authorizationUrl || "",
        tokenUrl: settings.config?.tokenUrl || "",
        userinfoUrl: settings.config?.userinfoUrl || "",
      });
    }
  }, [settings]);

  const updateMutation = useMutation({
    mutationFn: (data: Partial<SSOSettingsData> & { config: SSOConfig }) =>
      apiPut(`/api/organizations/${orgId}/sso`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sso-settings", orgId] });
      toast.success("SSO settings updated");
      setHasChanges(false);
    },
    onError: (error: Error) =>
      toast.error("Failed to update SSO", { description: error.message }),
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiDelete(`/api/organizations/${orgId}/sso`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sso-settings", orgId] });
      toast.success("SSO disabled and configuration removed");
      setEnabled(false);
      setHasChanges(false);
    },
    onError: (error: Error) =>
      toast.error("Failed to disable SSO", { description: error.message }),
  });

  const testMutation = useMutation({
    mutationFn: () =>
      apiPost(`/api/organizations/${orgId}/sso/test`) as Promise<{
        valid: boolean;
        message?: string;
        errors?: string[];
      }>,
    onSuccess: (result) => {
      if (result.valid) {
        toast.success("Configuration valid", { description: result.message });
      } else {
        toast.error("Configuration invalid", {
          description: result.errors?.join(", "),
        });
      }
    },
    onError: (error: Error) =>
      toast.error("Test failed", { description: error.message }),
  });

  const handleSave = () =>
    updateMutation.mutate({
      enabled,
      provider,
      domain: domain || undefined,
      enforced,
      config,
    });

  const handleCopy = async (text: string, field: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const updateConfig = (key: keyof SSOConfig, value: string) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const setEnabledWithChange = (v: boolean) => {
    setEnabled(v);
    setHasChanges(true);
  };
  const setProviderWithChange = (v: SSOProvider) => {
    setProvider(v);
    setHasChanges(true);
  };
  const setDomainWithChange = (v: string) => {
    setDomain(v);
    setHasChanges(true);
  };
  const setEnforcedWithChange = (v: boolean) => {
    setEnforced(v);
    setHasChanges(true);
  };

  return {
    settings,
    callbackUrls,
    isLoading,
    enabled,
    provider,
    domain,
    enforced,
    config,
    hasChanges,
    copiedField,
    setEnabled: setEnabledWithChange,
    setProvider: setProviderWithChange,
    setDomain: setDomainWithChange,
    setEnforced: setEnforcedWithChange,
    updateConfig,
    handleSave,
    handleCopy,
    updateMutation,
    deleteMutation,
    testMutation,
  };
}

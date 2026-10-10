/**
 * Admin Settings Hook
 *
 * Manages state and operations for admin settings page.
 */
"use client";

import { useState, useEffect, useCallback } from "react";
import type {
  SystemSettings,
  EmailProvider,
} from "@/features/admin/services/api";
import {
  useSystemSettings,
  useUpdateSystemSettings,
} from "./hooks/useAdminSettingsQuery";

export type MemberRole = "OWNER" | "ADMIN" | "EDITOR" | "VIEWER";

export interface AdminSettings {
  allowSignups: boolean;
  requireEmailVerification: boolean;
  defaultUserRole: MemberRole;
  sessionTimeout: string;
  maxLoginAttempts: string;
  lockoutDurationMinutes: string;
  passwordMinLength: string;
  passwordRequireUppercase: boolean;
  passwordRequireLowercase: boolean;
  passwordRequireNumbers: boolean;
  passwordRequireSpecialChars: boolean;
  mfaRequired: boolean;
  maxProjectsPerOrg: string;
  enableAI: boolean;
  aiProvider: string;
  auditRetentionDays: string;
  samlEnabled: boolean;
  samlJacksonUrl: string;
  samlProductId: string;
  ipAllowlistEnabled: boolean;
  ipAllowlistText: string;
  aiPrivateHostAllowlistText: string;
  aiAllowAllPrivateHosts: boolean;
  aiPrivateHostAllowlistFromEnv: string[];
  aiAllowAllPrivateHostsFromEnv: boolean;
  /** A new NVD API key typed by the admin; empty keeps the current one. */
  nvdApiKeyInput: string;
  /** Remove the stored NVD API key on save. */
  nvdApiKeyClear: boolean;
  nvdApiKeySource: "settings" | "environment" | "none";
  emailProvider: EmailProvider;
  emailFrom: string;
  emailConfig: Record<string, unknown> | null;
}

const defaultSettings: AdminSettings = {
  allowSignups: true,
  requireEmailVerification: true,
  defaultUserRole: "VIEWER",
  sessionTimeout: "24",
  maxLoginAttempts: "5",
  lockoutDurationMinutes: "15",
  passwordMinLength: "12",
  passwordRequireUppercase: true,
  passwordRequireLowercase: true,
  passwordRequireNumbers: true,
  passwordRequireSpecialChars: false,
  mfaRequired: false,
  maxProjectsPerOrg: "100",
  enableAI: true,
  aiProvider: "anthropic",
  auditRetentionDays: "90",
  samlEnabled: false,
  samlJacksonUrl: "",
  samlProductId: "flow-threat-model",
  ipAllowlistEnabled: false,
  ipAllowlistText: "",
  aiPrivateHostAllowlistText: "",
  aiAllowAllPrivateHosts: false,
  aiPrivateHostAllowlistFromEnv: [],
  aiAllowAllPrivateHostsFromEnv: false,
  nvdApiKeyInput: "",
  nvdApiKeyClear: false,
  nvdApiKeySource: "none",
  emailProvider: "none",
  emailFrom: "",
  emailConfig: null,
};

function transformApiToFormSettings(data: SystemSettings): AdminSettings {
  return {
    allowSignups: data.allowSignups,
    requireEmailVerification: data.requireEmailVerification,
    defaultUserRole: data.defaultUserRole,
    sessionTimeout: String(data.sessionTimeoutHours),
    maxLoginAttempts: String(data.maxLoginAttempts ?? 5),
    lockoutDurationMinutes: String(data.lockoutDurationMinutes ?? 15),
    passwordMinLength: String(data.passwordMinLength ?? 12),
    passwordRequireUppercase: data.passwordRequireUppercase ?? true,
    passwordRequireLowercase: data.passwordRequireLowercase ?? true,
    passwordRequireNumbers: data.passwordRequireNumbers ?? true,
    passwordRequireSpecialChars: data.passwordRequireSpecialChars ?? false,
    mfaRequired: data.mfaRequired ?? false,
    maxProjectsPerOrg: String(data.maxProjectsPerOrg),
    enableAI: data.enableAI,
    aiProvider: data.aiProvider,
    auditRetentionDays: String(data.auditRetentionDays),
    samlEnabled: data.samlEnabled ?? false,
    samlJacksonUrl: data.samlJacksonUrl ?? "",
    samlProductId: data.samlProductId ?? "flow-threat-model",
    ipAllowlistEnabled: data.ipAllowlistEnabled ?? false,
    ipAllowlistText: (data.ipAllowlist ?? []).join("\n"),
    aiPrivateHostAllowlistText: (data.aiPrivateHostAllowlist ?? []).join("\n"),
    aiAllowAllPrivateHosts: data.aiAllowAllPrivateHosts ?? false,
    aiPrivateHostAllowlistFromEnv: data.aiPrivateHostAllowlistFromEnv ?? [],
    aiAllowAllPrivateHostsFromEnv: data.aiAllowAllPrivateHostsFromEnv ?? false,
    nvdApiKeyInput: "",
    nvdApiKeyClear: false,
    nvdApiKeySource: data.nvdApiKeySource ?? "none",
    emailProvider: (data.emailProvider as EmailProvider) ?? "none",
    emailFrom: data.emailFrom ?? "",
    emailConfig: data.emailConfig ?? null,
  };
}

function nonEmptyLines(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

/** Send the NVD key only when the admin typed a new one or asked to remove it. */
export function nvdApiKeyPayload(
  settings: Pick<AdminSettings, "nvdApiKeyInput" | "nvdApiKeyClear">,
): Pick<SystemSettings, "nvdApiKey"> {
  if (settings.nvdApiKeyClear) return { nvdApiKey: "" };
  const key = settings.nvdApiKeyInput.trim();
  return key ? { nvdApiKey: key } : {};
}

export function useAdminSettings() {
  const {
    data: apiSettings,
    isLoading,
    error: queryError,
  } = useSystemSettings();
  const updateMutation = useUpdateSystemSettings();

  const [settings, setSettings] = useState<AdminSettings>(defaultSettings);
  const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">(
    "idle",
  );

  // Sync form state when API data loads
  useEffect(() => {
    if (apiSettings) {
      setSettings(transformApiToFormSettings(apiSettings));
    }
  }, [apiSettings]);

  // Track save status from mutation
  useEffect(() => {
    if (updateMutation.isSuccess) {
      setSaveStatus("success");
      const timer = setTimeout(() => setSaveStatus("idle"), 3000);
      return () => clearTimeout(timer);
    }
    if (updateMutation.isError) {
      setSaveStatus("error");
    }
  }, [updateMutation.isSuccess, updateMutation.isError]);

  const handleSave = useCallback(() => {
    const ipAllowlist = nonEmptyLines(settings.ipAllowlistText);

    const payload: Partial<SystemSettings> = {
      allowSignups: settings.allowSignups,
      requireEmailVerification: settings.requireEmailVerification,
      defaultUserRole: settings.defaultUserRole,
      sessionTimeoutHours: parseInt(settings.sessionTimeout) || 24,
      maxLoginAttempts: parseInt(settings.maxLoginAttempts) || 5,
      lockoutDurationMinutes: parseInt(settings.lockoutDurationMinutes) || 15,
      passwordMinLength: parseInt(settings.passwordMinLength) || 12,
      passwordRequireUppercase: settings.passwordRequireUppercase,
      passwordRequireLowercase: settings.passwordRequireLowercase,
      passwordRequireNumbers: settings.passwordRequireNumbers,
      passwordRequireSpecialChars: settings.passwordRequireSpecialChars,
      mfaRequired: settings.mfaRequired,
      maxProjectsPerOrg: parseInt(settings.maxProjectsPerOrg) || 100,
      enableAI: settings.enableAI,
      aiProvider: settings.aiProvider,
      auditRetentionDays: parseInt(settings.auditRetentionDays) || 90,
      samlEnabled: settings.samlEnabled,
      samlJacksonUrl: settings.samlJacksonUrl,
      samlProductId: settings.samlProductId,
      ipAllowlistEnabled: settings.ipAllowlistEnabled,
      ipAllowlist,
      aiPrivateHostAllowlist: nonEmptyLines(
        settings.aiPrivateHostAllowlistText,
      ),
      aiAllowAllPrivateHosts: settings.aiAllowAllPrivateHosts,
      ...nvdApiKeyPayload(settings),
      emailProvider: settings.emailProvider,
      emailFrom: settings.emailFrom,
      emailConfig: settings.emailConfig ?? undefined,
    };

    updateMutation.mutate(payload);
  }, [settings, updateMutation]);

  const updateSettings = useCallback((updates: Partial<AdminSettings>) => {
    setSettings((s) => ({ ...s, ...updates }));
  }, []);

  const handleEmailSettingsChange = useCallback(
    (updates: Partial<SystemSettings>) => {
      setSettings((s) => ({
        ...s,
        emailProvider:
          (updates.emailProvider as EmailProvider) ?? s.emailProvider,
        emailFrom: updates.emailFrom ?? s.emailFrom,
        emailConfig:
          updates.emailConfig !== undefined
            ? (updates.emailConfig as Record<string, unknown> | null)
            : s.emailConfig,
      }));
    },
    [],
  );

  return {
    settings,
    updateSettings,
    isSaving: updateMutation.isPending,
    isLoading,
    saveStatus,
    error: queryError?.message ?? (updateMutation.error?.message || null),
    handleSave,
    handleEmailSettingsChange,
  };
}

"use client";

import { getErrorMessage } from "@/lib/errors";
import { useState } from "react";
import {
  type EmailProvider,
  type SystemSettings,
  testEmailConnection,
  sendTestEmail,
} from "@/features/admin/services/api";

export function useEmailConfig(
  settings: {
    emailProvider: EmailProvider;
    emailFrom: string;
    emailConfig: Record<string, unknown> | null;
  },
  onSettingsChange: (updates: Partial<SystemSettings>) => void,
) {
  const cfg = settings.emailConfig as Record<string, unknown> | null;
  const auth = cfg?.auth as Record<string, unknown> | undefined;

  const [smtpConfig, setSmtpConfig] = useState({
    host: (cfg?.host as string) || "",
    port: (cfg?.port as number) || 587,
    secure: (cfg?.secure as boolean) || false,
    user: (auth?.user as string) || "",
    pass: (auth?.pass as string) || "",
  });

  const [apiKeyConfig, setApiKeyConfig] = useState({
    apiKey: (cfg?.apiKey as string) || "",
  });

  const [sesConfig, setSesConfig] = useState({
    accessKeyId: (cfg?.accessKeyId as string) || "",
    secretAccessKey: (cfg?.secretAccessKey as string) || "",
    region: (cfg?.region as string) || "us-east-1",
  });

  const [testStatus, setTestStatus] = useState<
    "idle" | "testing" | "success" | "error"
  >("idle");
  const [testError, setTestError] = useState<string | null>(null);
  const [testEmailAddress, setTestEmailAddress] = useState("");
  const [sendingTest, setSendingTest] = useState(false);
  const [sendTestStatus, setSendTestStatus] = useState<
    "idle" | "success" | "error"
  >("idle");

  const handleProviderChange = (provider: EmailProvider) => {
    onSettingsChange({ emailProvider: provider });
  };

  const handleFromChange = (from: string) => {
    onSettingsChange({ emailFrom: from });
  };

  const handleSmtpConfigChange = (updates: Partial<typeof smtpConfig>) => {
    const newConfig = { ...smtpConfig, ...updates };
    setSmtpConfig(newConfig);
    onSettingsChange({
      emailConfig: {
        host: newConfig.host,
        port: newConfig.port,
        secure: newConfig.secure,
        auth: { user: newConfig.user, pass: newConfig.pass },
      },
    });
  };

  const handleApiKeyChange = (apiKey: string) => {
    setApiKeyConfig({ apiKey });
    onSettingsChange({ emailConfig: { apiKey } });
  };

  const handleSesConfigChange = (updates: Partial<typeof sesConfig>) => {
    const newConfig = { ...sesConfig, ...updates };
    setSesConfig(newConfig);
    onSettingsChange({ emailConfig: newConfig });
  };

  const handleTestConnection = async () => {
    setTestStatus("testing");
    setTestError(null);
    try {
      const result = await testEmailConnection();
      if (result.success) {
        setTestStatus("success");
      } else {
        setTestStatus("error");
        setTestError(result.error || "Connection test failed");
      }
    } catch (err) {
      setTestStatus("error");
      setTestError(getErrorMessage(err, "Connection test failed"));
    }
  };

  const handleSendTestEmail = async () => {
    if (!testEmailAddress) return;
    setSendingTest(true);
    setSendTestStatus("idle");
    try {
      const result = await sendTestEmail(testEmailAddress);
      if (result.success) {
        setSendTestStatus("success");
        setTimeout(() => setSendTestStatus("idle"), 5000);
      } else {
        setSendTestStatus("error");
      }
    } catch {
      setSendTestStatus("error");
    } finally {
      setSendingTest(false);
    }
  };

  return {
    smtpConfig,
    apiKeyConfig,
    sesConfig,
    testStatus,
    testError,
    testEmailAddress,
    sendingTest,
    sendTestStatus,
    setTestEmailAddress,
    handleProviderChange,
    handleFromChange,
    handleSmtpConfigChange,
    handleApiKeyChange,
    handleSesConfigChange,
    handleTestConnection,
    handleSendTestEmail,
  };
}

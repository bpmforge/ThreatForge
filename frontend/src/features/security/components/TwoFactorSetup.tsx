"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  useTwoFactorStatus,
  useStartSetup,
  useEnableTwoFactor,
  useDisableTwoFactor,
  useRegenerateBackupCodes,
  type SetupData,
} from "../hooks/useTwoFactor";
import { TwoFactorSetupFlow } from "./TwoFactorSetupFlow";
import { BackupCodesDisplay } from "./BackupCodesDisplay";
import { TwoFactorStatusCard } from "./TwoFactorStatusCard";
import { DisableTwoFactorDialog } from "./DisableTwoFactorDialog";
import { RegenerateBackupCodesDialog } from "./RegenerateBackupCodesDialog";

export function TwoFactorSetup() {
  const { data: status, isLoading } = useTwoFactorStatus();
  const startSetup = useStartSetup();
  const enableTwoFactor = useEnableTwoFactor();
  const disableTwoFactor = useDisableTwoFactor();
  const regenerateBackupCodes = useRegenerateBackupCodes();

  const [setupData, setSetupData] = useState<SetupData | null>(null);
  const [verificationCode, setVerificationCode] = useState("");
  const [showDisableDialog, setShowDisableDialog] = useState(false);
  const [disableCode, setDisableCode] = useState("");
  const [disablePassword, setDisablePassword] = useState("");
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [showBackupCodes, setShowBackupCodes] = useState(false);
  const [newBackupCodes, setNewBackupCodes] = useState<string[] | null>(null);
  const [regenerateCode, setRegenerateCode] = useState("");
  const [showRegenerateDialog, setShowRegenerateDialog] = useState(false);

  function handleStartSetup() {
    startSetup.mutate(undefined, {
      onSuccess: (data) => setSetupData(data),
    });
  }

  function handleVerifyAndEnable() {
    if (verificationCode.length !== 6) {
      toast.error("Invalid code", { description: "Enter a 6-digit code" });
      return;
    }
    enableTwoFactor.mutate(
      { code: verificationCode },
      {
        onSuccess: () => {
          setVerificationCode("");
          setShowBackupCodes(true);
        },
      },
    );
  }

  function handleDisable2FA() {
    if (!disableCode) {
      toast.error("Verification code required");
      return;
    }
    disableTwoFactor.mutate(
      { code: disableCode, password: disablePassword || undefined },
      {
        onSuccess: () => {
          setShowDisableDialog(false);
          setDisableCode("");
          setDisablePassword("");
        },
      },
    );
  }

  function handleRegenerateBackupCodes() {
    if (regenerateCode.length !== 6) {
      toast.error("Invalid code", { description: "Enter a 6-digit code" });
      return;
    }
    regenerateBackupCodes.mutate(
      { code: regenerateCode },
      {
        onSuccess: (data) => {
          setNewBackupCodes(data.backupCodes);
          setShowRegenerateDialog(false);
          setRegenerateCode("");
        },
      },
    );
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    setCopiedSecret(true);
    setTimeout(() => setCopiedSecret(false), 2000);
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (showBackupCodes && setupData?.backupCodes) {
    return (
      <BackupCodesDisplay
        codes={setupData.backupCodes}
        isNewCodes={false}
        onDone={() => {
          setShowBackupCodes(false);
          setSetupData(null);
        }}
        onCopy={copyToClipboard}
      />
    );
  }

  if (newBackupCodes) {
    return (
      <BackupCodesDisplay
        codes={newBackupCodes}
        isNewCodes={true}
        onDone={() => setNewBackupCodes(null)}
        onCopy={copyToClipboard}
      />
    );
  }

  if (setupData) {
    return (
      <TwoFactorSetupFlow
        setupData={setupData}
        verificationCode={verificationCode}
        onVerificationCodeChange={setVerificationCode}
        copiedSecret={copiedSecret}
        onCopySecret={copyToClipboard}
        onCancel={() => {
          setSetupData(null);
          setVerificationCode("");
        }}
        onVerify={handleVerifyAndEnable}
        isVerifying={enableTwoFactor.isPending}
      />
    );
  }

  return (
    <>
      <TwoFactorStatusCard
        status={status}
        isStartPending={startSetup.isPending}
        onStartSetup={handleStartSetup}
        onShowDisableDialog={() => setShowDisableDialog(true)}
        onShowRegenerateDialog={() => setShowRegenerateDialog(true)}
      />

      <DisableTwoFactorDialog
        open={showDisableDialog}
        onOpenChange={setShowDisableDialog}
        disableCode={disableCode}
        onDisableCodeChange={setDisableCode}
        disablePassword={disablePassword}
        onDisablePasswordChange={setDisablePassword}
        onDisable={handleDisable2FA}
        isDisabling={disableTwoFactor.isPending}
      />

      <RegenerateBackupCodesDialog
        open={showRegenerateDialog}
        onOpenChange={setShowRegenerateDialog}
        regenerateCode={regenerateCode}
        onRegenerateCodeChange={setRegenerateCode}
        onRegenerate={handleRegenerateBackupCodes}
        isRegenerating={regenerateBackupCodes.isPending}
      />
    </>
  );
}

"use client";

import {
  Shield,
  ShieldCheck,
  ShieldOff,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface TwoFactorStatus {
  enabled: boolean;
  backupCodesRemaining?: number;
}

interface TwoFactorStatusCardProps {
  status: TwoFactorStatus | undefined;
  isStartPending: boolean;
  onStartSetup: () => void;
  onShowDisableDialog: () => void;
  onShowRegenerateDialog: () => void;
}

export function TwoFactorStatusCard({
  status,
  isStartPending,
  onStartSetup,
  onShowDisableDialog,
  onShowRegenerateDialog,
}: TwoFactorStatusCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {status?.enabled ? (
            <ShieldCheck className="h-5 w-5 text-green-600" />
          ) : (
            <ShieldOff className="h-5 w-5 text-muted-foreground" />
          )}
          Two-Factor Authentication
        </CardTitle>
        <CardDescription>
          Add an extra layer of security to your account
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {status?.enabled ? (
          <>
            <Alert>
              <ShieldCheck className="h-4 w-4" />
              <AlertTitle>2FA is enabled</AlertTitle>
              <AlertDescription>
                Your account is protected with two-factor authentication.
                {status.backupCodesRemaining !== undefined && (
                  <span className="block mt-1">
                    Backup codes remaining:{" "}
                    <strong>{status.backupCodesRemaining}</strong>
                  </span>
                )}
              </AlertDescription>
            </Alert>

            <div className="flex gap-2">
              <Button variant="outline" onClick={onShowRegenerateDialog}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Regenerate Backup Codes
              </Button>
              <Button variant="destructive" onClick={onShowDisableDialog}>
                <ShieldOff className="h-4 w-4 mr-2" />
                Disable 2FA
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className="text-muted-foreground">
              Two-factor authentication adds an extra layer of security by
              requiring a code from your authenticator app in addition to your
              password.
            </p>

            <Button onClick={onStartSetup} disabled={isStartPending}>
              {isStartPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              <Shield className="h-4 w-4 mr-2" />
              Set Up 2FA
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}

"use client";

import Image from "next/image";
import { Shield, Loader2, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { SetupData } from "../hooks/useTwoFactor";

interface TwoFactorSetupFlowProps {
  setupData: SetupData;
  verificationCode: string;
  onVerificationCodeChange: (value: string) => void;
  copiedSecret: boolean;
  onCopySecret: (text: string) => void;
  onCancel: () => void;
  onVerify: () => void;
  isVerifying: boolean;
}

export function TwoFactorSetupFlow({
  setupData,
  verificationCode,
  onVerificationCodeChange,
  copiedSecret,
  onCopySecret,
  onCancel,
  onVerify,
  isVerifying,
}: TwoFactorSetupFlowProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Set Up Two-Factor Authentication
        </CardTitle>
        <CardDescription>
          Scan the QR code with your authenticator app
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-col items-center gap-4">
          <div className="p-4 bg-white rounded-lg">
            <Image
              src={setupData.qrCode}
              alt="2FA QR Code"
              width={200}
              height={200}
            />
          </div>

          <div className="text-center">
            <p className="text-sm text-muted-foreground mb-2">
              Or enter this code manually:
            </p>
            <div className="flex items-center gap-2 justify-center">
              <code className="bg-muted px-3 py-1 rounded text-sm font-mono">
                {setupData.secret}
              </code>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onCopySecret(setupData.secret)}
                aria-label="Copy secret"
              >
                {copiedSecret ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Enter the 6-digit code from your app</Label>
          <Input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            placeholder="000000"
            value={verificationCode}
            onChange={(e) =>
              onVerificationCodeChange(e.target.value.replace(/\D/g, ""))
            }
            className="text-center text-2xl tracking-widest font-mono"
          />
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={onCancel} className="flex-1">
            Cancel
          </Button>
          <Button
            onClick={onVerify}
            disabled={verificationCode.length !== 6 || isVerifying}
            className="flex-1"
          >
            {isVerifying && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Verify & Enable
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

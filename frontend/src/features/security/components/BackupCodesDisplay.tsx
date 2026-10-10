"use client";

import { ShieldCheck, Key, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";

interface BackupCodesDisplayProps {
  codes: string[];
  isNewCodes?: boolean;
  onDone: () => void;
  onCopy: (text: string) => void;
}

export function BackupCodesDisplay({
  codes,
  isNewCodes,
  onDone,
  onCopy,
}: BackupCodesDisplayProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-green-600">
          {isNewCodes ? (
            <>
              <Key className="h-5 w-5" />
              New Backup Codes Generated
            </>
          ) : (
            <>
              <ShieldCheck className="h-5 w-5" />
              2FA Enabled - Save Your Backup Codes
            </>
          )}
        </CardTitle>
        <CardDescription>
          {isNewCodes
            ? "Your old codes are now invalid. Save these new codes securely."
            : "Store these codes in a safe place. Each code can only be used once."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isNewCodes && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Important</AlertTitle>
            <AlertDescription>
              These codes will not be shown again. Save them now!
            </AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-2 gap-2 font-mono text-sm bg-muted p-4 rounded-lg">
          {codes.map((code, i) => (
            <div key={i} className="p-2 bg-background rounded">
              {code}
            </div>
          ))}
        </div>

        <Button
          onClick={() => {
            onCopy(codes.join("\n"));
            toast.success("Backup codes copied");
          }}
          variant="outline"
          className="w-full"
        >
          <Copy className="h-4 w-4 mr-2" />
          Copy All Codes
        </Button>

        <Button onClick={onDone} className="w-full">
          {isNewCodes ? "Done" : "I have saved my codes"}
        </Button>
      </CardContent>
    </Card>
  );
}

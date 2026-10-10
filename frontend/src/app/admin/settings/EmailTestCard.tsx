"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle, AlertCircle, Loader2, Send } from "lucide-react";

interface EmailTestCardProps {
  testStatus: "idle" | "testing" | "success" | "error";
  testError: string | null;
  testEmailAddress: string;
  sendingTest: boolean;
  sendTestStatus: "idle" | "success" | "error";
  onTestEmailAddressChange: (v: string) => void;
  onTestConnection: () => void;
  onSendTestEmail: () => void;
}

export function EmailTestCard({
  testStatus,
  testError,
  testEmailAddress,
  sendingTest,
  sendTestStatus,
  onTestEmailAddressChange,
  onTestConnection,
  onSendTestEmail,
}: EmailTestCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Test Email Configuration</CardTitle>
        <CardDescription>
          Verify your email settings are working correctly
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            onClick={onTestConnection}
            disabled={testStatus === "testing"}
          >
            {testStatus === "testing" ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Testing...
              </>
            ) : testStatus === "success" ? (
              <>
                <CheckCircle className="h-4 w-4 mr-2 text-green-600" />
                Connected
              </>
            ) : testStatus === "error" ? (
              <>
                <AlertCircle className="h-4 w-4 mr-2 text-red-600" />
                Failed
              </>
            ) : (
              "Test Connection"
            )}
          </Button>
          {testStatus === "error" && testError && (
            <span className="text-sm text-red-600">{testError}</span>
          )}
        </div>

        <div className="border-t pt-4 space-y-3">
          <Label>Send Test Email</Label>
          <div className="flex items-center gap-2 max-w-md">
            <Input
              type="email"
              placeholder="test@example.com"
              value={testEmailAddress}
              onChange={(e) => onTestEmailAddressChange(e.target.value)}
            />
            <Button
              onClick={onSendTestEmail}
              disabled={sendingTest || !testEmailAddress}
            >
              {sendingTest ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Send
                </>
              )}
            </Button>
          </div>
          {sendTestStatus === "success" && (
            <p className="text-sm text-green-600 flex items-center gap-1">
              <CheckCircle className="h-4 w-4" />
              Test email sent successfully!
            </p>
          )}
          {sendTestStatus === "error" && (
            <p className="text-sm text-red-600 flex items-center gap-1">
              <AlertCircle className="h-4 w-4" />
              Failed to send test email
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

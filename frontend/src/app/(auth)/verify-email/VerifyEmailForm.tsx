"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  CheckCircle,
  Loader2,
  XCircle,
  RefreshCw,
} from "lucide-react";
import { ResendSentView, ResendFormView } from "./VerifyEmailResendView";
import { useVerifyEmail } from "./useVerifyEmail";
import { useResendVerification } from "./useResendVerification";

export function VerifyEmailForm() {
  const v = useVerifyEmail();
  const r = useResendVerification();

  if (v.verifying) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/50 py-12 px-4">
        <div className="max-w-md w-full space-y-8 text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
          <p className="text-muted-foreground">Verifying your email...</p>
        </div>
      </div>
    );
  }

  if (v.success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/50 py-12 px-4">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
              <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
            <h1 className="mt-6 text-2xl font-bold text-foreground">
              {v.alreadyVerified ? "Email already verified" : "Email verified!"}
            </h1>
            <p className="mt-2 text-muted-foreground">
              {v.alreadyVerified
                ? "Your email has already been verified. You can sign in to your account."
                : "Your email has been successfully verified. You can now sign in to your account."}
            </p>
            {v.maskedEmail && (
              <p className="mt-2 text-sm text-muted-foreground">
                Verified: <strong>{v.maskedEmail}</strong>
              </p>
            )}
          </div>
          <Link href="/login" className="block">
            <Button className="w-full">Sign in to your account</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (!v.token) {
    if (r.resendSuccess) {
      return (
        <ResendSentView
          resendEmail={r.resendEmail}
          onTryDifferent={() => {
            r.setResendSuccess(false);
            r.setResendEmail("");
          }}
        />
      );
    }
    return (
      <ResendFormView
        resendEmail={r.resendEmail}
        onResendEmailChange={r.setResendEmail}
        resendLoading={r.resendLoading}
        error={r.error}
        onSubmit={r.handleResend}
      />
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/50 py-12 px-4">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-900">
            <XCircle className="h-8 w-8 text-red-600 dark:text-red-400" />
          </div>
          <h1 className="mt-6 text-2xl font-bold text-foreground">
            Verification failed
          </h1>
          <p className="mt-2 text-muted-foreground">
            {v.error || "This verification link is invalid or has expired."}
          </p>
        </div>
        <div className="space-y-3">
          <Link href="/verify-email" className="block">
            <Button className="w-full gap-2">
              <RefreshCw className="h-4 w-4" />
              Request a new verification link
            </Button>
          </Link>
          <Link href="/login" className="block">
            <Button variant="ghost" className="w-full gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to login
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

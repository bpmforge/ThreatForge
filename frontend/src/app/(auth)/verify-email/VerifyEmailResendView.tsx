"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Loader2, Mail, RefreshCw } from "lucide-react";

interface ResendSentViewProps {
  resendEmail: string;
  onTryDifferent: () => void;
}

export function ResendSentView({
  resendEmail,
  onTryDifferent,
}: ResendSentViewProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/50 py-12 px-4">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
            <Mail className="h-8 w-8 text-green-600 dark:text-green-400" />
          </div>
          <h1 className="mt-6 text-2xl font-bold text-foreground">
            Check your email
          </h1>
          <p className="mt-2 text-muted-foreground">
            If an unverified account exists for <strong>{resendEmail}</strong>,
            you will receive a verification link shortly.
          </p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-start gap-3">
            <Mail className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div className="text-sm text-muted-foreground">
              <p>The email may take a few minutes to arrive.</p>
              <p className="mt-1">
                Be sure to check your spam folder if you don&apos;t see it.
              </p>
            </div>
          </div>
        </div>
        <div className="space-y-3">
          <Button variant="outline" className="w-full" onClick={onTryDifferent}>
            Try a different email
          </Button>
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

interface ResendFormViewProps {
  resendEmail: string;
  onResendEmailChange: (v: string) => void;
  resendLoading: boolean;
  error: string | null;
  onSubmit: (e: React.FormEvent) => void;
}

export function ResendFormView({
  resendEmail,
  onResendEmailChange,
  resendLoading,
  error,
  onSubmit,
}: ResendFormViewProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/50 py-12 px-4">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-foreground">ThreatForge</h1>
          <h2 className="mt-6 text-xl text-muted-foreground">
            Verify your email
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Enter your email address to receive a new verification link.
          </p>
        </div>
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded">
            {error}
          </div>
        )}
        <form className="mt-8 space-y-6" onSubmit={onSubmit}>
          <div>
            <Label htmlFor="email">Email address</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={resendEmail}
              onChange={(e) => onResendEmailChange(e.target.value)}
              placeholder="you@example.com"
              className="mt-1"
            />
          </div>
          <Button type="submit" className="w-full" disabled={resendLoading}>
            {resendLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Resend verification email
              </>
            )}
          </Button>
        </form>
        <div className="text-center">
          <Link
            href="/login"
            className="text-sm text-blue-600 hover:text-blue-500 inline-flex items-center gap-1"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to login
          </Link>
        </div>
      </div>
    </div>
  );
}

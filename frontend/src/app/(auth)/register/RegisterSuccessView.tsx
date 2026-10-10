"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Mail } from "lucide-react";

interface RegisterSuccessViewProps {
  email: string;
}

export function RegisterSuccessView({ email }: RegisterSuccessViewProps) {
  return (
    <main
      className="min-h-screen flex items-center justify-center bg-muted/50 py-12 px-4"
      aria-labelledby="verify-heading"
      role="main"
    >
      <div className="max-w-md w-full space-y-8">
        <header className="text-center">
          <div
            className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900"
            aria-hidden="true"
          >
            <Mail className="h-8 w-8 text-green-600 dark:text-green-400" />
          </div>
          <h1
            id="verify-heading"
            className="mt-6 text-2xl font-bold text-foreground"
          >
            Verify your email
          </h1>
          <p className="mt-2 text-muted-foreground">
            We&apos;ve sent a verification link to <strong>{email}</strong>.
            Please check your email to complete registration.
          </p>
        </header>

        <div
          className="rounded-lg border bg-card p-4"
          role="note"
          aria-label="Email information"
        >
          <div className="flex items-start gap-3">
            <Mail
              className="h-5 w-5 text-muted-foreground mt-0.5"
              aria-hidden="true"
            />
            <div className="text-sm text-muted-foreground">
              <p>The email may take a few minutes to arrive.</p>
              <p className="mt-1">
                Be sure to check your spam folder if you don&apos;t see it.
              </p>
            </div>
          </div>
        </div>

        <nav className="space-y-3" aria-label="Post-registration actions">
          <Link href="/verify-email" className="block">
            <Button variant="outline" className="w-full">
              Didn&apos;t receive an email?
            </Button>
          </Link>
          <Link href="/login" className="block">
            <Button variant="ghost" className="w-full gap-2">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Back to login
            </Button>
          </Link>
        </nav>
      </div>
    </main>
  );
}

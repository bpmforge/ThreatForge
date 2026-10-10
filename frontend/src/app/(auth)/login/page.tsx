"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiGet } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ValueProposition } from "@/components/marketing";
import { LoginForm } from "./LoginForm";

function useSetupCheck() {
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    async function checkSetup() {
      try {
        const status = await apiGet<{
          setupComplete?: boolean;
          backendError?: boolean;
        }>("/api/setup/status", { sameOrigin: true });
        if (!status.setupComplete && !status.backendError) {
          router.replace("/setup");
          return;
        }
      } catch {
        // continue to login
      }
      setIsChecking(false);
    }
    checkSetup();
  }, [router]);

  return isChecking;
}

function LoginFormFallback() {
  return (
    <div className="mt-8 space-y-6">
      <div className="space-y-4">
        <div>
          <Label htmlFor="email-loading">Email address</Label>
          <Input
            id="email-loading"
            type="email"
            placeholder="you@example.com"
            className="mt-1"
            disabled
          />
        </div>
        <div>
          <Label htmlFor="password-loading">Password</Label>
          <Input
            id="password-loading"
            type="password"
            placeholder="Enter your password"
            className="mt-1"
            disabled
          />
        </div>
      </div>
      <Button className="w-full" disabled>
        Loading...
      </Button>
    </div>
  );
}

function LoginPageContent() {
  const isCheckingSetup = useSetupCheck();

  if (isCheckingSetup) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-muted/50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </main>
    );
  }

  return (
    <main
      className="min-h-screen flex items-center justify-center bg-muted/50 py-12 px-4"
      aria-labelledby="login-heading"
    >
      <div className="max-w-md w-full space-y-6">
        <header className="text-center">
          <h1 id="login-heading" className="text-3xl font-bold text-foreground">
            ThreatForge
          </h1>
          <h2 className="mt-2 text-lg text-muted-foreground">
            Sign in to your account
          </h2>
        </header>

        <Suspense fallback={<LoginFormFallback />}>
          <LoginForm />
        </Suspense>

        <footer className="text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{" "}
          <Link
            href="/register"
            className="font-medium text-blue-700 underline underline-offset-2 hover:text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded dark:text-blue-400"
          >
            Create one
          </Link>
        </footer>

        <ValueProposition variant="compact" />
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen flex items-center justify-center bg-muted/50">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
            <p className="mt-4 text-muted-foreground">Loading...</p>
          </div>
        </main>
      }
    >
      <LoginPageContent />
    </Suspense>
  );
}

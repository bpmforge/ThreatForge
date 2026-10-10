"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { RegisterSuccessView } from "./RegisterSuccessView";
import { RegisterFormFields } from "./RegisterFormFields";
import { useRegisterForm } from "./useRegisterForm";

export default function RegisterPage() {
  const f = useRegisterForm();

  if (f.registered) return <RegisterSuccessView email={f.email} />;

  return (
    <main
      className="min-h-screen flex items-center justify-center bg-muted/50 py-12 px-4"
      aria-labelledby="register-heading"
    >
      <div className="max-w-md w-full space-y-8">
        <header className="text-center">
          <h1
            id="register-heading"
            className="text-3xl font-bold text-foreground"
          >
            ThreatForge
          </h1>
          <h2 className="mt-6 text-xl text-muted-foreground">
            Create your account
          </h2>
        </header>

        {f.error && (
          <div
            role="alert"
            aria-live="assertive"
            className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded"
          >
            {f.error}
          </div>
        )}

        <form
          className="mt-8 space-y-6"
          onSubmit={f.handleSubmit}
          aria-label="Registration form"
        >
          <RegisterFormFields form={f} />

          <Button
            type="submit"
            className="w-full"
            disabled={f.loading || !f.isPasswordValid || !f.passwordsMatch}
            aria-busy={f.loading}
            aria-disabled={f.loading || !f.isPasswordValid || !f.passwordsMatch}
          >
            {f.loading ? (
              <>
                <Loader2
                  className="mr-2 h-4 w-4 animate-spin"
                  aria-hidden="true"
                />
                Creating account...
              </>
            ) : (
              "Create account"
            )}
          </Button>
        </form>

        <footer className="mt-6 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link
            href="/login"
            className="text-blue-600 hover:text-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded"
          >
            Sign in
          </Link>
        </footer>
      </div>
    </main>
  );
}

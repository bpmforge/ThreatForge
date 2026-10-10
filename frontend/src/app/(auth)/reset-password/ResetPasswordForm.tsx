"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Loader2, Eye, EyeOff } from "lucide-react";
import { PasswordStrengthChecklist } from "../PasswordStrengthChecklist";
import { InvalidResetView, ResetSuccessView } from "./ResetPasswordStateViews";
import { useResetPassword } from "./useResetPassword";

export function ResetPasswordForm() {
  const h = useResetPassword();

  if (h.validating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/50 py-12 px-4">
        <div className="max-w-md w-full space-y-8 text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
          <p className="text-muted-foreground">Validating reset link...</p>
        </div>
      </div>
    );
  }

  if (!h.token || !h.tokenValid) return <InvalidResetView error={h.error} />;
  if (h.success) return <ResetSuccessView />;

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/50 py-12 px-4">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-foreground">ThreatForge</h1>
          <h2 className="mt-6 text-xl text-muted-foreground">
            Create new password
          </h2>
          {h.maskedEmail && (
            <p className="mt-2 text-sm text-muted-foreground">
              Resetting password for <strong>{h.maskedEmail}</strong>
            </p>
          )}
        </div>

        {h.error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded">
            {h.error}
          </div>
        )}

        <form className="mt-8 space-y-6" onSubmit={h.handleSubmit}>
          <div className="space-y-4">
            <div>
              <Label htmlFor="password">New Password</Label>
              <div className="relative mt-1">
                <Input
                  id="password"
                  name="password"
                  type={h.showPassword ? "text" : "password"}
                  required
                  value={h.password}
                  onChange={(e) => h.setPassword(e.target.value)}
                  placeholder="Enter new password"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => h.setShowPassword(!h.showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={
                    h.showPassword ? "Hide password" : "Show password"
                  }
                >
                  {h.showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              <PasswordStrengthChecklist password={h.password} />
            </div>

            <div>
              <Label htmlFor="confirm-password">Confirm Password</Label>
              <div className="relative mt-1">
                <Input
                  id="confirm-password"
                  name="confirm-password"
                  type={h.showConfirm ? "text" : "password"}
                  required
                  value={h.confirmPassword}
                  onChange={(e) => h.setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => h.setShowConfirm(!h.showConfirm)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={
                    h.showConfirm
                      ? "Hide confirm password"
                      : "Show confirm password"
                  }
                >
                  {h.showConfirm ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              {h.confirmPassword.length > 0 && !h.passwordsMatch && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                  Passwords do not match
                </p>
              )}
            </div>
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={h.loading || !h.isPasswordValid || !h.passwordsMatch}
          >
            {h.loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Resetting...
              </>
            ) : (
              "Reset password"
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

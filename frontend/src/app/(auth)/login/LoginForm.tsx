"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle } from "lucide-react";
import { OAuthProviderButtons } from "./OAuthProviderButtons";
import { EnterpriseSsoSection } from "./EnterpriseSsoSection";

function sanitizeCallbackUrl(url: string): string {
  try {
    const parsed = new URL(url, "http://localhost");
    const pathname = parsed.pathname;
    if (pathname.startsWith("/login") || pathname.startsWith("/register"))
      return "/dashboard";
    return pathname + parsed.search;
  } catch {
    if (
      url.startsWith("/login") ||
      url.startsWith("/register") ||
      url.includes("/login")
    ) {
      return "/dashboard";
    }
    return url;
  }
}

/** Messages for the codes the backend sign-in check returns. */
const SIGN_IN_MESSAGES: Record<string, string> = {
  account_locked: "Too many failed attempts. Try again later.",
  invalid_two_factor_code: "That verification code is not valid.",
  email_unverified:
    "Verify your email address before signing in. Check your inbox for the link.",
  account_disabled: "This account is disabled. Contact your administrator.",
};

/** The `code` query parameter Auth.js adds to a failed sign-in redirect. */
function signInErrorCode(url: string): string | null {
  try {
    return new URL(url).searchParams.get("code");
  } catch {
    return null;
  }
}

export function LoginForm() {
  const searchParams = useSearchParams();
  const callbackUrl = sanitizeCallbackUrl(
    searchParams.get("callbackUrl") || "/",
  );
  const error = searchParams.get("error");
  const justRegistered = searchParams.get("registered") === "true";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [needsCode, setNeedsCode] = useState(false);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setFormError(null);

    try {
      // Raw fetch: NextAuth endpoint (/api/auth/csrf), not the app API.
      const csrfResponse = await fetch("/api/auth/csrf");
      const { csrfToken } = await csrfResponse.json();

      // Raw fetch: NextAuth credentials callback; needs response.url after redirects.
      const response = await fetch("/api/auth/callback/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          csrfToken,
          email,
          password,
          ...(needsCode ? { code } : {}),
          callbackUrl: "/dashboard",
        }),
        credentials: "include",
      });

      const finalUrl = response.url;
      if (response.ok && !finalUrl.includes("/login")) {
        window.location.href = callbackUrl;
        return;
      }
      const errorCode = signInErrorCode(finalUrl);
      if (errorCode === "two_factor_required") {
        setNeedsCode(true);
        setLoading(false);
        return;
      }
      setFormError(
        (errorCode && SIGN_IN_MESSAGES[errorCode]) ||
          "Invalid email or password",
      );
      setLoading(false);
    } catch (err) {
      console.error("SignIn error:", err);
      setFormError("Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  return (
    <>
      {justRegistered && (
        <div
          role="status"
          aria-live="polite"
          className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded flex items-center gap-2"
        >
          <CheckCircle className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
          <span>Registration successful! You can now sign in.</span>
        </div>
      )}
      {(error || formError) && (
        <div
          role="alert"
          aria-live="assertive"
          className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded"
        >
          {formError || "Authentication failed. Please try again."}
        </div>
      )}

      <OAuthProviderButtons callbackUrl={callbackUrl} loading={loading} />

      <form
        className="space-y-6"
        onSubmit={handleSubmit}
        aria-label="Sign in form"
      >
        <div className="space-y-4">
          <div>
            <Label htmlFor="email">Email address</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="mt-1"
            />
          </div>
          <div>
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <Link
                href="/forgot-password"
                className="text-sm text-blue-600 hover:text-blue-500"
              >
                Forgot password?
              </Link>
            </div>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              className="mt-1"
            />
          </div>
          {needsCode && (
            <div>
              <Label htmlFor="code">Verification code</Label>
              <Input
                id="code"
                name="code"
                autoComplete="one-time-code"
                required
                autoFocus
                value={code}
                onChange={(e) => setCode(e.target.value.trim())}
                placeholder="6-digit code or backup code"
                className="mt-1"
              />
            </div>
          )}
        </div>
        <Button
          type="submit"
          className="w-full"
          disabled={loading}
          aria-busy={loading}
        >
          {loading ? "Signing in..." : "Sign in"}
        </Button>
      </form>

      <EnterpriseSsoSection callbackUrl={callbackUrl} loading={loading} />
    </>
  );
}

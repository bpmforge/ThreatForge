"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface EnterpriseSsoSectionProps {
  callbackUrl: string;
  loading: boolean;
}

export function EnterpriseSsoSection({
  callbackUrl,
  loading,
}: EnterpriseSsoSectionProps) {
  const [showSsoForm, setShowSsoForm] = useState(false);
  const [ssoEmail, setSsoEmail] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (process.env.NEXT_PUBLIC_SAML_ENABLED !== "true") return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const domain = ssoEmail.split("@")[1];
    if (!domain) {
      setError("Please enter a valid work email");
      return;
    }
    await signIn("boxyhq-saml", {
      callbackUrl,
      tenant: domain,
      product: "flow-threat-model",
    });
  };

  return (
    <div className="mt-6">
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border" />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-2 bg-muted/50 text-muted-foreground">
            Enterprise SSO
          </span>
        </div>
      </div>

      {showSsoForm ? (
        <form className="mt-6" onSubmit={handleSubmit}>
          {error && (
            <div role="alert" className="mb-3 text-sm text-red-600">
              {error}
            </div>
          )}
          <div className="space-y-4">
            <div>
              <Label htmlFor="sso-email">Work email</Label>
              <Input
                id="sso-email"
                name="sso-email"
                type="email"
                autoComplete="email"
                required
                value={ssoEmail}
                onChange={(e) => setSsoEmail(e.target.value)}
                placeholder="you@company.com"
                className="mt-1"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Enter your corporate email to sign in with SAML SSO
              </p>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <Button type="submit" className="flex-1" disabled={loading}>
              {loading ? "Redirecting..." : "Continue with SSO"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowSsoForm(false)}
              disabled={loading}
            >
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <div className="mt-6">
          <Button
            variant="outline"
            className="w-full"
            onClick={() => setShowSsoForm(true)}
            disabled={loading}
          >
            Sign in with SSO
          </Button>
        </div>
      )}
    </div>
  );
}

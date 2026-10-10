"use client";

/**
 * Complete Step
 * Review and submit setup configuration.
 */
import { getErrorMessage } from "@/lib/errors";
import { setupTokenHeaders, useSetupStore } from "../store";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  CheckCircle,
  Loader2,
  User,
  Building2,
  Brain,
  Shield,
  Key,
  AlertCircle,
} from "lucide-react";
import { apiPost } from "@/lib/api-client";

export function CompleteStep() {
  const {
    admin,
    organization,
    ai,
    auth,
    security,
    isSubmitting,
    submitError,
    submitSuccess,
    setSubmitting,
    setSubmitError,
    setSubmitSuccess,
    prevStep,
    setupToken,
  } = useSetupStore();

  const handleSubmit = async () => {
    setSubmitting(true);
    setSubmitError(null);

    try {
      await apiPost(
        "/api/setup/initialize",
        {
          admin: {
            name: admin.name,
            email: admin.email,
            password: admin.password,
          },
          organization: {
            name: organization.name,
            slug: organization.slug,
          },
          ai: ai.enabled
            ? {
                enabled: true,
                provider: ai.provider,
                apiKey: ai.apiKey || undefined,
                baseUrl: ai.baseUrl || undefined,
                model: ai.model || undefined,
              }
            : { enabled: false, provider: "none" },
          auth: {
            allowSignups: auth.allowSignups,
            requireEmailVerification: auth.requireEmailVerification,
            sessionTimeoutHours: auth.sessionTimeoutHours,
          },
          security: {
            sessionTimeoutHours: auth.sessionTimeoutHours,
            ipAllowlistEnabled: security.ipAllowlistEnabled,
            ipAllowlist: security.ipAllowlistEnabled
              ? security.ipAllowlist
                  .split("\n")
                  .map((ip) => ip.trim())
                  .filter(Boolean)
              : undefined,
            auditRetentionDays: security.auditRetentionDays,
          },
        },
        setupTokenHeaders(setupToken),
      );

      setSubmitSuccess(true);
    } catch (error) {
      setSubmitError(getErrorMessage(error, "Setup failed"));
    } finally {
      setSubmitting(false);
    }
  };

  if (submitSuccess) {
    return (
      <div className="space-y-6 text-center">
        <div className="flex justify-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-green-500/10 ring-2 ring-green-500">
            <CheckCircle className="h-10 w-10 text-green-500" />
          </div>
        </div>
        <div>
          <h2 className="text-2xl font-bold text-foreground">
            Setup Complete!
          </h2>
          <p className="mt-2 text-muted-foreground">
            Your ThreatForge instance is ready to use.
          </p>
        </div>
        <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-4">
          <p className="text-sm text-green-400">
            Redirecting to login page in a few seconds...
          </p>
        </div>
        <div className="text-sm text-muted-foreground">
          <p>Login with your admin account:</p>
          <p className="mt-1 font-mono text-foreground">{admin.email}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">
          Review Configuration
        </h2>
        <p className="mt-1 text-muted-foreground">
          Review your settings before completing setup
        </p>
      </div>

      {/* Summary Cards */}
      <div className="space-y-3">
        {/* Admin Account */}
        <div className="flex items-start gap-3 rounded-lg border border-border bg-card p-4">
          <User className="h-5 w-5 text-blue-500 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-medium text-foreground">Admin Account</h3>
            <div className="mt-1 text-sm text-muted-foreground">
              <p>Name: {admin.name}</p>
              <p>Email: {admin.email}</p>
            </div>
          </div>
          <CheckCircle className="h-5 w-5 text-green-500" />
        </div>

        {/* Organization */}
        <div className="flex items-start gap-3 rounded-lg border border-border bg-card p-4">
          <Building2 className="h-5 w-5 text-blue-500 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-medium text-foreground">Organization</h3>
            <div className="mt-1 text-sm text-muted-foreground">
              <p>Name: {organization.name}</p>
              <p>Slug: {organization.slug}</p>
            </div>
          </div>
          <CheckCircle className="h-5 w-5 text-green-500" />
        </div>

        {/* AI Configuration */}
        <div className="flex items-start gap-3 rounded-lg border border-border bg-card p-4">
          <Brain className="h-5 w-5 text-blue-500 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-medium text-foreground">AI Configuration</h3>
            <div className="mt-1 text-sm text-muted-foreground">
              <p>Status: {ai.enabled ? "Enabled" : "Disabled"}</p>
              {ai.enabled && <p>Provider: {ai.provider}</p>}
            </div>
          </div>
          <CheckCircle className="h-5 w-5 text-green-500" />
        </div>

        {/* Authentication */}
        <div className="flex items-start gap-3 rounded-lg border border-border bg-card p-4">
          <Key className="h-5 w-5 text-blue-500 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-medium text-foreground">Authentication</h3>
            <div className="mt-1 text-sm text-muted-foreground">
              <p>
                Self-registration: {auth.allowSignups ? "Allowed" : "Disabled"}
              </p>
              <p>
                Email verification:{" "}
                {auth.requireEmailVerification ? "Required" : "Optional"}
              </p>
              <p>Session timeout: {auth.sessionTimeoutHours} hours</p>
            </div>
          </div>
          <CheckCircle className="h-5 w-5 text-green-500" />
        </div>

        {/* Security */}
        <div className="flex items-start gap-3 rounded-lg border border-border bg-card p-4">
          <Shield className="h-5 w-5 text-blue-500 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-medium text-foreground">Security</h3>
            <div className="mt-1 text-sm text-muted-foreground">
              <p>
                IP Allowlist:{" "}
                {security.ipAllowlistEnabled ? "Enabled" : "Disabled"}
              </p>
              <p>Audit retention: {security.auditRetentionDays} days</p>
            </div>
          </div>
          <CheckCircle className="h-5 w-5 text-green-500" />
        </div>
      </div>

      {/* Error Message */}
      {submitError && (
        <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-red-400">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <p className="text-sm">{submitError}</p>
        </div>
      )}

      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={prevStep}
          disabled={isSubmitting}
          className="gap-2 border-border"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="gap-2 min-w-[150px]"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Setting up...
            </>
          ) : (
            <>
              <CheckCircle className="h-4 w-4" />
              Complete Setup
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

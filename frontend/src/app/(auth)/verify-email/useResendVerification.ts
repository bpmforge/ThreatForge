"use client";

import { useState } from "react";

import { apiPost, ApiError } from "@/lib/api-client";

export function useResendVerification() {
  const [resendEmail, setResendEmail] = useState("");
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleResend = async (e: React.FormEvent) => {
    e.preventDefault();
    setResendLoading(true);
    setError(null);
    try {
      await apiPost("/api/auth/resend-verification", {
        email: resendEmail,
      });
      setResendSuccess(true);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message || "Failed to resend verification email");
      } else {
        setError("Unable to connect to server. Please try again.");
      }
    } finally {
      setResendLoading(false);
    }
  };

  return {
    resendEmail,
    setResendEmail,
    resendLoading,
    resendSuccess,
    setResendSuccess,
    error,
    handleResend,
  };
}

"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { ApiError, apiPost } from "@/lib/api-client";
import { PASSWORD_CHECKS } from "../PasswordStrengthChecklist";

export function useResetPassword() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [maskedEmail, setMaskedEmail] = useState("");
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function validateToken() {
      if (!token) {
        setValidating(false);
        return;
      }
      try {
        // apiPost unwraps the { data: { valid, email } } success envelope.
        const data = await apiPost<{ valid?: boolean; email?: string }>(
          "/api/auth/verify-reset-token",
          { token },
        );
        if (data.valid) {
          setTokenValid(true);
          setMaskedEmail(data.email || "");
        } else {
          setError("Invalid or expired reset link");
        }
      } catch (err) {
        setError(
          err instanceof ApiError
            ? err.message
            : "Unable to validate reset link. Please try again.",
        );
      } finally {
        setValidating(false);
      }
    }
    validateToken();
  }, [token]);

  const passwordCheckResults = PASSWORD_CHECKS.map((c) => c.check(password));
  const isPasswordValid = passwordCheckResults.every(Boolean);
  const passwordsMatch =
    password === confirmPassword && confirmPassword.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isPasswordValid || !passwordsMatch) return;
    setLoading(true);
    setError(null);
    try {
      await apiPost("/api/auth/reset-password", { token, password });
      setSuccess(true);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(
          (err.details as { message?: string } | undefined)?.message ||
            err.message ||
            "Failed to reset password",
        );
      } else {
        setError("Unable to connect to server. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return {
    token,
    password,
    setPassword,
    confirmPassword,
    setConfirmPassword,
    showPassword,
    setShowPassword,
    showConfirm,
    setShowConfirm,
    loading,
    validating,
    tokenValid,
    maskedEmail,
    success,
    error,
    isPasswordValid,
    passwordsMatch,
    handleSubmit,
  };
}

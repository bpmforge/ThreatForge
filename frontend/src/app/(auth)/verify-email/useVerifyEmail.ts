"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { ApiError, apiPost } from "@/lib/api-client";

export function useVerifyEmail() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [verifying, setVerifying] = useState(true);
  const [success, setSuccess] = useState(false);
  const [alreadyVerified, setAlreadyVerified] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [maskedEmail, setMaskedEmail] = useState("");

  useEffect(() => {
    async function verifyEmail() {
      if (!token) {
        setVerifying(false);
        return;
      }
      try {
        // apiPost unwraps the { data: { valid, email, ... } } success envelope.
        const status = await apiPost<{
          valid?: boolean;
          email?: string;
          alreadyVerified?: boolean;
        }>("/api/auth/verification-status", { token });
        if (!status.valid) {
          setError("Invalid or expired verification link");
          setVerifying(false);
          return;
        }
        setMaskedEmail(status.email || "");
        if (status.alreadyVerified) {
          setAlreadyVerified(true);
          setSuccess(true);
          setVerifying(false);
          return;
        }
        const data = await apiPost<{ alreadyVerified?: boolean }>(
          "/api/auth/verify-email",
          { token },
        );
        setSuccess(true);
        setAlreadyVerified(data?.alreadyVerified || false);
      } catch (err) {
        if (err instanceof ApiError) {
          setError(
            (err.details as { message?: string } | undefined)?.message ||
              err.message ||
              "Verification failed",
          );
        } else {
          setError("Unable to verify email. Please try again.");
        }
      } finally {
        setVerifying(false);
      }
    }
    verifyEmail();
  }, [token]);

  return { token, verifying, success, alreadyVerified, maskedEmail, error };
}

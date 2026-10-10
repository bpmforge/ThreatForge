"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiPost, ApiError } from "@/lib/api-client";
import { PASSWORD_CHECKS } from "../PasswordStrengthChecklist";
import type { ExperienceLevel, UserRole } from "@/features/profile";

export function useRegisterForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [registered, setRegistered] = useState(false);
  const [experienceLevel, setExperienceLevel] = useState<
    ExperienceLevel | undefined
  >();
  const [role, setRole] = useState<UserRole | undefined>();

  const passwordCheckResults = PASSWORD_CHECKS.map((c) => c.check(password));
  const isPasswordValid = passwordCheckResults.every(Boolean);
  const passwordsMatch =
    password === confirmPassword && confirmPassword.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!isPasswordValid) {
      setError("Password does not meet requirements");
      return;
    }
    if (!passwordsMatch) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      const data = await apiPost<{ requiresVerification?: boolean }>(
        "/api/auth/register",
        { name, email, password, experienceLevel, role },
        { sameOrigin: true },
      );
      if (data.requiresVerification === false) {
        router.push("/login?registered=true");
        return;
      }
      setRegistered(true);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message || "Registration failed"
          : "Registration failed. Please try again.",
      );
      setLoading(false);
    }
  };

  return {
    name,
    setName,
    email,
    setEmail,
    password,
    setPassword,
    confirmPassword,
    setConfirmPassword,
    showPassword,
    setShowPassword,
    showConfirm,
    setShowConfirm,
    loading,
    error,
    registered,
    experienceLevel,
    setExperienceLevel,
    role,
    setRole,
    isPasswordValid,
    passwordsMatch,
    handleSubmit,
  };
}

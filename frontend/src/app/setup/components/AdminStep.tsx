"use client";

/**
 * Admin Step
 * Create the super admin account.
 */
import { useEffect, useState } from "react";
import { useSetupStore } from "../store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, ArrowRight, Eye, EyeOff, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

/** Password requirements */
const PASSWORD_MIN_LENGTH = 12;

interface PasswordCheck {
  label: string;
  check: (password: string) => boolean;
}

const passwordChecks: PasswordCheck[] = [
  {
    label: "At least 12 characters",
    check: (p) => p.length >= PASSWORD_MIN_LENGTH,
  },
  { label: "Contains uppercase letter", check: (p) => /[A-Z]/.test(p) },
  { label: "Contains lowercase letter", check: (p) => /[a-z]/.test(p) },
  { label: "Contains number", check: (p) => /\d/.test(p) },
  {
    label: "Contains special character",
    check: (p) => /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(p),
  },
];

export function AdminStep() {
  const { admin, setAdminData, setStepValidation, nextStep, prevStep } =
    useSetupStore();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [touched, setTouched] = useState({
    name: false,
    email: false,
    password: false,
    confirmPassword: false,
  });

  // Validation
  const isNameValid = admin.name.length >= 2;
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(admin.email);
  const passwordCheckResults = passwordChecks.map((c) =>
    c.check(admin.password),
  );
  const isPasswordValid = passwordCheckResults.every(Boolean);
  const isConfirmValid =
    admin.password === admin.confirmPassword &&
    admin.confirmPassword.length > 0;
  const isStepValid =
    isNameValid && isEmailValid && isPasswordValid && isConfirmValid;

  // Update step validation
  useEffect(() => {
    setStepValidation("admin", isStepValid);
  }, [isStepValid, setStepValidation]);

  const handleNext = () => {
    setTouched({
      name: true,
      email: true,
      password: true,
      confirmPassword: true,
    });
    if (isStepValid) {
      nextStep();
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">
          Create Admin Account
        </h2>
        <p className="mt-1 text-muted-foreground">
          This will be the super admin with full system access
        </p>
      </div>

      <div className="space-y-4">
        {/* Name */}
        <div className="space-y-2">
          <Label htmlFor="admin-name" className="text-slate-200">
            Full Name
          </Label>
          <Input
            id="admin-name"
            placeholder="John Doe"
            value={admin.name}
            onChange={(e) => setAdminData({ name: e.target.value })}
            onBlur={() => setTouched((t) => ({ ...t, name: true }))}
            className={cn(
              "bg-background border-border text-foreground placeholder:text-muted-foreground",
              touched.name && !isNameValid && "border-red-500",
            )}
          />
          {touched.name && !isNameValid && (
            <p className="text-sm text-red-400">
              Name must be at least 2 characters
            </p>
          )}
        </div>

        {/* Email */}
        <div className="space-y-2">
          <Label htmlFor="admin-email" className="text-slate-200">
            Email Address
          </Label>
          <Input
            id="admin-email"
            type="email"
            placeholder="admin@company.com"
            value={admin.email}
            onChange={(e) => setAdminData({ email: e.target.value })}
            onBlur={() => setTouched((t) => ({ ...t, email: true }))}
            className={cn(
              "bg-background border-border text-foreground placeholder:text-muted-foreground",
              touched.email && !isEmailValid && "border-red-500",
            )}
          />
          {touched.email && !isEmailValid && (
            <p className="text-sm text-red-400">
              Please enter a valid email address
            </p>
          )}
        </div>

        {/* Password */}
        <div className="space-y-2">
          <Label htmlFor="admin-password" className="text-slate-200">
            Password
          </Label>
          <div className="relative">
            <Input
              id="admin-password"
              type={showPassword ? "text" : "password"}
              placeholder="Enter a strong password"
              value={admin.password}
              onChange={(e) => setAdminData({ password: e.target.value })}
              onBlur={() => setTouched((t) => ({ ...t, password: true }))}
              className="bg-background border-border text-foreground placeholder:text-muted-foreground pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>

          {/* Password requirements checklist */}
          {(touched.password || admin.password.length > 0) && (
            <div className="mt-2 space-y-1">
              {passwordChecks.map((check, index) => (
                <div
                  key={check.label}
                  className={cn(
                    "flex items-center gap-2 text-sm",
                    passwordCheckResults[index]
                      ? "text-green-400"
                      : "text-muted-foreground",
                  )}
                >
                  {passwordCheckResults[index] ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <X className="h-4 w-4" />
                  )}
                  {check.label}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Confirm Password */}
        <div className="space-y-2">
          <Label htmlFor="admin-confirm" className="text-slate-200">
            Confirm Password
          </Label>
          <div className="relative">
            <Input
              id="admin-confirm"
              type={showConfirm ? "text" : "password"}
              placeholder="Confirm your password"
              value={admin.confirmPassword}
              onChange={(e) =>
                setAdminData({ confirmPassword: e.target.value })
              }
              onBlur={() =>
                setTouched((t) => ({ ...t, confirmPassword: true }))
              }
              className={cn(
                "bg-background border-border text-foreground placeholder:text-muted-foreground pr-10",
                touched.confirmPassword && !isConfirmValid && "border-red-500",
              )}
            />
            <button
              type="button"
              onClick={() => setShowConfirm(!showConfirm)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showConfirm ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
          {touched.confirmPassword &&
            !isConfirmValid &&
            admin.confirmPassword.length > 0 && (
              <p className="text-sm text-red-400">Passwords do not match</p>
            )}
        </div>
      </div>

      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={prevStep}
          className="gap-2 border-border"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <Button onClick={handleNext} className="gap-2" disabled={!isStepValid}>
          Continue
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

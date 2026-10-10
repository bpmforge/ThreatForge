"use client";

import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PasswordCheck {
  label: string;
  check: (password: string) => boolean;
}

export const PASSWORD_CHECKS: PasswordCheck[] = [
  { label: "At least 12 characters", check: (p) => p.length >= 12 },
  { label: "Contains uppercase letter", check: (p) => /[A-Z]/.test(p) },
  { label: "Contains lowercase letter", check: (p) => /[a-z]/.test(p) },
  { label: "Contains number", check: (p) => /\d/.test(p) },
  {
    label: "Contains special character",
    check: (p) => /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(p),
  },
];

interface PasswordStrengthChecklistProps {
  password: string;
}

export function PasswordStrengthChecklist({
  password,
}: PasswordStrengthChecklistProps) {
  if (password.length === 0) return null;

  return (
    <div
      className="mt-3 space-y-1"
      role="list"
      aria-label="Password requirements"
      aria-live="polite"
    >
      {PASSWORD_CHECKS.map((check) => {
        const met = check.check(password);
        return (
          <div
            key={check.label}
            role="listitem"
            aria-label={`${check.label}: ${met ? "met" : "not met"}`}
            className={cn(
              "flex items-center gap-2 text-sm",
              met
                ? "text-green-600 dark:text-green-400"
                : "text-muted-foreground",
            )}
          >
            {met ? (
              <Check className="h-4 w-4" aria-hidden="true" />
            ) : (
              <X className="h-4 w-4" aria-hidden="true" />
            )}
            {check.label}
          </div>
        );
      })}
    </div>
  );
}

"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff } from "lucide-react";
import { ExperienceSelector } from "@/features/profile";
import { PasswordStrengthChecklist } from "../PasswordStrengthChecklist";
import type { useRegisterForm } from "./useRegisterForm";

type FormState = ReturnType<typeof useRegisterForm>;

interface RegisterFormFieldsProps {
  form: FormState;
}

export function RegisterFormFields({ form: f }: RegisterFormFieldsProps) {
  return (
    <>
      <div className="space-y-4">
        <div>
          <Label htmlFor="name">Full name</Label>
          <Input
            id="name"
            name="name"
            type="text"
            autoComplete="name"
            required
            value={f.name}
            onChange={(e) => f.setName(e.target.value)}
            placeholder="John Doe"
            className="mt-1"
          />
        </div>

        <div>
          <Label htmlFor="email">Email address</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={f.email}
            onChange={(e) => f.setEmail(e.target.value)}
            placeholder="you@example.com"
            className="mt-1"
          />
        </div>

        <div>
          <Label htmlFor="password">Password</Label>
          <div className="relative mt-1">
            <Input
              id="password"
              name="password"
              type={f.showPassword ? "text" : "password"}
              autoComplete="new-password"
              required
              value={f.password}
              onChange={(e) => f.setPassword(e.target.value)}
              placeholder="Create a strong password"
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => f.setShowPassword(!f.showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
              aria-label={f.showPassword ? "Hide password" : "Show password"}
              aria-pressed={f.showPassword}
            >
              {f.showPassword ? (
                <EyeOff className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Eye className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
          </div>
          <PasswordStrengthChecklist password={f.password} />
        </div>

        <div>
          <Label htmlFor="confirmPassword">Confirm password</Label>
          <div className="relative mt-1">
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type={f.showConfirm ? "text" : "password"}
              autoComplete="new-password"
              required
              value={f.confirmPassword}
              onChange={(e) => f.setConfirmPassword(e.target.value)}
              placeholder="Confirm your password"
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => f.setShowConfirm(!f.showConfirm)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
              aria-label={
                f.showConfirm
                  ? "Hide confirm password"
                  : "Show confirm password"
              }
              aria-pressed={f.showConfirm}
            >
              {f.showConfirm ? (
                <EyeOff className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Eye className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
          </div>
          {f.confirmPassword.length > 0 && !f.passwordsMatch && (
            <p
              className="mt-1 text-sm text-red-600 dark:text-red-400"
              role="alert"
            >
              Passwords do not match
            </p>
          )}
        </div>
      </div>

      <ExperienceSelector
        experienceLevel={f.experienceLevel}
        role={f.role}
        onExperienceChange={f.setExperienceLevel}
        onRoleChange={f.setRole}
      />
    </>
  );
}

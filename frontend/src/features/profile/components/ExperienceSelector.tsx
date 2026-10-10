"use client";

import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ExperienceLevel, UserRole } from "../types";
import { EXPERIENCE_OPTIONS, ROLE_OPTIONS } from "../types";

interface ExperienceSelectorProps {
  experienceLevel: ExperienceLevel | undefined;
  role: UserRole | undefined;
  onExperienceChange: (value: ExperienceLevel | undefined) => void;
  onRoleChange: (value: UserRole | undefined) => void;
}

export function ExperienceSelector({
  experienceLevel,
  role,
  onExperienceChange,
  onRoleChange,
}: ExperienceSelectorProps) {
  return (
    <div className="space-y-4 p-4 rounded-lg border bg-muted/30">
      <div>
        <p className="text-sm font-medium">
          Help us personalize your experience{" "}
          <span className="text-muted-foreground font-normal">(optional)</span>
        </p>
      </div>

      <div className="space-y-3">
        <Label>How familiar are you with threat modeling?</Label>
        <RadioGroup
          value={experienceLevel}
          onValueChange={(v) => onExperienceChange(v as ExperienceLevel)}
          className="space-y-2"
        >
          {EXPERIENCE_OPTIONS.map((option) => (
            <label
              key={option.value}
              className="flex items-start gap-3 cursor-pointer"
            >
              <RadioGroupItem value={option.value} className="mt-0.5" />
              <div>
                <span className="text-sm font-medium">{option.label}</span>
                <p className="text-xs text-muted-foreground">
                  {option.description}
                </p>
              </div>
            </label>
          ))}
        </RadioGroup>
      </div>

      <div className="space-y-2">
        <Label htmlFor="role-select">What&apos;s your primary role?</Label>
        <Select value={role} onValueChange={(v) => onRoleChange(v as UserRole)}>
          <SelectTrigger id="role-select">
            <SelectValue placeholder="Select your role" />
          </SelectTrigger>
          <SelectContent>
            {ROLE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

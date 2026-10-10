"use client";

/**
 * Preferences Tab
 *
 * Experience level and role preferences.
 */
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ExperienceSelector } from "@/features/profile";
import type { ExperienceLevel, UserRole } from "@/features/profile";

interface PreferencesTabProps {
  experienceLevel: ExperienceLevel;
  onExperienceLevelChange: (level: ExperienceLevel) => void;
  role: UserRole;
  onRoleChange: (role: UserRole) => void;
  isSaving: boolean;
  onSave: () => void;
}

export function PreferencesTab({
  experienceLevel,
  onExperienceLevelChange,
  role,
  onRoleChange,
  isSaving,
  onSave,
}: PreferencesTabProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Experience & Role</CardTitle>
        <CardDescription>
          Help us personalize your experience based on your expertise and role.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <ExperienceSelector
          experienceLevel={experienceLevel}
          role={role}
          onExperienceChange={(level) =>
            onExperienceLevelChange(level as ExperienceLevel)
          }
          onRoleChange={(r) => onRoleChange(r as UserRole)}
        />

        <Separator />

        <div className="flex justify-end">
          <Button onClick={onSave} disabled={isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Preferences
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

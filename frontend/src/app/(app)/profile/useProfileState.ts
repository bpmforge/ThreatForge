"use client";

/**
 * Profile State Hook
 *
 * Manages state and API operations for the profile page.
 */
import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import type { ExperienceLevel, UserRole } from "@/features/profile";
import {
  useUserProfile,
  useUpdateProfile,
  useChangePassword,
  useUpdatePreferences,
} from "./hooks/useProfile";

export type { UserProfile } from "./hooks/useProfile";

export function useProfileState() {
  const { data: session } = useSession();

  // TanStack Query hooks
  const { data: profile, isLoading: isLoadingProfile } = useUserProfile(
    !!session?.user,
  );
  const updateProfile = useUpdateProfile();
  const changePassword = useChangePassword();
  const updatePreferences = useUpdatePreferences();

  // Form state - local only
  const [name, setName] = useState("");

  // Password form state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  // Notification preferences - local form state
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [modelUpdates, setModelUpdates] = useState(true);
  const [threatAlerts, setThreatAlerts] = useState(true);

  // Experience preferences - local form state
  const [experienceLevel, setExperienceLevel] =
    useState<ExperienceLevel>("intermediate");
  const [role, setRole] = useState<UserRole>("developer");

  // AI Writing Style preferences - separate for threats and mitigations
  const [threatStyleEnabled, setThreatStyleEnabled] = useState(false);
  const [threatStyleTone, setThreatStyleTone] = useState("formal");
  const [threatStyleExamples, setThreatStyleExamples] = useState("");
  const [mitigationStyleEnabled, setMitigationStyleEnabled] = useState(false);
  const [mitigationStyleTone, setMitigationStyleTone] = useState("formal");
  const [mitigationStyleExamples, setMitigationStyleExamples] = useState("");

  // Sync form state when profile loads
  useEffect(() => {
    if (profile) {
      setName(profile.name);
      if (profile.preferences?.notifications) {
        setEmailNotifications(profile.preferences.notifications.email ?? true);
        setModelUpdates(profile.preferences.notifications.modelUpdates ?? true);
        setThreatAlerts(profile.preferences.notifications.threatAlerts ?? true);
      }
      if (profile.preferences?.experience) {
        setExperienceLevel(
          (profile.preferences.experience.level as ExperienceLevel) ??
            "intermediate",
        );
        setRole(
          (profile.preferences.experience.role as UserRole) ?? "developer",
        );
      }
      if (profile.preferences?.aiWritingStyle) {
        const s = profile.preferences.aiWritingStyle;
        // Support both old (single) and new (separate) formats
        if (s.threats) {
          setThreatStyleEnabled(s.threats.enabled ?? false);
          setThreatStyleTone(s.threats.tone ?? "formal");
          setThreatStyleExamples(s.threats.examples ?? "");
        } else if (s.enabled) {
          setThreatStyleEnabled(s.enabled);
          setThreatStyleTone(s.tone ?? "formal");
          setThreatStyleExamples(s.examples ?? "");
        }
        if (s.mitigations) {
          setMitigationStyleEnabled(s.mitigations.enabled ?? false);
          setMitigationStyleTone(s.mitigations.tone ?? "formal");
          setMitigationStyleExamples(s.mitigations.examples ?? "");
        }
      }
    }
  }, [profile]);

  // Save profile
  const handleSaveProfile = useCallback(() => {
    updateProfile.mutate({ name });
  }, [name, updateProfile]);

  // Change password
  const handleChangePassword = useCallback(() => {
    if (newPassword !== confirmPassword) {
      toast.error("Error", { description: "New passwords do not match" });
      return;
    }

    if (newPassword.length < 12) {
      toast.error("Error", {
        description: "Password must be at least 12 characters",
      });
      return;
    }

    changePassword.mutate(
      { currentPassword, newPassword },
      {
        onSuccess: () => {
          setCurrentPassword("");
          setNewPassword("");
          setConfirmPassword("");
        },
      },
    );
  }, [currentPassword, newPassword, confirmPassword, changePassword]);

  // Save notification preferences
  const handleSaveNotifications = useCallback(() => {
    updatePreferences.mutate({
      notifications: { email: emailNotifications, modelUpdates, threatAlerts },
    });
  }, [emailNotifications, modelUpdates, threatAlerts, updatePreferences]);

  // Save experience preferences
  const handleSaveExperience = useCallback(() => {
    updatePreferences.mutate({
      experience: { level: experienceLevel, role },
    });
  }, [experienceLevel, role, updatePreferences]);

  // Save AI writing style preferences
  const handleSaveAiStyle = useCallback(() => {
    updatePreferences.mutate({
      aiWritingStyle: {
        threats: {
          enabled: threatStyleEnabled,
          tone: threatStyleTone,
          examples: threatStyleExamples,
        },
        mitigations: {
          enabled: mitigationStyleEnabled,
          tone: mitigationStyleTone,
          examples: mitigationStyleExamples,
        },
      },
    });
  }, [
    threatStyleEnabled,
    threatStyleTone,
    threatStyleExamples,
    mitigationStyleEnabled,
    mitigationStyleTone,
    mitigationStyleExamples,
    updatePreferences,
  ]);

  return {
    // Profile
    profile: profile ?? null,
    name,
    setName,
    isLoadingProfile,
    isSavingProfile: updateProfile.isPending,
    handleSaveProfile,

    // Password
    currentPassword,
    setCurrentPassword,
    newPassword,
    setNewPassword,
    confirmPassword,
    setConfirmPassword,
    showCurrentPassword,
    setShowCurrentPassword,
    showNewPassword,
    setShowNewPassword,
    isChangingPassword: changePassword.isPending,
    handleChangePassword,

    // Notifications
    emailNotifications,
    setEmailNotifications,
    modelUpdates,
    setModelUpdates,
    threatAlerts,
    setThreatAlerts,
    handleSaveNotifications,

    // Experience
    experienceLevel,
    setExperienceLevel,
    role,
    setRole,
    isSavingPreferences: updatePreferences.isPending,
    handleSaveExperience,

    // AI Writing Style
    threatStyleEnabled,
    setThreatStyleEnabled,
    threatStyleTone,
    setThreatStyleTone,
    threatStyleExamples,
    setThreatStyleExamples,
    mitigationStyleEnabled,
    setMitigationStyleEnabled,
    mitigationStyleTone,
    setMitigationStyleTone,
    mitigationStyleExamples,
    setMitigationStyleExamples,
    isSavingAiStyle: updatePreferences.isPending,
    handleSaveAiStyle,
  };
}

/**
 * TanStack Query hooks for Profile Management
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiGet, apiPost, apiPatch } from "@/lib/api-client";
import { signOut } from "next-auth/react";

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  isSuperAdmin: boolean;
  preferences?: {
    notifications?: {
      email?: boolean;
      modelUpdates?: boolean;
      threatAlerts?: boolean;
    };
    experience?: {
      level?: string;
      role?: string;
    };
    aiWritingStyle?: {
      enabled?: boolean;
      tone?: string;
      examples?: string;
      threats?: { enabled?: boolean; tone?: string; examples?: string };
      mitigations?: { enabled?: boolean; tone?: string; examples?: string };
    };
  };
}

interface StyleConfig {
  enabled?: boolean;
  tone?: string;
  examples?: string;
}

interface UpdateProfileData {
  name: string;
}

interface ChangePasswordData {
  currentPassword: string;
  newPassword: string;
}

interface UpdatePreferencesData {
  notifications?: {
    email?: boolean;
    modelUpdates?: boolean;
    threatAlerts?: boolean;
  };
  experience?: {
    level?: string;
    role?: string;
  };
  aiWritingStyle?: {
    threats?: StyleConfig;
    mitigations?: StyleConfig;
  };
}

const QUERY_KEYS = {
  profile: ["userProfile"] as const,
};

export function useUserProfile(enabled = true) {
  return useQuery({
    queryKey: QUERY_KEYS.profile,
    queryFn: () => apiGet<UserProfile>(`/api/users/me`),
    enabled,
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpdateProfileData) =>
      apiPatch<UserProfile>(`/api/users/me`, data),
    onSuccess: (updatedProfile) => {
      queryClient.setQueryData<UserProfile>(QUERY_KEYS.profile, (old) =>
        old ? { ...old, name: updatedProfile.name } : updatedProfile,
      );
      toast.success("Profile updated", {
        description: "Your profile has been saved successfully.",
      });
    },
    onError: (error: Error) => {
      toast.error("Error", {
        description: error.message || "Failed to update profile",
      });
    },
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (data: ChangePasswordData) =>
      apiPost<void>(`/api/users/me/password`, data),
    onSuccess: () => {
      // The server ends every session on a password change, this one too.
      toast.success("Password changed", {
        description: "Please sign in with your new password.",
      });
      void signOut({ callbackUrl: "/login" });
    },
    onError: (error: Error) => {
      toast.error("Error", {
        description: error.message || "Failed to change password",
      });
    },
  });
}

export function useUpdatePreferences() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpdatePreferencesData) =>
      apiPatch<void>(`/api/users/me/preferences`, data),
    onSuccess: (_, variables) => {
      // Update cache with new preferences
      queryClient.setQueryData<UserProfile>(QUERY_KEYS.profile, (old) =>
        old
          ? {
              ...old,
              preferences: {
                ...old.preferences,
                ...variables,
              },
            }
          : old,
      );
      toast.success("Preferences saved", {
        description: "Your preferences have been updated.",
      });
    },
    onError: () => {
      toast.error("Error", { description: "Failed to save preferences" });
    },
  });
}

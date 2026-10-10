"use client";

/**
 * Profile Page
 *
 * User profile settings and preferences.
 * Accessible to ALL authenticated users.
 *
 * Contains:
 * - Profile information (name, email)
 * - Password management
 * - Security (2FA, sign out everywhere, API tokens)
 * - Notification preferences
 * - Appearance/Theme settings
 * - Experience preferences
 */
import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  User,
  Bell,
  Palette,
  Shield,
  Settings2,
  ShieldAlert,
  Sparkles,
  Loader2,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AppHeader, type BreadcrumbItem } from "@/components/layout";
import {
  TwoFactorSetup,
  SessionManager,
  ApiTokenManager,
  DataPrivacy,
} from "@/features/security";
import { useProfileState } from "./useProfileState";
import { ProfileTab } from "./ProfileTab";
import { NotificationsTab } from "./NotificationsTab";
import { AppearanceTab } from "./AppearanceTab";
import { PreferencesTab } from "./PreferencesTab";
import { AIWritingStyleTab } from "./AIWritingStyleTab";

function ProfilePageContent() {
  const breadcrumbs: BreadcrumbItem[] = [{ label: "Profile" }];
  const searchParams = useSearchParams();

  // URL params for tab selection and MFA requirement alert
  const tabParam = searchParams.get("tab");
  const mfaRequired = searchParams.get("mfa") === "required";

  // Tab state - defaults to 'profile' or URL param
  const [activeTab, setActiveTab] = useState(tabParam || "profile");

  // Update tab when URL param changes
  useEffect(() => {
    if (tabParam) {
      setActiveTab(tabParam);
    }
  }, [tabParam]);

  // All profile state and handlers from custom hook
  const state = useProfileState();

  return (
    <>
      <AppHeader breadcrumbs={breadcrumbs} />

      <main className="flex-1 overflow-y-auto">
        <div className="p-6 space-y-6 max-w-4xl">
          {/* Page Header */}
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              Profile Settings
            </h1>
            <p className="text-muted-foreground">
              Manage your personal account settings and preferences.
            </p>
          </div>

          {/* MFA Required Alert */}
          {mfaRequired && (
            <div className="rounded-lg bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 p-4">
              <div className="flex items-start gap-3">
                <ShieldAlert className="h-5 w-5 text-amber-600 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                    Two-Factor Authentication Required
                  </p>
                  <p className="text-sm text-amber-700 dark:text-amber-300">
                    Your organization requires two-factor authentication. Please
                    set up 2FA below to continue using the application.
                  </p>
                </div>
              </div>
            </div>
          )}

          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="space-y-6"
          >
            <TabsList>
              <TabsTrigger value="profile" className="gap-2">
                <User className="size-4" />
                Profile
              </TabsTrigger>
              <TabsTrigger value="security" className="gap-2">
                <Shield className="size-4" />
                Security
              </TabsTrigger>
              <TabsTrigger value="notifications" className="gap-2">
                <Bell className="size-4" />
                Notifications
              </TabsTrigger>
              <TabsTrigger value="appearance" className="gap-2">
                <Palette className="size-4" />
                Appearance
              </TabsTrigger>
              <TabsTrigger value="preferences" className="gap-2">
                <Settings2 className="size-4" />
                Preferences
              </TabsTrigger>
              <TabsTrigger value="ai-style" className="gap-2">
                <Sparkles className="size-4" />
                AI Style
              </TabsTrigger>
            </TabsList>

            {/* Profile Tab */}
            <TabsContent value="profile">
              <ProfileTab
                profile={state.profile}
                name={state.name}
                onNameChange={state.setName}
                isLoadingProfile={state.isLoadingProfile}
                isSavingProfile={state.isSavingProfile}
                onSaveProfile={state.handleSaveProfile}
                currentPassword={state.currentPassword}
                onCurrentPasswordChange={state.setCurrentPassword}
                newPassword={state.newPassword}
                onNewPasswordChange={state.setNewPassword}
                confirmPassword={state.confirmPassword}
                onConfirmPasswordChange={state.setConfirmPassword}
                showCurrentPassword={state.showCurrentPassword}
                onToggleShowCurrentPassword={() =>
                  state.setShowCurrentPassword(!state.showCurrentPassword)
                }
                showNewPassword={state.showNewPassword}
                onToggleShowNewPassword={() =>
                  state.setShowNewPassword(!state.showNewPassword)
                }
                isChangingPassword={state.isChangingPassword}
                onChangePassword={state.handleChangePassword}
              />
            </TabsContent>

            {/* Security Tab */}
            <TabsContent value="security" className="space-y-6">
              <TwoFactorSetup />
              <SessionManager />
              <ApiTokenManager />
              <DataPrivacy />
            </TabsContent>

            {/* Notifications Tab */}
            <TabsContent value="notifications">
              <NotificationsTab
                emailNotifications={state.emailNotifications}
                onEmailNotificationsChange={state.setEmailNotifications}
                modelUpdates={state.modelUpdates}
                onModelUpdatesChange={state.setModelUpdates}
                threatAlerts={state.threatAlerts}
                onThreatAlertsChange={state.setThreatAlerts}
                onSave={state.handleSaveNotifications}
              />
            </TabsContent>

            {/* Appearance Tab */}
            <TabsContent value="appearance">
              <AppearanceTab />
            </TabsContent>

            {/* Preferences Tab */}
            <TabsContent value="preferences">
              <PreferencesTab
                experienceLevel={state.experienceLevel}
                onExperienceLevelChange={state.setExperienceLevel}
                role={state.role}
                onRoleChange={state.setRole}
                isSaving={state.isSavingPreferences}
                onSave={state.handleSaveExperience}
              />
            </TabsContent>

            {/* AI Writing Style Tab */}
            <TabsContent value="ai-style">
              <AIWritingStyleTab
                threatStyleEnabled={state.threatStyleEnabled}
                onThreatStyleEnabledChange={state.setThreatStyleEnabled}
                threatStyleTone={state.threatStyleTone}
                onThreatStyleToneChange={state.setThreatStyleTone}
                threatStyleExamples={state.threatStyleExamples}
                onThreatStyleExamplesChange={state.setThreatStyleExamples}
                mitigationStyleEnabled={state.mitigationStyleEnabled}
                onMitigationStyleEnabledChange={state.setMitigationStyleEnabled}
                mitigationStyleTone={state.mitigationStyleTone}
                onMitigationStyleToneChange={state.setMitigationStyleTone}
                mitigationStyleExamples={state.mitigationStyleExamples}
                onMitigationStyleExamplesChange={
                  state.setMitigationStyleExamples
                }
                isSaving={state.isSavingAiStyle}
                onSave={state.handleSaveAiStyle}
              />
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </>
  );
}

export default function ProfilePage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <ProfilePageContent />
    </Suspense>
  );
}

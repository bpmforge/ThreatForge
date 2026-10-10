/**
 * Admin Settings Page
 *
 * System-wide settings and configuration with tabs for different categories.
 */
"use client";

import { Button } from "@/components/ui/button";
import {
  Save,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Settings,
  Mail,
  KeyRound,
  Shield,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAdminSettings } from "./useAdminSettings";
import { GeneralTab } from "./GeneralTab";
import { SecurityTab } from "./SecurityTab";
import { EmailConfigTab } from "./EmailConfigTab";
import { OAuthProvidersTab } from "./OAuthProvidersTab";

export default function AdminSettingsPage() {
  const {
    settings,
    updateSettings,
    isSaving,
    isLoading,
    saveStatus,
    error,
    handleSave,
    handleEmailSettingsChange,
  } = useAdminSettings();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Settings</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Configure system-wide settings
          </p>
        </div>
        <div className="flex items-center gap-3">
          {saveStatus === "success" && (
            <span className="flex items-center text-sm text-green-600">
              <CheckCircle className="h-4 w-4 mr-1" />
              Saved
            </span>
          )}
          {saveStatus === "error" && (
            <span className="flex items-center text-sm text-red-600">
              <AlertCircle className="h-4 w-4 mr-1" />
              {error || "Save failed"}
            </span>
          )}
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </div>

      {error && saveStatus !== "error" && (
        <div className="rounded-md bg-yellow-50 p-4">
          <p className="text-sm text-yellow-700">{error}</p>
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="general" className="space-y-6">
        <TabsList>
          <TabsTrigger value="general" className="gap-2">
            <Settings className="h-4 w-4" />
            General
          </TabsTrigger>
          <TabsTrigger value="email" className="gap-2">
            <Mail className="h-4 w-4" />
            Email
          </TabsTrigger>
          <TabsTrigger value="oauth" className="gap-2">
            <KeyRound className="h-4 w-4" />
            OAuth Providers
          </TabsTrigger>
          <TabsTrigger value="security" className="gap-2">
            <Shield className="h-4 w-4" />
            Security
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <GeneralTab settings={settings} onUpdate={updateSettings} />
        </TabsContent>

        <TabsContent value="email">
          <EmailConfigTab
            settings={{
              emailProvider: settings.emailProvider,
              emailFrom: settings.emailFrom,
              emailConfig: settings.emailConfig,
            }}
            onSettingsChange={handleEmailSettingsChange}
          />
        </TabsContent>

        <TabsContent value="oauth">
          <OAuthProvidersTab />
        </TabsContent>

        <TabsContent value="security">
          <SecurityTab settings={settings} onUpdate={updateSettings} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

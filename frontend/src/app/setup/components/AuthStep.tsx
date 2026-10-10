"use client";

/**
 * Auth Step
 * Configure authentication settings.
 */
import { useSetupStore } from "../store";
import { NumericOptionSelect, StepNavigation } from "./StepControls";
import { Switch } from "@/components/ui/switch";
import { UserPlus, Mail, Clock } from "lucide-react";

const sessionTimeoutOptions = [
  { value: 1, label: "1 hour" },
  { value: 4, label: "4 hours" },
  { value: 8, label: "8 hours" },
  { value: 24, label: "24 hours" },
  { value: 72, label: "3 days" },
  { value: 168, label: "1 week" },
];

export function AuthStep() {
  const { auth, setAuthConfigData } = useSetupStore();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">
          Authentication Settings
        </h2>
        <p className="mt-1 text-muted-foreground">
          Configure how users sign up and authenticate
        </p>
      </div>

      <div className="space-y-4">
        {/* Allow Signups */}
        <div className="flex items-center justify-between rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-3">
            <UserPlus className="h-5 w-5 text-blue-500" />
            <div>
              <h3 className="font-medium text-foreground">
                Allow Self-Registration
              </h3>
              <p className="text-sm text-muted-foreground">
                Users can create accounts without admin invitation
              </p>
            </div>
          </div>
          <Switch
            checked={auth.allowSignups}
            onCheckedChange={(allowSignups) =>
              setAuthConfigData({ allowSignups })
            }
          />
        </div>

        {/* Email Verification */}
        <div className="flex items-center justify-between rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-3">
            <Mail className="h-5 w-5 text-blue-500" />
            <div>
              <h3 className="font-medium text-foreground">
                Require Email Verification
              </h3>
              <p className="text-sm text-muted-foreground">
                Users must verify email before accessing the app
              </p>
            </div>
          </div>
          <Switch
            checked={auth.requireEmailVerification}
            onCheckedChange={(requireEmailVerification) =>
              setAuthConfigData({ requireEmailVerification })
            }
          />
        </div>

        {/* Session Timeout */}
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-3 mb-3">
            <Clock className="h-5 w-5 text-blue-500" />
            <div>
              <h3 className="font-medium text-foreground">Session Timeout</h3>
              <p className="text-sm text-muted-foreground">
                How long before users are automatically logged out
              </p>
            </div>
          </div>
          <NumericOptionSelect
            value={auth.sessionTimeoutHours}
            options={sessionTimeoutOptions}
            onChange={(sessionTimeoutHours) =>
              setAuthConfigData({ sessionTimeoutHours })
            }
          />
        </div>
      </div>

      <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 p-4">
        <h3 className="font-medium text-blue-400">OAuth & SSO</h3>
        <p className="text-sm text-muted-foreground mt-1">
          OAuth providers (Google, GitHub, Microsoft) and SAML SSO can be
          configured after setup in the Admin Settings.
        </p>
      </div>

      <StepNavigation />
    </div>
  );
}

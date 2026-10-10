/**
 * Security Settings Tab
 *
 * Password policy, MFA, SAML SSO, IP allowlist and AI private-host settings.
 */
"use client";

import type { AdminSettings } from "./useAdminSettings";
import { PasswordPolicyCard } from "./PasswordPolicyCard";
import { MfaSettingsCard } from "./MfaSettingsCard";
import { SamlSettingsCard } from "./SamlSettingsCard";
import { IpAllowlistCard } from "./IpAllowlistCard";
import { AiPrivateHostsCard } from "./AiPrivateHostsCard";

interface SecurityTabProps {
  settings: AdminSettings;
  onUpdate: (updates: Partial<AdminSettings>) => void;
}

export function SecurityTab({ settings, onUpdate }: SecurityTabProps) {
  return (
    <div className="space-y-6">
      <PasswordPolicyCard settings={settings} onUpdate={onUpdate} />
      <MfaSettingsCard settings={settings} onUpdate={onUpdate} />
      <SamlSettingsCard settings={settings} onUpdate={onUpdate} />
      <IpAllowlistCard settings={settings} onUpdate={onUpdate} />
      <AiPrivateHostsCard settings={settings} onUpdate={onUpdate} />
    </div>
  );
}

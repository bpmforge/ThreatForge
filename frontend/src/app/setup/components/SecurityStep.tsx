"use client";

/**
 * Security Step
 * Configure security settings.
 */
import { useSetupStore } from "../store";
import { NumericOptionSelect, StepNavigation } from "./StepControls";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Shield, Network, FileText } from "lucide-react";

const retentionOptions = [
  { value: 30, label: "30 days" },
  { value: 60, label: "60 days" },
  { value: 90, label: "90 days" },
  { value: 180, label: "180 days" },
  { value: 365, label: "1 year" },
  { value: 730, label: "2 years" },
];

export function SecurityStep() {
  const { security, setSecurityConfigData } = useSetupStore();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">
          Security Settings
        </h2>
        <p className="mt-1 text-muted-foreground">
          Configure enterprise security features
        </p>
      </div>

      <div className="space-y-4">
        {/* IP Allowlist */}
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <Network className="h-5 w-5 text-blue-500" />
              <div>
                <h3 className="font-medium text-foreground">IP Allowlist</h3>
                <p className="text-sm text-muted-foreground">
                  Restrict access to specific IP addresses or ranges
                </p>
              </div>
            </div>
            <Switch
              checked={security.ipAllowlistEnabled}
              onCheckedChange={(ipAllowlistEnabled) =>
                setSecurityConfigData({ ipAllowlistEnabled })
              }
            />
          </div>

          {security.ipAllowlistEnabled && (
            <div className="mt-3 space-y-2">
              <Label htmlFor="ip-allowlist" className="text-slate-200">
                Allowed IPs (one per line)
              </Label>
              <Textarea
                id="ip-allowlist"
                placeholder="192.168.1.0/24&#10;10.0.0.1&#10;2001:db8::/32"
                value={security.ipAllowlist}
                onChange={(e) =>
                  setSecurityConfigData({ ipAllowlist: e.target.value })
                }
                className="bg-background border-border text-foreground placeholder:text-muted-foreground font-mono text-sm min-h-[100px]"
              />
              <p className="text-sm text-muted-foreground">
                Supports individual IPs and CIDR notation (e.g., 192.168.0.0/24)
              </p>
            </div>
          )}
        </div>

        {/* Audit Log Retention */}
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-3 mb-3">
            <FileText className="h-5 w-5 text-blue-500" />
            <div>
              <h3 className="font-medium text-foreground">
                Audit Log Retention
              </h3>
              <p className="text-sm text-muted-foreground">
                How long to keep audit logs for compliance
              </p>
            </div>
          </div>
          <NumericOptionSelect
            value={security.auditRetentionDays}
            options={retentionOptions}
            onChange={(auditRetentionDays) =>
              setSecurityConfigData({ auditRetentionDays })
            }
          />
        </div>
      </div>

      <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 p-4">
        <div className="flex items-center gap-2 mb-2">
          <Shield className="h-5 w-5 text-blue-400" />
          <h3 className="font-medium text-blue-400">Enterprise Features</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Additional security features available after setup:
        </p>
        <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
          <li>• SAML SSO with Okta, Azure AD, OneLogin</li>
          <li>• Bring Your Own Key (BYOK) encryption</li>
          <li>• Data residency configuration</li>
          <li>• Advanced audit log exports</li>
        </ul>
      </div>

      <StepNavigation />
    </div>
  );
}

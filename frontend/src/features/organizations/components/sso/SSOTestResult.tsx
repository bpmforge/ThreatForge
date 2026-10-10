"use client";

/**
 * SSOTestResult — Security tab content: email domain input and SSO enforcement toggle.
 *
 * Also houses the action buttons row (Test Configuration, Disable SSO, Save Changes)
 * and the read-only warning for non-owners.
 *
 * Extracted from SSOSettings to keep the page-level orchestrator ≤200 lines.
 */

import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { TabsContent } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface SSOTestResultProps {
  domain: string;
  enforced: boolean;
  canEdit: boolean;
  enabled: boolean;
  isCurrentlyEnabled: boolean;
  hasChanges: boolean;
  isUpdatePending: boolean;
  isDeletePending: boolean;
  isTestPending: boolean;
  onDomainChange: (value: string) => void;
  onEnforcedChange: (value: boolean) => void;
  onTest: () => void;
  onDisable: () => void;
  onSave: () => void;
}

export function SSOTestResult({
  domain,
  enforced,
  canEdit,
  enabled,
  isCurrentlyEnabled,
  hasChanges,
  isUpdatePending,
  isDeletePending,
  isTestPending,
  onDomainChange,
  onEnforcedChange,
  onTest,
  onDisable,
  onSave,
}: SSOTestResultProps) {
  return (
    <>
      <TabsContent value="security" className="space-y-4">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="domain">Email Domain</Label>
            <Input
              id="domain"
              value={domain}
              onChange={(e) => onDomainChange(e.target.value)}
              placeholder="example.com"
              disabled={!canEdit}
            />
            <p className="text-sm text-muted-foreground">
              Users with this email domain will be automatically routed to SSO
            </p>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="enforce-sso">Enforce SSO</Label>
              <p className="text-sm text-muted-foreground">
                Require all org members to use SSO (disable password login)
              </p>
            </div>
            <Switch
              id="enforce-sso"
              checked={enforced}
              onCheckedChange={onEnforcedChange}
              disabled={!canEdit}
            />
          </div>
        </div>
      </TabsContent>

      {/* Actions */}
      {canEdit && (
        <div className="flex items-center justify-between pt-4 border-t">
          <div className="flex gap-2">
            {enabled && isCurrentlyEnabled && (
              <Button
                variant="outline"
                onClick={onTest}
                disabled={isTestPending}
              >
                {isTestPending ? (
                  <Loader2 className="size-4 mr-2 animate-spin" />
                ) : (
                  <CheckCircle2 className="size-4 mr-2" />
                )}
                Test Configuration
              </Button>
            )}
            {isCurrentlyEnabled && (
              <Button
                variant="destructive"
                onClick={onDisable}
                disabled={isDeletePending}
              >
                {isDeletePending && (
                  <Loader2 className="size-4 mr-2 animate-spin" />
                )}
                Disable SSO
              </Button>
            )}
          </div>
          <Button onClick={onSave} disabled={!hasChanges || isUpdatePending}>
            {isUpdatePending && (
              <Loader2 className="size-4 mr-2 animate-spin" />
            )}
            Save Changes
          </Button>
        </div>
      )}

      {!canEdit && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Only organization owners can configure SSO settings.
          </AlertDescription>
        </Alert>
      )}
    </>
  );
}

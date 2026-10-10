/**
 * Organization settings form
 */
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useUpdateOrganization } from "../hooks/useOrganization";
import { canEditSettings, type Organization, type MemberRole } from "../types";
import { LogoUpload } from "./LogoUpload";
import { BrandingSettings } from "./BrandingSettings";
import { Separator } from "@/components/ui/separator";
import { getErrorMessage } from "@/lib/errors";

interface Props {
  organization: Organization;
  currentUserRole: MemberRole;
}

export function OrganizationSettings({ organization, currentUserRole }: Props) {
  // Component should be keyed by organization.id in parent for proper state reset
  const [name, setName] = useState(organization.name);
  const [isDirty, setIsDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateMutation = useUpdateOrganization(organization.id);
  const canEdit = canEditSettings(currentUserRole);

  function handleNameChange(value: string) {
    setName(value);
    setIsDirty(value !== organization.name);
    setError(null);
  }

  async function handleSave() {
    if (!name.trim()) {
      setError("Organization name is required");
      return;
    }
    if (name.trim().length < 2) {
      setError("Name must be at least 2 characters");
      return;
    }

    try {
      await updateMutation.mutateAsync({ name: name.trim() });
      setIsDirty(false);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to update"));
    }
  }

  function handleReset() {
    setName(organization.name);
    setIsDirty(false);
    setError(null);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Organization Settings</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <LogoUpload
          orgId={organization.id}
          orgName={organization.name}
          canEdit={canEdit}
          size="lg"
        />

        <Separator />

        <div className="space-y-2">
          <Label htmlFor="org-name">Organization Name</Label>
          <Input
            id="org-name"
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            disabled={!canEdit || updateMutation.isPending}
            placeholder="My Organization"
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <div className="space-y-2">
          <Label>Organization Slug</Label>
          <Input value={organization.slug} disabled className="bg-muted" />
          <p className="text-xs text-muted-foreground">
            The slug is used in URLs and cannot be changed.
          </p>
        </div>

        <Separator />

        <BrandingSettings orgId={organization.id} canEdit={canEdit} />

        {canEdit && isDirty && (
          <div className="flex gap-2">
            <Button onClick={handleSave} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
            <Button
              variant="outline"
              onClick={handleReset}
              disabled={updateMutation.isPending}
            >
              Reset
            </Button>
          </div>
        )}

        {!canEdit && (
          <p className="text-sm text-muted-foreground">
            You need Admin or Owner role to edit organization settings.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

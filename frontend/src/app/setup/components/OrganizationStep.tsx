"use client";

/**
 * Organization Step
 * Create the primary organization.
 */
import { useEffect } from "react";
import { useSetupStore } from "../store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, ArrowRight, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";

/** Generate a slug from organization name */
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
}

export function OrganizationStep() {
  const {
    organization,
    setOrganizationData,
    setStepValidation,
    nextStep,
    prevStep,
  } = useSetupStore();

  // Validation
  const isNameValid = organization.name.length >= 2;
  const isSlugValid =
    /^[a-z0-9]+(-[a-z0-9]+)*$/.test(organization.slug) &&
    organization.slug.length >= 2 &&
    organization.slug.length <= 50;
  const isStepValid = isNameValid && isSlugValid;

  // Update step validation
  useEffect(() => {
    setStepValidation("organization", isStepValid);
  }, [isStepValid, setStepValidation]);

  // Auto-generate slug from name
  const handleNameChange = (name: string) => {
    setOrganizationData({ name });
    // Only auto-generate slug if it hasn't been manually edited
    if (
      organization.slug === "" ||
      organization.slug === generateSlug(organization.name)
    ) {
      setOrganizationData({ slug: generateSlug(name) });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">
          Create Organization
        </h2>
        <p className="mt-1 text-muted-foreground">
          Set up your primary organization for team collaboration
        </p>
      </div>

      <div className="flex items-center justify-center py-4">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-blue-500/10 ring-2 ring-blue-500/30">
          <Building2 className="h-10 w-10 text-blue-500" />
        </div>
      </div>

      <div className="space-y-4">
        {/* Organization Name */}
        <div className="space-y-2">
          <Label htmlFor="org-name" className="text-slate-200">
            Organization Name
          </Label>
          <Input
            id="org-name"
            placeholder="Acme Corporation"
            value={organization.name}
            onChange={(e) => handleNameChange(e.target.value)}
            className={cn(
              "bg-background border-border text-foreground placeholder:text-muted-foreground",
              organization.name.length > 0 && !isNameValid && "border-red-500",
            )}
          />
          {organization.name.length > 0 && !isNameValid && (
            <p className="text-sm text-red-400">
              Name must be at least 2 characters
            </p>
          )}
          <p className="text-sm text-muted-foreground">
            This is how your organization will appear throughout the app
          </p>
        </div>

        {/* Organization Slug */}
        <div className="space-y-2">
          <Label htmlFor="org-slug" className="text-slate-200">
            Organization URL Slug
          </Label>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              /organizations/
            </span>
            <Input
              id="org-slug"
              placeholder="acme-corp"
              value={organization.slug}
              onChange={(e) =>
                setOrganizationData({ slug: e.target.value.toLowerCase() })
              }
              className={cn(
                "bg-background border-border text-foreground placeholder:text-muted-foreground flex-1",
                organization.slug.length > 0 &&
                  !isSlugValid &&
                  "border-red-500",
              )}
            />
          </div>
          {organization.slug.length > 0 && !isSlugValid && (
            <p className="text-sm text-red-400">
              Slug must be lowercase, contain only letters, numbers, and hyphens
            </p>
          )}
          <p className="text-sm text-muted-foreground">
            Used in URLs and API references. Cannot be changed later.
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="font-medium text-slate-200">Organization features</h3>
        <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
          <li>• Manage team members and access permissions</li>
          <li>• Create projects and threat models</li>
          <li>• Configure AI and security settings</li>
          <li>• View audit logs and activity</li>
        </ul>
      </div>

      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={prevStep}
          className="gap-2 border-border"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <Button onClick={nextStep} className="gap-2" disabled={!isStepValid}>
          Continue
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

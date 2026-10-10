"use client";

/**
 * Report branding form — brand colours for PDF/DOCX reports.
 * The logo is managed by LogoUpload (shared with the org avatar).
 */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiGet, apiPut } from "@/lib/api-client";

interface Branding {
  primaryColor?: string;
  accentColor?: string;
}

interface Props {
  orgId: string;
  canEdit: boolean;
}

const HEX_RE = /^#[0-9a-fA-F]{6}$/;
const DEFAULT_PRIMARY = "#1d4ed8";
const DEFAULT_ACCENT = "#2563eb";

function ColorField({
  id,
  label,
  value,
  fallback,
  onChange,
  disabled,
}: {
  id: string;
  label: string;
  value: string;
  /** Colour reports use while the field is blank; shown on the swatch and as the placeholder. */
  fallback: string;
  onChange: (v: string) => void;
  disabled: boolean;
}) {
  const invalid = value !== "" && !HEX_RE.test(value);
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={`${label} picker`}
          value={HEX_RE.test(value) ? value : fallback}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="h-9 w-12 cursor-pointer rounded border bg-transparent p-1"
        />
        <Input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          placeholder={fallback}
          aria-invalid={invalid}
          className="max-w-[10rem] font-mono"
        />
      </div>
      {invalid && (
        <p className="text-sm text-destructive">Use a #rrggbb hex colour.</p>
      )}
    </div>
  );
}

export function BrandingSettings({ orgId, canEdit }: Props) {
  const queryClient = useQueryClient();
  const key = ["org-branding", orgId];
  const { data } = useQuery({
    queryKey: key,
    queryFn: () => apiGet<Branding>(`/api/organizations/${orgId}/branding`),
  });
  const [primary, setPrimary] = useState<string | null>(null);
  const [accent, setAccent] = useState<string | null>(null);

  const primaryValue = primary ?? data?.primaryColor ?? "";
  const accentValue = accent ?? data?.accentColor ?? "";
  const valid =
    (primaryValue === "" || HEX_RE.test(primaryValue)) &&
    (accentValue === "" || HEX_RE.test(accentValue));
  const dirty = primary !== null || accent !== null;

  const save = useMutation({
    mutationFn: () =>
      apiPut<Branding>(`/api/organizations/${orgId}/branding`, {
        primaryColor: primaryValue || null,
        accentColor: accentValue || null,
      }),
    onSuccess: (saved) => {
      queryClient.setQueryData(key, saved);
      setPrimary(null);
      setAccent(null);
      toast.success("Report branding saved");
    },
    onError: () => toast.error("Failed to save report branding"),
  });

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium">Report branding</h3>
        <p className="text-xs text-muted-foreground">
          The organization logo and these colours appear on PDF and Word
          reports. Leave blank for ThreatForge defaults ({DEFAULT_PRIMARY},{" "}
          {DEFAULT_ACCENT}).
        </p>
      </div>
      <div className="flex flex-wrap gap-6">
        <ColorField
          id="brand-primary"
          label="Primary colour"
          value={primaryValue}
          fallback={DEFAULT_PRIMARY}
          onChange={setPrimary}
          disabled={!canEdit || save.isPending}
        />
        <ColorField
          id="brand-accent"
          label="Accent colour"
          value={accentValue}
          fallback={DEFAULT_ACCENT}
          onChange={setAccent}
          disabled={!canEdit || save.isPending}
        />
      </div>
      {canEdit && dirty && (
        <Button
          onClick={() => save.mutate()}
          disabled={!valid || save.isPending}
        >
          {save.isPending ? "Saving..." : "Save Branding"}
        </Button>
      )}
    </div>
  );
}

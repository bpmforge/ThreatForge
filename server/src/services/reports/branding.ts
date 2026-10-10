/**
 * Report branding — org logo + brand colours for PDF/DOCX/HTML reports.
 *
 * Logo reuses Organization.logoUrl (base64 data URL, see api/uploads.ts).
 * Colours live in Organization.settings JSON under `branding` (no schema change).
 */
import { getPrisma } from "../../db.js";

export interface ReportBranding {
  /** PNG/JPEG data URL, absent when org has no uploaded raster logo */
  logoDataUrl?: string;
  /** "#rrggbb" */
  primaryColor?: string;
  /** "#rrggbb" */
  accentColor?: string;
}

export const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;
const LOGO_MAX_BYTES = 2 * 1024 * 1024;
const LOGO_RE = /^data:image\/(png|jpeg);base64,([A-Za-z0-9+/=]+)$/i;

/** True when `dataUrl` is a PNG/JPEG base64 data URL within the size cap. */
export function isValidLogoDataUrl(dataUrl: string): boolean {
  const m = LOGO_RE.exec(dataUrl);
  return !!m && (m[2].length * 3) / 4 <= LOGO_MAX_BYTES;
}

function parseSettingsBranding(settings: string | null | undefined): {
  primaryColor?: string;
  accentColor?: string;
} {
  try {
    const b = (JSON.parse(settings || "{}") as { branding?: unknown }).branding;
    if (!b || typeof b !== "object") return {};
    const { primaryColor, accentColor } = b as Record<string, unknown>;
    return {
      ...(typeof primaryColor === "string" &&
        HEX_COLOR_RE.test(primaryColor) && { primaryColor }),
      ...(typeof accentColor === "string" &&
        HEX_COLOR_RE.test(accentColor) && { accentColor }),
    };
  } catch {
    return {};
  }
}

/** Build branding from an org row; undefined when nothing is configured. */
export function resolveBranding(org: {
  logoUrl: string | null;
  settings: string | null;
}): ReportBranding | undefined {
  const branding: ReportBranding = parseSettingsBranding(org.settings);
  if (org.logoUrl && isValidLogoDataUrl(org.logoUrl)) {
    branding.logoDataUrl = org.logoUrl;
  }
  return Object.keys(branding).length > 0 ? branding : undefined;
}

export async function loadBrandingForModel(
  modelId: string,
): Promise<ReportBranding | undefined> {
  const prisma = await getPrisma();
  const model = await prisma.threatModel.findUnique({
    where: { id: modelId },
    select: {
      project: {
        select: { organization: { select: { logoUrl: true, settings: true } } },
      },
    },
  });
  return model ? resolveBranding(model.project.organization) : undefined;
}

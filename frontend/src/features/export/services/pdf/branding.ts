/**
 * PDF branding — org logo + brand colours injected into the print template.
 * Values come from GET /api/threat-models/:id/branding (server-validated);
 * re-validated here because they are interpolated into HTML/CSS.
 */

export interface ReportBranding {
  logoDataUrl?: string;
  primaryColor?: string;
  accentColor?: string;
}

const HEX_RE = /^#[0-9a-fA-F]{6}$/;
const LOGO_RE = /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/;

/** CSS overrides applied after the base stylesheet. */
export function getBrandingStyles(branding?: ReportBranding): string {
  const primary = branding?.primaryColor;
  const accent = branding?.accentColor;
  return [
    primary && HEX_RE.test(primary) ? `h1 { color: ${primary}; }` : "",
    primary && HEX_RE.test(primary)
      ? `th { background: ${primary}; color: #ffffff; }`
      : "",
    accent && HEX_RE.test(accent)
      ? `h2 { border-bottom-color: ${accent}; } h1 { border-bottom: 3px solid ${accent}; padding-bottom: 8px; }`
      : "",
    ".brand-logo { max-height: 64px; max-width: 220px; margin-bottom: 16px; display: block; }",
  ]
    .filter(Boolean)
    .join("\n");
}

/** Logo <img> markup, or "" when there is no valid logo. */
export function getBrandingLogo(branding?: ReportBranding): string {
  const logo = branding?.logoDataUrl;
  return logo && LOGO_RE.test(logo)
    ? `<img class="brand-logo" src="${logo}" alt="Organization logo" />`
    : "";
}

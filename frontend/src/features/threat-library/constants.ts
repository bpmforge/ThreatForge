/**
 * Constants for the threat library feature.
 */
import { severityDot } from "@/lib/severity";
import type { StrideCategory, Severity } from "@/types/canvas";

/** Short names for STRIDE categories */
export const STRIDE_SHORT_NAMES: Record<StrideCategory, string> = {
  SPOOFING: "S",
  TAMPERING: "T",
  REPUDIATION: "R",
  INFORMATION_DISCLOSURE: "I",
  DENIAL_OF_SERVICE: "D",
  ELEVATION_OF_PRIVILEGE: "E",
};

/** Full names for STRIDE categories */
export const STRIDE_FULL_NAMES: Record<StrideCategory, string> = {
  SPOOFING: "Spoofing",
  TAMPERING: "Tampering",
  REPUDIATION: "Repudiation",
  INFORMATION_DISCLOSURE: "Information Disclosure",
  DENIAL_OF_SERVICE: "Denial of Service",
  ELEVATION_OF_PRIVILEGE: "Elevation of Privilege",
};

/**
 * Colors for severity levels — derived from lib/severity.
 * This map was the semi-canonical one (re-exported through the feature barrel),
 * but nothing outside threat-library consumed it, which is how 26 other copies
 * came to exist. It previously coloured INFO blue and LOW green; both now come
 * from the tokens, so INFO is neutral and LOW is blue.
 */
export const SEVERITY_COLORS: Record<Severity, string> = {
  INFO: severityDot("INFO"),
  LOW: severityDot("LOW"),
  MEDIUM: severityDot("MEDIUM"),
  HIGH: severityDot("HIGH"),
  CRITICAL: severityDot("CRITICAL"),
};

/** All STRIDE categories for filtering */
export const STRIDE_CATEGORY_OPTIONS: {
  value: StrideCategory | "ALL";
  label: string;
}[] = [
  { value: "ALL", label: "All Categories" },
  { value: "SPOOFING", label: "Spoofing" },
  { value: "TAMPERING", label: "Tampering" },
  { value: "REPUDIATION", label: "Repudiation" },
  { value: "INFORMATION_DISCLOSURE", label: "Information Disclosure" },
  { value: "DENIAL_OF_SERVICE", label: "Denial of Service" },
  { value: "ELEVATION_OF_PRIVILEGE", label: "Elevation of Privilege" },
];

// Re-export compliance constants
export * from "./constants/compliance";

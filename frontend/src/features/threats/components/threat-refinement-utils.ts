import { severityDot } from "@/lib/severity";
import type { Severity } from "@/types/canvas";

export interface ThreatUpdateSuggestion {
  name?: string;
  description?: string;
  severity?: Severity;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  suggestedUpdate?: ThreatUpdateSuggestion;
}

/**
 * Kept as an exported map because 12 call sites index it, but the values now
 * derive from lib/severity so there is one source of colour. Note LOW changes
 * green -> blue: green reads as "resolved/safe" and 9 other files already used
 * blue. See lib/severity for the full rationale.
 */
export const SEVERITY_COLORS: Record<Severity, string> = {
  INFO: severityDot("INFO"),
  LOW: severityDot("LOW"),
  MEDIUM: severityDot("MEDIUM"),
  HIGH: severityDot("HIGH"),
  CRITICAL: severityDot("CRITICAL"),
};

const VALID_SEVERITIES: Severity[] = [
  "INFO",
  "LOW",
  "MEDIUM",
  "HIGH",
  "CRITICAL",
];

export function parseThreatUpdate(text: string): {
  clean: string;
  update: ThreatUpdateSuggestion | undefined;
} {
  const match = text.match(/<threatUpdate>([\s\S]*?)<\/threatUpdate>/);
  if (!match) return { clean: text, update: undefined };
  try {
    const raw = JSON.parse(match[1].trim());
    const update: ThreatUpdateSuggestion = {};
    if (typeof raw.name === "string") update.name = raw.name.trim();
    if (typeof raw.description === "string")
      update.description = raw.description.trim();
    if (VALID_SEVERITIES.includes(raw.severity)) update.severity = raw.severity;
    const hasFields = Object.keys(update).length > 0;
    const clean = text
      .replace(/<threatUpdate>[\s\S]*?<\/threatUpdate>/, "")
      .trim();
    return { clean, update: hasFields ? update : undefined };
  } catch {
    const clean = text
      .replace(/<threatUpdate>[\s\S]*?<\/threatUpdate>/, "")
      .trim();
    return { clean, update: undefined };
  }
}

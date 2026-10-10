/**
 * Attack Chains feature types.
 *
 * The chain data shapes are defined once in the attack-paths feature (alongside the
 * canvas-highlight primitives). We re-use
 * those types rather than redefine them so the panel and the overlay stay in
 * lockstep.
 */
import { severityBadge } from "@/lib/severity";
export type {
  ChainStatus,
  AttackChainHop,
  AttackChainWithHops,
} from "@/features/attack-paths";

/**
 * Derived from lib/severity. Was light-mode only, and coloured LOW green.
 * (STATUS_BADGE_CLASSES below is review STATUS, not severity — deliberately
 * left alone; green there genuinely means accepted.)
 */
export const SEVERITY_BADGE_CLASSES: Record<string, string> = {
  CRITICAL: severityBadge({ severity: "CRITICAL", variant: "soft" }),
  HIGH: severityBadge({ severity: "HIGH", variant: "soft" }),
  MEDIUM: severityBadge({ severity: "MEDIUM", variant: "soft" }),
  LOW: severityBadge({ severity: "LOW", variant: "soft" }),
};

export const STATUS_BADGE_CLASSES: Record<string, string> = {
  AI_SUGGESTED: "bg-purple-100 text-purple-800 border-purple-200",
  ACCEPTED: "bg-green-100 text-green-800 border-green-200",
  REJECTED: "bg-gray-100 text-gray-600 border-gray-200",
  MODIFIED: "bg-blue-100 text-blue-800 border-blue-200",
};

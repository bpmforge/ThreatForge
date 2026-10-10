import type { ChallengeStatus } from "../types";

interface Props {
  status?: ChallengeStatus;
  /** Refutation note — surfaced as the tooltip on the UNCERTAIN badge. */
  note?: string;
}

/**
 * Visual badge for the challenger-gate verdict on a
 * threat. This is the adversarial-refutation outcome — distinct from the
 * citation-verifier `VerificationBadge` it renders beside in the badge row.
 *
 * - CONFIRMED  → "✓ Verified" (survived topology + citation + refutation)
 * - UNCERTAIN  → "? Unverified-uncertain" with `note` as the tooltip
 * - UNVERIFIED → no badge (not yet challenged; neutral, nothing to show)
 *
 * Confidently-refuted threats are deleted upstream, so REFUTED never reaches
 * the UI.
 */
export function ChallengeBadge({ status, note }: Props) {
  if (!status || status === "UNVERIFIED") return null;

  if (status === "CONFIRMED") {
    return (
      <span
        role="listitem"
        aria-label="Challenge verdict: Verified — survived adversarial refutation"
        title="Survived the challenger gate (topology, citation, and adversarial refutation checks)"
        className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-700"
      >
        {"✓"} Verified
      </span>
    );
  }

  // UNCERTAIN
  const tooltip =
    note ||
    "Kept, but flagged by the challenger gate — review before relying on this threat";
  return (
    <span
      role="listitem"
      aria-label={`Challenge verdict: Unverified-uncertain — ${tooltip}`}
      title={tooltip}
      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800"
    >
      {"?"} Unverified-uncertain
    </span>
  );
}

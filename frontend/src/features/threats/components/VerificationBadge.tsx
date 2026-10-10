import type { VerificationStatus } from "../types";

interface Props {
  status?: VerificationStatus;
  /** Hide entirely when status is VERIFIED (the "happy path" doesn't need a badge). */
  hideWhenVerified?: boolean;
  /** When provided, the badge becomes a button that triggers drill-down. */
  onClick?: () => void;
}

/**
 * Visual badge for the citation-verifier rollup status on a threat or
 * mitigation. Composes with the existing reviewStatus badge — they render
 * side-by-side in the threat-card badge row.
 *
 * Default behavior hides VERIFIED to reduce visual noise; UNVERIFIED /
 * PHANTOM / PENDING are always shown.
 */
export function VerificationBadge({
  status,
  hideWhenVerified = true,
  onClick,
}: Props) {
  if (!status) return null;
  if (status === "EXEMPT") return null;
  if (status === "VERIFIED" && hideWhenVerified) return null;

  const label = LABELS[status];
  const className = STYLES[status];
  const ariaLabel = `Verification: ${label}`;
  const isExpandable =
    onClick != null &&
    (status === "UNVERIFIED" || status === "PHANTOM" || status === "PENDING");

  const inner = (
    <>
      {ICONS[status]} {label}
      {isExpandable && (
        <svg
          aria-hidden="true"
          className="ml-1 h-3 w-3 opacity-60"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      )}
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={`${ariaLabel} — click to view citations`}
        title={TOOLTIPS[status]}
        className={`inline-flex cursor-pointer items-center px-2 py-0.5 rounded text-xs font-medium ${className} hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1`}
      >
        {inner}
      </button>
    );
  }

  return (
    <span
      role="listitem"
      aria-label={ariaLabel}
      title={TOOLTIPS[status]}
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${className}`}
    >
      {inner}
    </span>
  );
}

const LABELS: Record<VerificationStatus, string> = {
  VERIFIED: "Verified",
  UNVERIFIED: "Unverified",
  PHANTOM: "Phantom citation",
  PENDING: "Pending",
  EXEMPT: "Exempt",
};

const STYLES: Record<VerificationStatus, string> = {
  VERIFIED: "bg-emerald-100 text-emerald-700",
  UNVERIFIED: "bg-amber-100 text-amber-800",
  PHANTOM: "bg-red-100 text-red-700",
  PENDING: "bg-slate-100 text-slate-700",
  EXEMPT: "bg-slate-100 text-slate-500",
};

const ICONS: Record<VerificationStatus, string> = {
  VERIFIED: "\u2713",
  UNVERIFIED: "\u26A0",
  PHANTOM: "\u2717",
  PENDING: "\u22EF",
  EXEMPT: "\u2014",
};

const TOOLTIPS: Record<VerificationStatus, string> = {
  VERIFIED: "Source supports this claim (verified by citation cross-check)",
  UNVERIFIED:
    "Citation could not be verified — review against the source before relying on this claim",
  PHANTOM: "Cited source could not be located — the claim may be fabricated",
  PENDING: "Awaiting citation verification",
  EXEMPT: "Claim is exempt from citation verification",
};

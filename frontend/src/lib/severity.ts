/**
 * Severity colour — the single source of truth.
 *
 * Before this module, 27 files defined their own severity→colour map and they
 * disagreed with each other:
 *   - LOW was green in some files and blue in others
 *   - INFO had four different values (slate-500 / blue-500 / gray-400 / gray-500)
 *   - CRITICAL was red-600 in some, red-500 in others
 *   - `bg-yellow-500 text-white` failed WCAG AA contrast
 *   - most maps were light-mode only, rendering near-invisibly in dark
 *
 * Colours come from the `--severity-*` tokens in globals.css, which are defined
 * per theme. That is what lets ONE token serve both the solid fill and the soft
 * variant's text in both themes — the old `bg-red-100 text-red-800` shape could
 * only ever work in light mode.
 *
 * LOW is blue, not green, deliberately: green reads as "resolved/safe" and
 * collides with mitigation-status colour elsewhere in the product.
 *
 * Usage:
 *   <Badge className={severityBadge({ severity })}>{severity}</Badge>
 *   <Badge className={severityBadge({ severity, variant: "soft" })}>…</Badge>
 *   <span className={severityDot(severity)} />
 */
import { cva } from "class-variance-authority";

/** Canonical severity levels. Accepts any case at the boundary via `toSeverity`. */
const SEVERITY_LEVELS = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"] as const;

export type Severity = (typeof SEVERITY_LEVELS)[number];

/**
 * Normalise arbitrary input (API strings, lowercase, legacy "NONE"/"NOTE")
 * to a known level. Unknown values fall back to INFO rather than throwing —
 * a colour is never worth crashing a render over.
 */
export function toSeverity(value: string | null | undefined): Severity {
  const v = (value ?? "").toUpperCase();
  if ((SEVERITY_LEVELS as readonly string[]).includes(v)) return v as Severity;
  return "INFO";
}

/**
 * Badge / chip classes.
 *
 * `solid` — filled, for emphasis (severity is the primary signal in the row).
 * `soft`  — 12% tint with coloured text, for dense lists where a wall of solid
 *           colour would shout. This is the theme-aware replacement for the old
 *           `bg-red-100 text-red-800` pattern.
 * `outline` — border only, for the lightest possible weight.
 */
export const severityBadge = cva("border-transparent", {
  variants: {
    severity: {
      CRITICAL: "",
      HIGH: "",
      MEDIUM: "",
      LOW: "",
      INFO: "",
    },
    variant: {
      solid: "",
      soft: "",
      outline: "bg-transparent",
    },
  },
  compoundVariants: [
    // solid — explicit foreground per level; MEDIUM uses dark text because
    // white on amber fails AA (the original bug this module replaces).
    {
      severity: "CRITICAL",
      variant: "solid",
      class: "bg-severity-critical text-severity-critical-foreground",
    },
    {
      severity: "HIGH",
      variant: "solid",
      class: "bg-severity-high text-severity-high-foreground",
    },
    {
      severity: "MEDIUM",
      variant: "solid",
      class: "bg-severity-medium text-severity-medium-foreground",
    },
    {
      severity: "LOW",
      variant: "solid",
      class: "bg-severity-low text-severity-low-foreground",
    },
    {
      severity: "INFO",
      variant: "solid",
      class: "bg-severity-info text-severity-info-foreground",
    },
    // soft — one token drives both tint and text, so it flips with the theme.
    {
      severity: "CRITICAL",
      variant: "soft",
      class: "bg-severity-critical/12 text-severity-critical",
    },
    {
      severity: "HIGH",
      variant: "soft",
      class: "bg-severity-high/12 text-severity-high",
    },
    {
      severity: "MEDIUM",
      variant: "soft",
      class: "bg-severity-medium/12 text-severity-medium",
    },
    {
      severity: "LOW",
      variant: "soft",
      class: "bg-severity-low/12 text-severity-low",
    },
    {
      severity: "INFO",
      variant: "soft",
      class: "bg-severity-info/12 text-severity-info",
    },
    // outline
    {
      severity: "CRITICAL",
      variant: "outline",
      class: "border-severity-critical text-severity-critical",
    },
    {
      severity: "HIGH",
      variant: "outline",
      class: "border-severity-high text-severity-high",
    },
    {
      severity: "MEDIUM",
      variant: "outline",
      class: "border-severity-medium text-severity-medium",
    },
    {
      severity: "LOW",
      variant: "outline",
      class: "border-severity-low text-severity-low",
    },
    {
      severity: "INFO",
      variant: "outline",
      class: "border-severity-info text-severity-info",
    },
  ],
  defaultVariants: { severity: "INFO", variant: "solid" },
});

/** Background-only, for dots, bars, heat-map cells and legend swatches. */
export function severityDot(severity: string | null | undefined): string {
  const s = toSeverity(severity);
  return {
    CRITICAL: "bg-severity-critical",
    HIGH: "bg-severity-high",
    MEDIUM: "bg-severity-medium",
    LOW: "bg-severity-low",
    INFO: "bg-severity-info",
  }[s];
}

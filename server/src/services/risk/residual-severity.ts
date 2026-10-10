/**
 * Residual-risk helper (shared) — the canonical "realistic mitigation
 * effectiveness" model (CLAUDE.md: 0–85 % effectiveness, residual risk,
 * diminishing returns). Originally inlined in `api/v1/data-api.ts`; extracted
 * here so the attack-chain scorer reuses the SAME math instead
 * of reinventing it.
 *
 * Pure functions, no DB access.
 */

export type SeverityLabel = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";

/** Severity ladder (descending). Index = how "bad" the severity is. */
const SEVERITY_LADDER: SeverityLabel[] = [
  "INFO",
  "LOW",
  "MEDIUM",
  "HIGH",
  "CRITICAL",
];

/** The effectiveness ceiling — no single control ever fully removes risk. */
export const EFFECTIVENESS_CAP = 0.85;

/**
 * Diminishing-returns residual fraction (0–1) of the original risk that
 * survives a set of IMPLEMENTED mitigation effectiveness scores. Each control
 * is capped at {@link EFFECTIVENESS_CAP}; their reductions compound
 * multiplicatively (two 50 % controls leave 25 %, not 0 %).
 *
 * This is exactly the formula in `data-api.ts` risk-register export.
 */
export function residualFraction(effectivenessScores: number[]): number {
  let remaining = 1;
  for (const s of effectivenessScores) {
    remaining *= 1 - Math.min(s, EFFECTIVENESS_CAP);
  }
  return remaining;
}

/**
 * Step a severity label DOWN by `steps` rungs on the ladder (never below INFO).
 * `steps = 0` is a no-op. Used to translate a residual fraction into a residual
 * severity label for an attack chain.
 */
export function dropSeverity(
  severity: SeverityLabel,
  steps: number,
): SeverityLabel {
  const idx = SEVERITY_LADDER.indexOf(severity);
  if (idx < 0) return severity;
  const next = Math.max(0, idx - Math.max(0, steps));
  return SEVERITY_LADDER[next];
}

/**
 * Map a residual fraction (0–1) to how many severity rungs to drop:
 *   > 0.66  → 0 (mitigations barely dent the chain)
 *   0.33–0.66 → 1
 *   0.10–0.33 → 2
 *   ≤ 0.10  → 3 (chain is almost fully broken)
 * Tuned so a single ~85 %-effective breaking control drops one full step and a
 * stack of strong controls collapses a CRITICAL chain toward LOW/INFO.
 */
export function severityStepsForFraction(fraction: number): number {
  if (fraction > 0.66) return 0;
  if (fraction > 0.33) return 1;
  if (fraction > 0.1) return 2;
  return 3;
}

/**
 * Residual severity for a chain: take the worst (smallest) residual fraction
 * across its breaking hops — the most-mitigated hop is the chokepoint that
 * limits the attacker — and drop the chain's base severity accordingly.
 *
 * `breakingHopFractions` holds, per hop that has ≥ 1 IMPLEMENTED breaking
 * mitigation, that hop's residual fraction. An empty array means nothing
 * mitigates the chain → residual severity equals the base severity.
 */
export function residualChainSeverity(
  baseSeverity: SeverityLabel,
  breakingHopFractions: number[],
): SeverityLabel {
  if (breakingHopFractions.length === 0) return baseSeverity;
  const bestBreak = Math.min(...breakingHopFractions);
  return dropSeverity(baseSeverity, severityStepsForFraction(bestBreak));
}

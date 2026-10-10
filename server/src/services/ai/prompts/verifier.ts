/**
 * Verifier (challenger gate) prompts.
 *
 * The adversarial refutation pass. The model is asked to argue AGAINST each
 * threat and default to REFUTED when uncertain — this bias is intentional:
 * the gate's job is to remove threats that do not survive scrutiny, so a
 * cautious "I can't be sure this applies" should cost the threat, not the
 * architecture. Verdicts come back as a `VerdictZ[]` JSON array (one per
 * threat, ≤ 10 threats per call), parsed via safeParseArray.
 */

export const VERIFIER_SYSTEM_PROMPT = `You are a skeptical red-team reviewer auditing a list of PROPOSED security threats against a specific architecture. Your job is NOT to find threats — it is to REFUTE the ones that do not actually apply.

## Your stance (adversarial by design)
- For each proposed threat, argue that it does NOT apply to THIS architecture.
- Default to REFUTED when you are uncertain. A threat you cannot positively confirm is a threat that should not ship.
- Only return CONFIRMED when the architecture clearly makes the threat real and reachable.
- Return UNCERTAIN only when the evidence is genuinely mixed and you would refute it at low confidence.

## What makes a threat REFUTED
- It targets a component or connection that does not exist or is mischaracterized.
- The control it assumes is missing is actually present (e.g. it claims "no encryption" on a connection marked encrypted).
- It is a generic boilerplate threat with no anchor in the described architecture.
- It duplicates the substance of another threat on the same target.
- The attack path it describes is not reachable given the trust boundaries.

## Confidence
- confidence is 0.0–1.0 and reflects how sure you are of the VERDICT you gave.
- A confidently-refuted threat (confidence >= 0.7) will be deleted. Refute confidently only when you are sure.

## Output (STRICT)
Return ONLY a JSON array. One object per threat, in the same order, echoing the threatRef you were given:
[
  { "threatRef": "<echo exactly>", "verdict": "CONFIRMED|REFUTED|UNCERTAIN", "refutationReason": "<one sentence; required when REFUTED or UNCERTAIN>", "confidence": 0.0 }
]
No prose, no markdown fences, no commentary outside the array.`;

export interface VerifierThreatLine {
  /** normalizedName::targetKey — the model must echo this back verbatim. */
  threatRef: string;
  name: string;
  category: string;
  targetName: string;
  description: string;
  /** The CWE ids the threat cites, so the refuter can check them. */
  cweIds?: string[];
}

/**
 * Build the user prompt for one batch of ≤ 10 threats. `architectureSummary`
 * is the same DB-id-stripped component/connection summary the rest of the
 * pipeline uses (ADR-006), so prompts carry names, not CUIDs.
 */
export function buildVerifierUserPrompt(
  architectureSummary: string,
  threats: VerifierThreatLine[],
): string {
  const list = threats
    .map(
      (t, i) =>
        `${i + 1}. threatRef: ${t.threatRef}\n` +
        `   name: ${t.name}\n` +
        `   category: ${t.category}\n` +
        `   target: ${t.targetName}\n` +
        `   description: ${t.description}` +
        (t.cweIds?.length ? `\n   cwe: ${t.cweIds.join(", ")}` : ""),
    )
    .join("\n\n");

  return `## Architecture under review\n${architectureSummary}\n\n## Proposed threats to refute (${threats.length})\n${list}\n\nReturn the JSON array of verdicts now, one per threat, echoing each threatRef exactly.`;
}

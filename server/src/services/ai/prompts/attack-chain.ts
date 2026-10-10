/**
 * Attack-chain analysis prompts.
 *
 * Pass 1 (Entry Point Detection) and Pass 2 (Target Asset Detection). Both
 * pass the DB-id-stripped component/connection summary the rest of the AI
 * pipeline uses (ADR-006) so prompts carry component NAMES + their stable
 * fixture/canvas ids, never CUIDs. The model must echo back the componentId it
 * was shown; the stage handler validates every returned id against the model's
 * topology and drops hallucinated ids (counted as parseFailures).
 *
 * Output is a strict JSON array parsed via safeParseArray against
 * EntryPointArrayZ / TargetAssetArrayZ.
 */
import type { ThreatModelContext } from "../../../types/ai.js";
import { CAPABILITY_TOKENS } from "../schemas/llm-response-schemas.js";

/**
 * Component + connection summary for the attack-chain passes. Lists each
 * component's id (the model must echo it back), name, type, and trust zone so
 * the model can reason about exposure / asset value, plus the connection graph
 * so it understands reachability.
 */
export function buildAttackChainSummary(context: ThreatModelContext): string {
  const byId = new Map(context.components.map((c) => [c.id, c.name]));
  const comps = context.components
    .map(
      (c) =>
        `- id: ${c.id} | name: ${c.name} | type: ${c.type}` +
        (c.trustZone ? ` | trust: ${c.trustZone}` : ""),
    )
    .join("\n");
  const conns = context.connections
    .map((c) => {
      const from = byId.get(c.source) ?? c.source;
      const to = byId.get(c.target) ?? c.target;
      const proto = c.protocol ?? "?";
      const enc = c.encrypted ? "encrypted" : "cleartext";
      return `- ${from} -> ${to} (${proto}, ${enc})`;
    })
    .join("\n");
  return (
    `Components:\n${comps || "(none)"}\n\n` +
    `Connections:\n${conns || "(none)"}`
  );
}

// --- Pass 1: Entry Point Detection -----------------------------------------

export const ENTRY_POINT_SYSTEM_PROMPT = `You are a penetration tester mapping the attack surface of a system. Given the components of a threat model and their trust levels, identify which components are EXTERNAL-FACING ENTRY POINTS — the places an attacker could first reach WITHOUT already having internal access or authentication.

## What qualifies as an entry point
- Components in an untrusted / external / public / DMZ trust zone, OR reachable directly from one (e.g. a public web app, an API gateway, an internet-facing endpoint).
- Components that accept input from external actors or untrusted networks.
- External entities and actors are themselves potential entry vectors when they connect inward.

## What does NOT qualify
- Internal-only services with no path from an untrusted source.
- Databases, caches, and queues that only internal components reach (those are targets, not entry points).

## Output (STRICT)
Return ONLY a JSON array. One object per entry point, echoing the componentId you were shown verbatim:
[
  { "componentId": "<echo exactly>", "justification": "<one sentence: why an attacker can reach this without auth>", "exposure": 0.0 }
]
exposure is 0.0–1.0 (1.0 = fully internet-exposed and unauthenticated). Only include components that are genuinely externally reachable. No prose, no markdown fences, no commentary outside the array.`;

export function buildEntryPointUserPrompt(summary: string): string {
  return (
    `## Architecture\n${summary}\n\n` +
    `Identify the external-facing entry points. Return the JSON array now, echoing each componentId exactly as shown above.`
  );
}

// --- Pass 2: Target Asset Detection ----------------------------------------

export const TARGET_ASSET_SYSTEM_PROMPT = `You are a threat-intelligence analyst identifying the most valuable TARGET ASSETS in a system — the components a threat actor most wants to reach because they hold the most sensitive data or provide the most valuable capabilities.

## What makes a component a high-value target
- Holds sensitive or regulated data (databases, data stores with PII / payment / credentials / secrets).
- Provides privileged capability (auth services, admin services, payment/billing services, key stores).
- Is a chokepoint many other components depend on.

## What is usually NOT a primary target
- Stateless edge components that merely forward requests (unless they hold secrets).
- External entities the system does not control.

## Output (STRICT)
Return ONLY a JSON array. One object per target asset, echoing the componentId you were shown verbatim:
[
  { "componentId": "<echo exactly>", "justification": "<one sentence: what makes this a high-value target>", "value": 0.0 }
]
value is 0.0–1.0 (1.0 = crown-jewel asset). No prose, no markdown fences, no commentary outside the array.`;

export function buildTargetAssetUserPrompt(summary: string): string {
  return (
    `## Architecture\n${summary}\n\n` +
    `Identify the high-value target assets. Return the JSON array now, echoing each componentId exactly as shown above.`
  );
}

// --- Pass 3: Path Generation ------------------------------------------------

/** The capability vocabulary rendered for the prompt. */
const CAPABILITY_VOCAB = CAPABILITY_TOKENS.join(", ");

export const PATH_GENERATION_SYSTEM_PROMPT = `You are a red-team operator describing the most plausible attack path from a single ENTRY POINT to a single TARGET ASSET in a system you have been shown. You reason like an attacker who has compromised the entry point and must move laterally to the target.

## Capability tokens (REQUIRED on every hop)
Each hop carries two explicit lists of capability tokens:
- "preconditions": what the attacker MUST already have to attempt this hop.
- "yields": what the attacker GAINS if the hop succeeds.

Use tokens from this vocabulary wherever they fit (prefer them over free text):
${CAPABILITY_VOCAB}
For data tokens, replace <classification> with the data sensitivity, e.g. "data:read:RESTRICTED". The very first hop at the entry point typically needs only "network:public".
Hops must chain: a hop's preconditions should be satisfiable from the entry assumptions plus the yields of earlier hops in the SAME chain (this is checked by code in a later pass — chains that do not chain are discarded, so be honest).

## Threats per hop
Every hop exploits ONE threat. Prefer an EXISTING threat from the list provided (echo its threatRef verbatim). If no existing threat fits, propose a NEW one via a "newThreat" object — it will be recorded for human review. Set "threatRef" to a short stable handle even for new threats.

## Chains
For the given (entry, target) pair, produce UP TO 3 distinct candidate chains (fewer is fine). Each chain walks adjacent components from the entry point to the target — do not skip across unconnected components.

## Output (STRICT)
Return ONLY a JSON array of chain objects, echoing componentIds verbatim:
[
  {
    "entryPointId": "<echo entry id>",
    "targetAssetId": "<echo target id>",
    "name": "<short path name>",
    "description": "<one-paragraph summary of the path>",
    "severity": "CRITICAL|HIGH|MEDIUM|LOW|INFO",
    "hops": [
      {
        "componentId": "<echo id>",
        "threatRef": "<existing threatRef or a new short handle>",
        "description": "<what the attacker does at this hop>",
        "technique": "<MITRE ATT&CK id, optional>",
        "preconditions": ["network:public"],
        "yields": ["code-exec"],
        "connectionId": "<edge id traversed, optional>",
        "traversedBoundaryId": "<boundary id crossed, or null>",
        "newThreat": { "name": "...", "description": "...", "category": "...", "severity": "HIGH" }
      }
    ]
  }
]
Omit "newThreat" when the hop reuses an existing threat. No prose, no markdown fences, no commentary outside the array.`;

/** Render existing threats as `threatRef | name (component)` lines for reuse. */
export interface ExistingThreatRef {
  threatRef: string;
  name: string;
  componentName?: string;
}

export function buildPathGenerationUserPrompt(
  summary: string,
  entry: { componentId: string; componentName: string },
  target: { componentId: string; componentName: string },
  existingThreats: ExistingThreatRef[],
  maxChainDepth: number,
): string {
  const threatLines = existingThreats.length
    ? existingThreats
        .map(
          (t) =>
            `- threatRef: ${t.threatRef} | ${t.name}` +
            (t.componentName ? ` (on ${t.componentName})` : ""),
        )
        .join("\n")
    : "(none recorded yet — propose newThreat objects as needed)";
  return (
    `## Architecture\n${summary}\n\n` +
    `## Existing threats (reuse these threatRefs where they fit)\n${threatLines}\n\n` +
    `## Task\n` +
    `Entry point: ${entry.componentName} (id: ${entry.componentId})\n` +
    `Target asset: ${target.componentName} (id: ${target.componentId})\n\n` +
    `Generate up to 3 candidate attack chains from the entry point to the target, ` +
    `each at most ${maxChainDepth} hops, every hop carrying preconditions + yields. ` +
    `Return the JSON array now.`
  );
}

// --- Pass 4: secondary review of code-validated survivors -----------------------------
//
// Pass-4 topology/capability validation is CODE (chain-validator.ts). Only the
// chains that survive that check reach the LLM — this prompt is a
// secondary LLM judgement on top of that check. The model returns
// one VerdictZ per chain (threatRef = the chain NAME it was shown) so a chain it
// finds implausible (REFUTED, high confidence) can be dropped too. It can NEVER
// resurrect a chain the code check already rejected — those are not shown.

export const CHAIN_REVIEW_SYSTEM_PROMPT = `You are a senior red-team reviewer doing a SANITY CHECK on attack chains that have ALREADY passed an automated topology + capability check. Your job is only to catch chains that are technically connected but make no real-world attacker sense (e.g. the hops contradict each other, the path is absurdly indirect, or the exploited threats could not realistically yield what the chain claims).

Be conservative: these chains already passed code validation, so REFUTE only when a chain is clearly implausible. When in doubt, mark UNCERTAIN or CONFIRMED.

## Output (STRICT)
Return ONLY a JSON array, one verdict object per chain, echoing the chain's name verbatim as "threatRef":
[
  { "threatRef": "<chain name, echoed exactly>", "verdict": "CONFIRMED|REFUTED|UNCERTAIN", "refutationReason": "<one sentence if REFUTED>", "confidence": 0.0 }
]
confidence is 0.0–1.0. No prose, no markdown fences, no commentary outside the array.`;

export function buildChainReviewUserPrompt(
  context: ThreatModelContext,
  chains: Array<{
    name: string;
    description: string;
    hops: Array<{ componentId: string; description: string }>;
  }>,
): string {
  const byId = new Map(context.components.map((c) => [c.id, c.name]));
  const chainBlocks = chains
    .map((c) => {
      const hops = c.hops
        .map(
          (h, i) =>
            `    ${i + 1}. ${byId.get(h.componentId) ?? h.componentId}: ${h.description}`,
        )
        .join("\n");
      return `- name: ${c.name}\n  summary: ${c.description}\n  hops:\n${hops}`;
    })
    .join("\n");
  return (
    `## Architecture\n${buildAttackChainSummary(context)}\n\n` +
    `## Chains to review (all already passed automated topology validation)\n${chainBlocks}\n\n` +
    `Return one verdict per chain now, echoing each chain name exactly as the threatRef.`
  );
}

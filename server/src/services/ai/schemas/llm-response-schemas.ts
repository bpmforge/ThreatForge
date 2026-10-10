/**
 * Zod schemas for LLM-emitted JSON.
 *
 * All parsers in the AI pipeline must validate against these — no raw casts.
 * Validation failures produce structured ParseFailure records so the job UI
 * can show what was dropped.
 */
import { z } from "zod";

const SeverityZ = z.enum(["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"]);

const EvidenceZ = z
  .object({
    cwe: z.string().optional(),
    owasp: z.string().optional(),
    compliance: z.string().optional(),
    attackPath: z.union([z.string(), z.array(z.string())]).optional(),
  })
  .passthrough();

const SuggestedRequirementZ = z.object({
  text: z.string().min(1),
  category: z
    .enum(["security", "functional", "compliance", "privacy", "performance"])
    .optional(),
});

export const MitigationZ = z.object({
  description: z.string().min(1),
  controlCategory: z.string().optional(),
  testCriteria: z.string().optional(),
  effort: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
  effectiveness: z
    .union([z.string(), z.number()])
    .transform((v) => Math.min(parseFloat(String(v)), 0.85))
    .optional(),
  suggestedRequirement: SuggestedRequirementZ.nullish(),
});

export const ThreatZ = z
  .object({
    name: z.string().min(1).optional(),
    title: z.string().min(1).optional(),
    description: z.string().min(1),
    category: z.string().optional(),
    severity: SeverityZ.default("MEDIUM"),
    cweIds: z.array(z.string()).optional(),
    owaspIds: z.array(z.string()).optional(),
    evidence: EvidenceZ.optional(),
    mitigations: z.array(MitigationZ).optional(),
    mitigation: MitigationZ.optional(),
    confidence: z.number().min(0).max(1).optional(),
  })
  .refine((t) => t.name || t.title, {
    message: "Threat must have either name or title",
  });

export const ThreatArrayZ = z.array(ThreatZ);
export const MitigationArrayZ = z.array(MitigationZ);

/**
 * Adversarial refutation verdict from the Verifier stage.
 * See ARCHITECTURE §2.4. One per challenged threat. `threatRef` is the
 * stable `normalizedName::targetKey` handle the prompt is asked to echo back
 * so verdicts can be matched to threats without leaking DB ids.
 */
const VerdictZ = z.object({
  threatRef: z.string().min(1),
  verdict: z.enum(["CONFIRMED", "REFUTED", "UNCERTAIN"]),
  refutationReason: z.string().optional(),
  confidence: z.number().min(0).max(1),
});

export const VerdictArrayZ = z.array(VerdictZ);

/**
 * Attack-chain Pass 1 — entry-point detection.
 * One per external-facing component an attacker can reach without auth.
 * `componentId` is validated against the model's topology by the stage handler
 * (hallucinated ids are dropped and counted as parseFailures, never trusted).
 */
const EntryPointZ = z.object({
  componentId: z.string().min(1),
  justification: z.string().min(1),
  /** 0.0–1.0 — how reachable/exposed this entry point is. */
  exposure: z.number().min(0).max(1).optional(),
});

export const EntryPointArrayZ = z.array(EntryPointZ);

/**
 * Attack-chain Pass 2 — target-asset detection.
 * One per high-value component (sensitive data / valuable capability). Same
 * topology validation as EntryPointZ.
 */
const TargetAssetZ = z.object({
  componentId: z.string().min(1),
  justification: z.string().min(1),
  /** 0.0–1.0 — asset value to a threat actor. */
  value: z.number().min(0).max(1).optional(),
});

export const TargetAssetArrayZ = z.array(TargetAssetZ);

/**
 * Capability-token vocabulary (ARCHITECTURE §2.5). Each attack-chain hop lists
 * the `preconditions` it needs and the `yields` it grants, drawn from this set.
 * `data:read:<classification>` is parameterised (e.g. `data:read:RESTRICTED`);
 * the rest are fixed strings. Pass-4 validates a chain by checking each
 * hop's preconditions ⊆ {entry assumptions} ∪ yields(prior hops). The vocabulary
 * is advisory at parse time (free-form tokens are accepted so a model can be
 * specific), but the prompt steers the LLM to these tokens so Pass-4 can reason.
 */
export const CAPABILITY_TOKENS = [
  "network:public",
  "network:internal",
  "creds:user",
  "creds:admin",
  "creds:service",
  "code-exec",
  "data:read:<classification>",
  "data:write",
] as const;

/**
 * Attack-chain Pass 3 — a single hop.
 * See ARCHITECTURE §2.5. `componentId` is validated against topology by the stage
 * handler (hallucinated ids drop the whole chain). `threatRef` is the stable
 * `targetKey::normalizedName` handle of the threat exploited at this hop —
 * either an existing threat or, when `newThreat` is present, a threat the LLM
 * proposes that the stage persists AI_SUGGESTED through the normal dedup path
 * (ADR-006) and then resolves to a real threatId. `preconditions`/`yields`
 * carry the §2.5 capability tokens.
 */
const HopZ = z.object({
  componentId: z.string().min(1),
  /** Stable handle of the exploited threat (existing or newly proposed). */
  threatRef: z.string().min(1),
  description: z.string().min(1),
  technique: z.string().optional(),
  preconditions: z.array(z.string()).default([]),
  yields: z.array(z.string()).default([]),
  /** Connection traversed at this hop, if it is a data-flow traversal. */
  connectionId: z.string().nullish(),
  /** Trust boundary crossed at this hop (null = none). */
  traversedBoundaryId: z.string().nullish(),
  /**
   * When set, this hop exploits a threat NOT yet in the model. The stage
   * persists it AI_SUGGESTED via the dedup path and rewrites threatRef to the
   * resulting handle. Mirrors the ThreatZ minimal shape the persist path takes.
   */
  newThreat: z
    .object({
      name: z.string().min(1),
      description: z.string().min(1),
      category: z.string().optional(),
      severity: SeverityZ.default("MEDIUM"),
    })
    .optional(),
});

/**
 * Attack-chain Pass 3 — a candidate chain. One end-to-end path from an
 * entry point to a target asset. NOT yet topology/capability validated — that
 * is Pass 4. `severity` is the LLM's pre-validation estimate.
 */
const ChainZ = z.object({
  entryPointId: z.string().min(1),
  targetAssetId: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  severity: SeverityZ.default("MEDIUM"),
  likelihood: z.number().min(0).max(1).optional(),
  hops: z.array(HopZ).min(1),
});

export const ChainArrayZ = z.array(ChainZ);
export type VerdictZShape = z.infer<typeof VerdictZ>;
export type EntryPointZShape = z.infer<typeof EntryPointZ>;
export type TargetAssetZShape = z.infer<typeof TargetAssetZ>;
export type HopZShape = z.infer<typeof HopZ>;
export type ChainZShape = z.infer<typeof ChainZ>;

/**
 * Structured result from a validated parse — valid records plus failures.
 */
export interface ParseOutcome<T> {
  valid: T[];
  failed: Array<{ index: number; error: string; raw: unknown }>;
}

/**
 * Validate each element of a raw array against a Zod element schema.
 * Valid items are returned typed; failed items carry their error and
 * raw value for logging/observability.
 */
export function safeParseArray<T>(
  schema: z.ZodArray<z.ZodType<T>>,
  raw: unknown,
): ParseOutcome<T> {
  if (!Array.isArray(raw)) {
    return { valid: [], failed: [{ index: -1, error: "Not an array", raw }] };
  }
  const valid: T[] = [];
  const failed: ParseOutcome<T>["failed"] = [];
  for (let i = 0; i < raw.length; i++) {
    const result = schema.element.safeParse(raw[i]);
    if (result.success) {
      valid.push(result.data);
    } else {
      failed.push({
        index: i,
        error: result.error.message,
        raw: raw[i],
      });
    }
  }
  return { valid, failed };
}

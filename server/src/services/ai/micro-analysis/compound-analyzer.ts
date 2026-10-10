/**
 * Compound Analyzer
 *
 * After all individual components are analyzed, this finds threats
 * that SPAN multiple components — attack chains where compromising
 * component A lets you reach component B via component C.
 *
 * Phase 1: Rule-based graph traversal (attack-chain-analyzer)
 * Phase 2: LLM reasoning about compound threats (optional)
 */
import { analyzeAttackChains } from "../../threat-generation/attack-chain-analyzer.js";
import { extractJsonArray } from "../response-parsers.js";
import type { AICallFn, MicroThreat, ParseFailure } from "./types.js";
import {
  safeParseArray,
  ThreatArrayZ,
} from "../schemas/llm-response-schemas.js";
import { stripCitationTags } from "../../citation/citation-grammar.js";
import logger from "../../../utils/logger.js";

/**
 * Sentinel stored as `componentNodeId`/`componentId` for a threat that spans
 * multiple components rather than naming one. Mirrored by the topology check
 * in stages/verifier-checks.ts (`COMPOUND_COMPONENT_SENTINEL`) and by the
 * canvas-sync orphan sweep, which must not delete it just because no
 * canvas node is ever literally named "compound".
 */
export const COMPOUND_COMPONENT_SENTINEL = "compound";

/**
 * Sentinel componentId for dependency / supply-chain threats emitted by
 * supplemental-threats.ts. Like the compound sentinel it is not a canvas node,
 * so the topology check and the canvas-sync orphan sweep must both allow it.
 */
export const SUPPLY_CHAIN_COMPONENT_SENTINEL = "supply-chain";

const COMPOUND_SYSTEM_PROMPT = `You are a security architect looking for COMPOUND threats — where individual component vulnerabilities CHAIN TOGETHER to create a bigger risk than any single finding.

Rules:
- Each compound threat must involve 2+ components
- Describe the step-by-step attack path across components
- The compound severity should be HIGHER than any individual finding
- Return 2-4 compound threats as a JSON array. No markdown, no code fences.`;

/**
 * Analyze cross-component attack chains and compound threats.
 */
export async function analyzeCompoundThreats(
  aiCall: AICallFn | undefined,
  components: Array<{
    id: string;
    name: string;
    type: string;
    trustLevel?: string;
  }>,
  connections: Array<{
    source: string;
    target: string;
    protocol?: string;
    encrypted?: boolean;
    authMethod?: string;
  }>,
  perComponentThreats: MicroThreat[],
): Promise<{
  attackChains: ReturnType<typeof analyzeAttackChains>;
  compoundThreats: MicroThreat[];
  parseFailures: ParseFailure[];
}> {
  const parseFailures: ParseFailure[] = [];

  // --- Phase 1: Rule-based attack chains (no LLM) ---
  const attackChains = analyzeAttackChains(components, connections);

  logger.info(
    { chains: attackChains.length },
    "Attack chain analysis complete",
  );

  // --- Phase 2: LLM compound reasoning (optional) ---
  if (!aiCall || perComponentThreats.length < 3) {
    return { attackChains, compoundThreats: [], parseFailures };
  }

  // Summarize findings for the LLM (keep it small)
  const threatSummary = perComponentThreats
    .slice(0, 20)
    .map(
      (t) => `- [${t.componentName}] ${t.name} (${t.category}, ${t.severity})`,
    )
    .join("\n");

  const chainSummary =
    attackChains.length > 0
      ? attackChains
          .slice(0, 5)
          .map(
            (c) =>
              `- ${c.name}: ${c.steps.map((s) => s.componentName).join(" → ")}`,
          )
          .join("\n")
      : "No rule-based attack chains found";

  // Don't include raw DB IDs in the prompt — the LLM tends to parrot them
  // back into threat descriptions, producing unreadable output like
  // "sends to cmoc3p7nh000907qlizl9gdzl". Names + types are enough for
  // compound reasoning.
  const componentList = components
    .map((c) => `- ${c.name} (${c.type})`)
    .join("\n");

  const userPrompt = `## System Components
${componentList}

## Individual Findings (${perComponentThreats.length} total)
${threatSummary}

## Attack Chains (graph-based)
${chainSummary}

## Task
Identify 2-4 COMPOUND threats where individual findings chain together across components. Each must span 2+ components.

Return as JSON array:
[{"name":"Compound threat title","description":"How threats chain: step 1 in component A enables step 2 in component B","category":"ELEVATION_OF_PRIVILEGE","severity":"CRITICAL|HIGH","evidence":{"attackPath":"A → B → C step by step"},"mitigation":{"description":"How to break the chain","effort":"MEDIUM","effectiveness":"0.45"},"confidence":0.8}]`;

  try {
    const raw = await aiCall(COMPOUND_SYSTEM_PROMPT, userPrompt, "compound");
    const arr = extractJsonArray(raw);
    if (!arr || arr.length === 0) {
      return { attackChains, compoundThreats: [], parseFailures };
    }

    // The model sometimes emits the singular "mitigation" (or a stray entry
    // inside "mitigations") as a bare string rather than the object the
    // schema expects. Normalise those to { description } before validation
    // so real mitigation text isn't dropped as a parse failure.
    const normalized = arr.map((item) => normalizeMitigationShapes(item));

    const outcome = safeParseArray(ThreatArrayZ, normalized);
    if (outcome.failed.length > 0) {
      logger.warn(
        { failed: outcome.failed.length },
        "Discarded malformed compound threats from LLM output",
      );
      for (const f of outcome.failed) {
        parseFailures.push({
          stage: "compound",
          index: f.index,
          error: f.error,
        });
      }
    }

    const compoundThreats: MicroThreat[] = outcome.valid.map((t) => ({
      name: (t.name ?? t.title) || "Compound threat",
      description: stripCitationTags((t.description as string) || ""),
      category: (t.category as string) || "ELEVATION_OF_PRIVILEGE",
      severity: ((t.severity as string) || "HIGH") as MicroThreat["severity"],
      componentId: COMPOUND_COMPONENT_SENTINEL,
      componentName: "Cross-Component",
      cweIds: Array.isArray(t.cweIds)
        ? (t.cweIds as string[]).filter((id: string) => /^CWE-\d+$/i.test(id))
        : [],
      owaspIds: Array.isArray(t.owaspIds)
        ? (t.owaspIds as string[]).filter((id: string) =>
            /^A\d{2}:\d{4}$/i.test(id),
          )
        : [],
      evidence: {
        attackPath:
          ((t.evidence as Record<string, unknown>)?.attackPath as string) || "",
      },
      ...buildCompoundMitigations(t),
      confidence: typeof t.confidence === "number" ? t.confidence : 0.7,
      sourceMethodology: "compound",
    }));

    logger.info(
      { compounds: compoundThreats.length },
      "Compound threat analysis complete",
    );
    return { attackChains, compoundThreats, parseFailures };
  } catch (err) {
    logger.warn({ err }, "Compound analysis LLM call failed");
    return { attackChains, compoundThreats: [], parseFailures };
  }
}

/**
 * Pre-schema normalisation: the model sometimes emits the singular
 * "mitigation" field — or entries inside a "mitigations" array — as a bare
 * string instead of the { description, ... } object ThreatZ/MitigationZ
 * expect. Coerce those to objects so genuine mitigation text survives
 * schema validation instead of being dropped as a parse failure.
 */
function normalizeMitigationShapes(item: unknown): unknown {
  if (!item || typeof item !== "object") return item;
  const out: Record<string, unknown> = { ...(item as Record<string, unknown>) };

  if (typeof out.mitigation === "string") {
    out.mitigation = { description: out.mitigation };
  }
  if (Array.isArray(out.mitigations)) {
    out.mitigations = out.mitigations.map((m) =>
      typeof m === "string" ? { description: m } : m,
    );
  }
  return out;
}

/**
 * Builds the mitigations[] / (deprecated) mitigation shape for a compound
 * threat from schema-validated LLM output.
 *
 * Precedence: plural `mitigations[]` when present, else the singular
 * `mitigation` object, else — genuinely nothing offered — an empty array.
 * Never falls back to placeholder text; "Break the attack chain" was a
 * stand-in that ended up shipping to users as if it were real guidance.
 */
function buildCompoundMitigations(
  t: Record<string, unknown>,
): Pick<MicroThreat, "mitigations" | "mitigation"> {
  const rawPlural = Array.isArray(t.mitigations)
    ? (t.mitigations as Record<string, unknown>[])
    : undefined;
  const rawSingular = t.mitigation as Record<string, unknown> | undefined;

  const toEntry = (m: Record<string, unknown>) => ({
    description: stripCitationTags((m.description as string) || ""),
    controlCategory: (m.controlCategory as string) || "ACCESS_CONTROL",
    testCriteria: (m.testCriteria as string) || "Verify chain is broken",
    effort: (m.effort as string) || "MEDIUM",
    effectiveness: String(m.effectiveness ?? "0.45"),
  });

  let mitigations: MicroThreat["mitigations"];
  if (rawPlural && rawPlural.length > 0) {
    mitigations = rawPlural.map(toEntry);
  } else if (rawSingular?.description) {
    mitigations = [toEntry(rawSingular)];
  } else {
    mitigations = [];
  }

  const first = mitigations[0];
  const mitigation: MicroThreat["mitigation"] = first
    ? {
        description: first.description,
        effort: first.effort,
        effectiveness: first.effectiveness,
      }
    : { description: "", effort: "MEDIUM", effectiveness: "0.45" };

  return { mitigations, mitigation };
}

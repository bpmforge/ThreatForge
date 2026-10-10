/**
 * Component Analyzer
 *
 * Orchestrates all categories for a single component.
 * 1. [NO LLM] Research: OWASP, CWE, compliance lookup
 * 2. [NO LLM] Rule-based STRIDE seed threats
 * 3. [LLM] Per-category analysis with reference data injection
 */
import {
  analyzeComponentRules,
  type ComponentContext,
} from "../../threat-generation/context-aware-pipeline.js";
import { researchThreats } from "../../threat-generation/threat-research.js";
import { lookupCategoryReferences } from "./reference-lookup.js";
import { inferSecurityRole, type RoleInference } from "./role-inference.js";
import {
  analyzeCategoryChunk,
  chunkCategories,
} from "./category-chunk-analyzer.js";
import type {
  AICallFn,
  MicroThreat,
  MicroAnalysisOptions,
  ParseFailure,
} from "./types.js";
import {
  STRIDE_CATEGORIES,
  PASTA_CATEGORIES,
  KILL_CHAIN_STAGES,
  MITRE_ATTACK_TACTICS,
} from "./types.js";
import logger from "../../../utils/logger.js";

/**
 * Analyze one component across all categories for a given methodology.
 * Returns all threats found for this component.
 */
export async function analyzeComponent(
  aiCall: AICallFn,
  component: ComponentContext,
  methodology: string,
  options: MicroAnalysisOptions,
  sequenceFlows?: Array<{
    from: string;
    to: string;
    label: string;
    protocol?: string;
    authentication?: string;
  }>,
): Promise<{
  threats: MicroThreat[];
  llmCalls: number;
  parseFailures: ParseFailure[];
  /** Set when this component's canvas type carried no reference data and a
   *  security role was inferred. Always surfaced — never applied silently. */
  roleInference?: RoleInference;
}> {
  const report = options.onProgress || (() => {});
  let llmCalls = 0;
  const parseFailures: ParseFailure[] = [];

  // Reference tables are keyed by SECURITY ROLE, the canvas records what the
  // user DREW. An auth service modelled as a MICROSERVICE reaches no auth
  // reference data at all. Infer a role to fill that gap — and return the
  // inference so a guess is never mistaken for a declared fact.
  const roleInference = inferSecurityRole({
    id: component.id,
    name: component.name,
    type: component.type,
    description: component.description,
    dataTypes: component.dataTypes,
    technologyVersion: component.technologyVersion,
  });
  const effectiveType = roleInference?.inferredRole ?? component.type;

  // --- Phase 1: Research (no LLM) ---
  const research = await researchThreats({
    componentType: effectiveType,
    dataTypes: component.dataTypes,
    complianceFrameworks: component.complianceFrameworks,
    technologyVersion: component.technologyVersion,
  });

  // --- Phase 2: Rule-based seeds (no LLM) ---
  const ruleBasedThreats = analyzeComponentRules(component);

  logger.debug(
    {
      component: component.name,
      owasp: research.owasp.length,
      cwes: research.cwes.length,
      ruleThreats: ruleBasedThreats.length,
    },
    "Component research complete",
  );

  // --- Phase 3: Per-category LLM analysis ---
  const allCategories = getCategoriesForMethodology(methodology);
  const categories = options.categories?.length
    ? allCategories.filter((c) => options.categories!.includes(c))
    : allCategories;
  const allThreats: MicroThreat[] = [];
  const unknownCategories = (options.categories ?? []).filter(
    (c) => !allCategories.includes(c),
  );
  if (unknownCategories.length > 0) {
    logger.warn(
      { component: component.name, methodology, unknownCategories },
      "Ignoring categories not defined for this methodology",
    );
  }

  // One call per fixed chunk of categories (STRIDE → [S,T,R] [I,D,E]).
  // The partition is taken over the FULL category list and filtered after, so
  // it never depends on the data; a single-category retry becomes a chunk of
  // one and runs the unchanged single-category path.
  let chunkFallbacks = 0;
  for (const chunkCats of chunkCategories(allCategories)) {
    const chunk = chunkCats
      .filter((category) => categories.includes(category))
      .map((category) => {
        report("category", `${component.name} → ${category} (${methodology})`);
        return {
          category,
          refs: lookupCategoryReferences(
            effectiveType,
            category,
            research,
            ruleBasedThreats,
          ),
          // Prior-pass refuted threats for THIS (component, category).
          refutedThreats:
            options.refutedThreats?.[`${component.id}::${category}`],
        };
      });
    if (chunk.length === 0) continue;

    const { results, llmCalls: chunkCalls } = await analyzeCategoryChunk(
      aiCall,
      component,
      methodology,
      chunk,
      {
        minConfidence: options.minCategoryConfidence,
        maxLoops: options.maxCategoryLoops,
        retrySleep: options.retrySleep,
      },
      sequenceFlows,
    );
    llmCalls += chunkCalls;

    for (const r of results) {
      parseFailures.push(...r.parseFailures);
      allThreats.push(...r.threats);
      if (r.fellBack && chunk.length > 1) chunkFallbacks++;
      logger.debug(
        {
          component: component.name,
          category: r.category,
          threats: r.threats.length,
          fellBack: r.fellBack,
        },
        "Category analysis complete",
      );
    }
  }
  if (chunkFallbacks > 0) {
    logger.warn(
      { component: component.name, chunkFallbacks },
      "Categories fell back from the chunked call to single-category calls",
    );
  }

  report(
    "component",
    `${component.name}: ${allThreats.length} threats across ${categories.length} categories`,
  );

  return {
    threats: allThreats,
    llmCalls,
    parseFailures,
    ...(roleInference ? { roleInference } : {}),
  };
}

/** Categories analysed per component for the given methodology. */
export function getCategoriesForMethodology(
  methodology: string,
): readonly string[] {
  switch (methodology) {
    case "pasta":
      return PASTA_CATEGORIES;
    case "kill_chain":
      return KILL_CHAIN_STAGES;
    case "mitre_attack":
      return MITRE_ATTACK_TACTICS;
    default:
      return STRIDE_CATEGORIES;
  }
}

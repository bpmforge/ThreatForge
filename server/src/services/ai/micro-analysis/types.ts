/**
 * Micro-Analysis Types
 *
 * Shared types for the per-component, per-category analysis system.
 */
import type { GenerationStage } from "../generation-settings.js";
import type { ThreatTemplate } from "../../../data/threat-libraries/index.js";
import type {
  OWASPCategory,
  CWEEntry,
  ComplianceRequirement,
} from "../../threat-generation/threat-research.js";
import type { GeneratedThreat } from "../../threat-generation/stride-analyzer.js";
import type { AttackChain } from "../../threat-generation/attack-chain-analyzer.js";
import { DEFAULT_MIN_PERSIST_CONFIDENCE } from "./confidence-floor.js";

/** Simple AI call function — decoupled from provider abstraction */
export type AICallFn = (
  systemPrompt: string,
  userPrompt: string,
  /** Names the stage so the caller can apply its generation settings. */
  stage?: GenerationStage,
) => Promise<string>;

/** Reference data injected into each micro-prompt */
export interface CategoryReferenceData {
  /** Threat templates from libraries, filtered to this component type + category */
  threatTemplates: ThreatTemplate[];
  /** CWE entries relevant to this STRIDE category */
  cwes: CWEEntry[];
  /** OWASP entries relevant to this component type */
  owaspEntries: OWASPCategory[];
  /** Compliance requirements for this component */
  complianceReqs: ComplianceRequirement[];
  /** Rule-based seed threats from stride-analyzer, filtered to this category */
  ruleBasedSeeds: GeneratedThreat[];
}

/** A single threat from micro-analysis */
export interface MicroThreat {
  name: string;
  description: string;
  category: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  componentId: string;
  componentName: string;
  /** CWE IDs for this threat (e.g., ["CWE-287", "CWE-384"]) */
  cweIds: string[];
  /** OWASP IDs for this threat (e.g., ["A07:2021", "A03:2021"]) */
  owaspIds: string[];
  /** Real CVE IDs from OSV enrichment (e.g., ["CVE-2021-44228"]); drives EPSS calibration. */
  cveIds?: string[];
  evidence: {
    owasp?: string; // Legacy single OWASP — prefer owaspIds
    cwe?: string; // Legacy single CWE — prefer cweIds
    compliance?: string;
    attackPath?: string;
    /**
     * Duplicate guard (services/ai/dedup): threats merged INTO this one.
     * Their names are kept so a reviewer (and name-based recall checks) can
     * still see what was folded in.
     */
    mergedDuplicates?: Array<{ name: string; category: string; score: number }>;
    /**
     * Duplicate guard: review-band look-alikes the detector would not merge
     * on its own. Stored with the threat so the UI can surface them later.
     */
    possibleDuplicates?: Array<{
      name: string;
      componentId: string;
      score: number;
    }>;
  };
  mitigations: Array<{
    description: string;
    controlCategory: string;
    testCriteria: string;
    effort: string;
    effectiveness: string;
    /** LLM-proposed requirement to close a traceability gap (null when [req:...] tag already applies). */
    suggestedRequirement?: { text: string; category?: string } | null;
  }>;
  /** @deprecated Use mitigations[] array instead */
  mitigation: {
    description: string;
    effort: string;
    effectiveness: string;
  };
  confidence: number;
  sourceMethodology: string;
}

/** A single LLM output record that failed schema validation */
export interface ParseFailure {
  stage:
    | "threat-generation"
    | "mitigation-generation"
    | "compound"
    | "calibration"
    // Attack-chain passes — entry-point / target-asset detection.
    // A hallucinated component id that survived schema parse but is absent from
    // the model's topology is recorded here (dropped, never trusted).
    | "attack-chain"
    // The provider call itself exhausted retries (transient failure
    // never recovered), as opposed to "threat-generation" which covers a
    // successful call whose JSON failed schema validation. Kept distinct so
    // pipeline.ts can tell "the provider is down" from "the model returned
    // odd JSON this one time" — only the former fails the whole run.
    | "provider-failure"
    // review-service.ts's MAX_THREATS_PER_COMPONENT_PER_RUN
    // refused to write the whole batch (success-shaped { skipped: n }).
    // pipeline.ts records this so the batch is visible as a failure for
    // this component rather than silently counted as COMPLETED.
    | "component-cap";
  component?: string;
  category?: string;
  index: number;
  error: string;
}

/** Final result from the full pipeline */
export interface MicroAnalysisResult {
  threats: MicroThreat[];
  attackChains: AttackChain[];
  compoundThreats: MicroThreat[];
  parseFailures: ParseFailure[];
  summary: {
    totalThreats: number;
    componentsAnalyzed: number;
    categoriesPerComponent: number;
    categoryCoverage: Record<string, number>;
    componentsCovered: number;
    totalComponents: number;
    llmCalls: number;
    duration: number;
    skippedComponentCount: number;
    /** True when the wall-clock budget stopped the loop early. Absent on a full run. */
    deadlineStopped?: boolean;
    parseFailures: number;
    /**
     * Count of threats dropped by the persistence-time confidence
     * floor (aiConfidence below `minPersistConfidence`). Template threats
     * (supply-chain/ML) are never dropped. Optional (not every summary
     * builder in this codebase runs the floor) — 0 when nothing was
     * dropped, absent only for summaries built outside pipeline.ts.
     */
    droppedLowConfidence?: number;
    /**
     * Challenger-gate (Verifier) outcome counts. Optional — only present
     * when the Verifier stage ran. Drives the "N confirmed · M refuted &
     * removed · K uncertain" line in the job-completion summary.
     */
    verification?: { confirmed: number; uncertain: number; refuted: number };
    /**
     * Components whose canvas type carried no reference data and were analysed
     * as an inferred security role. Present only when at least one fired.
     * Entries with `needsReview` are guesses and must be shown as such — an
     * inferred role changes which weaknesses the model is given, so a wrong one
     * silently points the analysis at the wrong threat class.
     */
    roleInferences?: import("./role-inference.js").RoleInference[];
    /** Prompt/completion tokens summed over the run. Present only when a TokenMeter was passed. */
    tokens?: import("../providers/token-meter.js").TokenTotals;
    /** Duplicate guard counters (services/ai/dedup/duplicate-guard.ts). */
    dedup?: import("../dedup/duplicate-guard.js").DuplicateGuardMetrics;
  };
  /**
   * Duplicate guard detail: merges made, pairs left for review, shared
   * controls, threats linked to existing rows. Additive; capped lists.
   */
  dedup?: import("../dedup/duplicate-guard.js").DuplicateGuardReport;
}

/** Options for the micro-analysis pipeline */
export interface MicroAnalysisOptions {
  /** Meter filled by the caller's AICallFn; its totals go into summary.tokens. */
  tokenMeter?: import("../providers/token-meter.js").TokenMeter;
  methodologies: Array<"stride" | "pasta" | "kill_chain" | "mitre_attack">;
  /** Minimum confidence per category before looping (0-1). Default: 0.7 */
  minCategoryConfidence: number;
  /**
   * Minimum `confidence` a threat must clear to be persisted (0-1).
   * Applied once, right before the final persist, to the deduped set.
   * Template threats (supply-chain/ML) are exempt. Default: see
   * `DEFAULT_MIN_PERSIST_CONFIDENCE` in confidence-floor.ts.
   */
  minPersistConfidence: number;
  /** Max loops per category. Default: 2 */
  maxCategoryLoops: number;
  /** Progress callback — fired between steps */
  onProgress?: (phase: string, detail: string) => void;
  /** Called after each component finishes — persist partial results for resume */
  onCheckpoint?: (
    completedComponentId: string,
    allThreatssoFar: MicroThreat[],
  ) => Promise<void>;
  /** Mutable flag — set .cancelled = true to abort between components */
  cancelSignal?: { cancelled: boolean };
  /**
   * Absolute epoch-ms deadline for the component loop. Checked between
   * components, alongside cancelSignal. Past it the loop STOPS and the run
   * completes with what it has — it does not throw, because a thrown error
   * takes the FAILED path and `cleanupSessionThreats` would delete every
   * component already stream-persisted. Absent → unbounded (previous
   * behaviour). See services/ai/job-deadline.ts.
   */
  deadlineAt?: number;
  /** Resume from a prior checkpoint — skip listed components and seed their threats */
  resumeFrom?: {
    completedComponentIds: Set<string>;
    seedThreats: MicroThreat[];
  };
  /** When true, ignore prior analysisHash and re-analyze every component. */
  force?: boolean;

  /**
   * Injectable backoff sleep for the first-pass provider retry in
   * category-analyzer.ts. Tests thread a near-instant no-op through here;
   * production leaves it unset so with-retry.ts uses its real backoff.
   */
  retrySleep?: (ms: number) => Promise<void>;

  /** Restrict analysis to components with these React Flow nodeIds. Empty/undefined = all. */
  componentNodeIds?: string[];

  /** Restrict analysis to these threat categories (e.g. ["SPOOFING", "TAMPERING"]). Empty/undefined = all. */
  categories?: string[];

  /**
   * Refutation feedback loop: threats the Verifier confidently REFUTED on
   * a prior pass, keyed by `${componentId}::${category}`. When set, the category
   * prompt for that pair carries a "previously refuted — do not re-propose"
   * block so the re-run does not regenerate the same dead threats. Populated
   * only by the Verifier's re-queue path; undefined on a
   * first pass.
   */
  refutedThreats?: Record<string, Array<{ name: string; reason?: string }>>;

  /** Skip threat generation; only regenerate mitigations for existing PENDING threats. */
  mitigationsOnly?: boolean;

  /**
   * Retry-failed-units: when present, the fan-out path analyzes EXACTLY
   * these (componentId, category) pairs (the ones a prior run's children
   * failed on) instead of expanding the full component × category grid. The
   * componentId is the DB component id (matches `ComponentContext.id`).
   */
  retryUnits?: Array<{ componentId: string; category: string }>;

  /**
   * Called after each component's threats are streamed to the DB.
   * Receives the React Flow nodeId and the persist result counts.
   * Useful for driving component-granularity progress bars in the UI.
   */
  onComponentPersisted?: (
    componentNodeId: string,
    persistResult: { created: number; updated: number; skipped: number },
  ) => void;
}

export const DEFAULT_OPTIONS: MicroAnalysisOptions = {
  methodologies: ["stride"],
  minCategoryConfidence: 0.7,
  minPersistConfidence: DEFAULT_MIN_PERSIST_CONFIDENCE,
  maxCategoryLoops: 2,
  force: false,
};

export const STRIDE_CATEGORIES = [
  "SPOOFING",
  "TAMPERING",
  "REPUDIATION",
  "INFORMATION_DISCLOSURE",
  "DENIAL_OF_SERVICE",
  "ELEVATION_OF_PRIVILEGE",
] as const;

export const PASTA_CATEGORIES = [
  "BUSINESS_LOGIC",
  "DATA_EXPOSURE",
  "ACCESS_CONTROL",
  "INJECTION",
  "SUPPLY_CHAIN",
  "INFRASTRUCTURE",
  "INSIDER_THREAT",
  "AVAILABILITY",
] as const;

export const KILL_CHAIN_STAGES = [
  "RECONNAISSANCE",
  "WEAPONIZATION",
  "DELIVERY",
  "EXPLOITATION",
  "INSTALLATION",
  "COMMAND_AND_CONTROL",
  "ACTIONS_ON_OBJECTIVES",
] as const;

export const MITRE_ATTACK_TACTICS = [
  "INITIAL_ACCESS",
  "EXECUTION",
  "PERSISTENCE",
  "PRIVILEGE_ESCALATION",
  "DEFENSE_EVASION",
  "CREDENTIAL_ACCESS",
  "DISCOVERY",
  "LATERAL_MOVEMENT",
  "COLLECTION",
  "EXFILTRATION",
  "IMPACT",
] as const;

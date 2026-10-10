/**
 * Agentic Multi-Framework Threat Analysis
 *
 * Orchestrates parallel threat analysis across multiple frameworks,
 * then consolidates and verifies until confidence threshold is met.
 *
 * Architecture:
 *
 * ┌─────────────────────────────────────────────┐
 * │           FRAMEWORK AGENTS (parallel)        │
 * │  ┌────────┐  ┌────────┐  ┌──────────┐      │
 * │  │ STRIDE │  │ PASTA  │  │Kill Chain│      │
 * │  └───┬────┘  └───┬────┘  └────┬─────┘      │
 * │      └───────────┼────────────┘              │
 * │                  ▼                           │
 * │  ┌──────────────────────────────┐           │
 * │  │ SUPPLY CHAIN + ML Agents    │           │
 * │  └──────────┬───────────────────┘           │
 * │             ▼                                │
 * │  ┌──────────────────────────────┐           │
 * │  │ MITRE ATT&CK Tagging       │           │
 * │  └──────────┬───────────────────┘           │
 * └─────────────┼───────────────────────────────┘
 *               ▼
 * ┌─────────────────────────────────────────────┐
 * │        VERIFICATION & CONFIDENCE GATE        │
 * │  - Deduplicate across frameworks             │
 * │  - Check coverage (all components targeted?) │
 * │  - Check categories (all STRIDE + PASTA?)    │
 * │  - Score < 85%? → Loop with gap report       │
 * │  - Score >= 85%? → Consolidate               │
 * └─────────────────────────────────────────────┘
 */
import { toDigestFindings } from "./expert-analysis.js";
import { buildFindingsDigest } from "./findings-digest.js";
import type {
  AIProviderClient,
  ComponentContext,
  ThreatModelContext,
} from "../../types/ai.js";
import type {
  ExtractionResult,
  ExtractedDependency,
  ExtractedMLComponent,
} from "./extraction-agent.js";
import {
  PASTA_SYSTEM_PROMPT,
  PASTA_ANALYSIS_PROMPT,
  KILL_CHAIN_SYSTEM_PROMPT,
  KILL_CHAIN_ANALYSIS_PROMPT,
  MITRE_ATTACK_SYSTEM_PROMPT,
  MITRE_ATTACK_ANALYSIS_PROMPT,
  SUPPLY_CHAIN_ANALYSIS_PROMPT,
  ML_THREAT_ANALYSIS_PROMPT,
} from "./prompts/methodologies/index.js";
import { THREAT_ANALYSIS_SYSTEM_PROMPT } from "./prompts/threat-prompts.js";
import { buildThreatAnalysisPrompt } from "./prompts/builders.js";
import {
  extractJsonArray,
  extractJsonObject,
  resolveComponentNames,
} from "./response-parsers.js";
import logger from "../../utils/logger.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** System 507 + architecture 687 + digest keeps verification ≲ 4k tokens. */
const AGENTIC_VERIFY_DIGEST_TOKENS = 2500;

export interface AgenticThreat {
  title: string;
  description: string;
  category: string;
  severity: string;
  targetComponentId: string | null;
  targetComponentName?: string | null;
  attackVector: string;
  prerequisites: string;
  mitigation: string;
  mitigationEffectiveness: number;
  residualRisk: string;
  confidence: number;
  references: string[];
  analysisType: string;
  /** Which framework identified this threat */
  sourceFramework: string;
  /** MITRE ATT&CK technique ID if applicable */
  mitreAttackId?: string;
  /** PASTA stage if applicable */
  pastaStage?: number;
  /** Kill chain stage if applicable */
  killChainStage?: string;
  /** Business impact for PASTA */
  businessImpact?: string;
  /** Detection opportunity for Kill Chain */
  detectionOpportunity?: string;
  /** ML attack type if applicable */
  mlAttackType?: string;
  /** Supply chain blast radius if applicable */
  blastRadius?: string;
  /** Verified in consolidation pass */
  verified: boolean;
}

export interface AgenticAnalysisResult {
  threats: AgenticThreat[];
  summary: {
    totalThreats: number;
    frameworksUsed: string[];
    categoryCoverage: Record<string, number>;
    componentsCovered: number;
    totalComponents: number;
    confidenceScore: number;
    verificationLoops: number;
    duration: number;
  };
  frameworkResults: Record<string, { threats: number; duration: number }>;
}

export interface AgenticAnalysisOptions {
  /** Which frameworks to run. Default: all applicable */
  frameworks?: Array<
    | "stride"
    | "pasta"
    | "kill_chain"
    | "mitre_attack"
    | "supply_chain"
    | "ml_threats"
  >;
  /** Extraction result (for supply chain and ML analysis) */
  extraction?: ExtractionResult;
  /** Minimum confidence to stop looping (0-100). Default: 85 */
  minConfidence?: number;
  /** Maximum verification loops. Default: 2 */
  maxLoops?: number;
  /** Progress callback */
  onProgress?: (framework: string, status: string, detail?: string) => void;
}

// ---------------------------------------------------------------------------
// Verification Prompt
// ---------------------------------------------------------------------------

export const VERIFICATION_PROMPT = `You are reviewing a consolidated threat assessment from multiple frameworks (STRIDE, PASTA, Kill Chain, MITRE ATT&CK). Your job is to ensure QUALITY and COMPLETENESS.

## Check Each Threat
1. Is it SPECIFIC to this architecture, or generic boilerplate?
2. Is the severity accurate given the actual data sensitivity and exposure?
3. Is the mitigation actionable with technology-specific guidance?
4. Are there DUPLICATE threats across frameworks that should be merged?

## Check Coverage
1. Are ALL high-value components targeted by at least one threat?
2. Are all major STRIDE categories covered (S, T, R, I, D, E)?
3. Are supply chain risks addressed (if dependencies exist)?
4. Are ML/AI risks addressed (if ML components exist)?
5. Are there kill chain gaps — stages with no threats?

## Check Quality
1. Do threats include CWE/MITRE ATT&CK references?
2. Are mitigation effectiveness scores realistic (0.35-0.85)?
3. Do threats chain together logically?

Return as JSON:
\`\`\`json
{
  "approved": ["threat title 1", "threat title 2"],
  "rejected": [{"title": "...", "reason": "generic|duplicate|inapplicable"}],
  "duplicates": [{"keep": "threat A title", "remove": "threat B title", "reason": "same attack vector"}],
  "missing": [
    {"description": "What's missing", "targetComponent": "component name", "suggestedCategory": "STRIDE/PASTA/etc"}
  ],
  "severityAdjustments": [{"title": "...", "current": "HIGH", "suggested": "CRITICAL", "reason": "..."}],
  "componentsCoveredCount": 0,
  "totalComponents": 0,
  "strideCoverage": ["SPOOFING", "TAMPERING"],
  "missingStrideCategories": ["DENIAL_OF_SERVICE"],
  "overallScore": 0-100,
  "gaps": ["summary of each gap"]
}
\`\`\`

Be selective but NOT overly aggressive. Only reject threats that are truly generic boilerplate or clearly wrong for this architecture. Keep threats that are architecture-specific even if imperfect — it's better to have a threat with a weak mitigation than a gap in coverage. A good assessment covers more components and categories, not fewer.`;

// ---------------------------------------------------------------------------
// Pipeline-definition glue — agentic-analysis-v2
// ---------------------------------------------------------------------------
//
// The four parallel framework runners (STRIDE / PASTA / Kill Chain / MITRE)
// plus the supply-chain / ML runners are exposed below as a single
// methodology-parameterized builder + runner so the agentic-analysis-v2
// orchestrator (services/ai/agentic-analysis-v2.ts) drives them through
// seeded PipelineStage rows WITHOUT changing a single prompt byte — output
// matches this legacy path exactly (identical replay-journal
// hashes). The verify loop maps to the Verifier stage slot; its PromptTemplate
// is the verbatim VERIFICATION_PROMPT above (the slot is seeded `optional: true`).

/** agentic-analysis-v2 pipeline name (seeded by scripts/seed-pipelines.ts). */
export const AGENTIC_PIPELINE_NAME = "agentic-analysis-v2";

/** A framework the agentic path can run. */
export type AgenticFramework = NonNullable<
  AgenticAnalysisOptions["frameworks"]
>[number];

/** Stable, well-known PromptTemplate ids for the framework runners + verify. */
export const AGENTIC_TEMPLATE_IDS = {
  stride: "builtin-agentic-stride",
  pasta: "builtin-agentic-pasta",
  kill_chain: "builtin-agentic-kill-chain",
  mitre_attack: "builtin-agentic-mitre-attack",
  supply_chain: "builtin-agentic-supply-chain",
  ml_threats: "builtin-agentic-ml-threats",
  verify: "builtin-agentic-verify",
} as const;

/** Human stage name for each framework runner (PipelineStage.name). */
export const AGENTIC_STAGE_NAMES: Record<AgenticFramework, string> = {
  stride: "StrideRunner",
  pasta: "PastaRunner",
  kill_chain: "KillChainRunner",
  mitre_attack: "MitreAttackRunner",
  supply_chain: "SupplyChainRunner",
  ml_threats: "MlThreatRunner",
};

/** Verify-loop stage slot name (the Verifier handler is not implemented yet). */
export const AGENTIC_VERIFY_STAGE_NAME = "Verify";

/** Max verification loops (legacy default; changing it alters output). */
export const AGENTIC_MAX_LOOPS = 2;

/**
 * Build the (system, user) prompt pair a framework runner sends, verbatim with
 * the legacy runner functions below. The agentic-analysis-v2 orchestrator calls
 * this so its replay-journal hashes match the legacy path exactly. Returns null
 * for supply_chain / ml_threats when the relevant extraction inputs are absent
 * (legacy runners early-return [] in that case — no LLM call is made).
 */
export function buildFrameworkPrompt(
  framework: AgenticFramework,
  context: ThreatModelContext,
  extraction?: ExtractionResult,
): { system: string; user: string } | null {
  switch (framework) {
    case "stride":
      return {
        system: THREAT_ANALYSIS_SYSTEM_PROMPT,
        user: buildThreatAnalysisPrompt(context),
      };
    case "pasta":
      return {
        system: PASTA_SYSTEM_PROMPT,
        user: buildContextPrompt(PASTA_ANALYSIS_PROMPT, context),
      };
    case "kill_chain":
      return {
        system: KILL_CHAIN_SYSTEM_PROMPT,
        user: buildContextPrompt(KILL_CHAIN_ANALYSIS_PROMPT, context),
      };
    case "mitre_attack":
      return {
        system: MITRE_ATTACK_SYSTEM_PROMPT,
        user: buildContextPrompt(MITRE_ATTACK_ANALYSIS_PROMPT, context),
      };
    case "supply_chain": {
      const deps = extraction?.dependencies ?? [];
      if (deps.length === 0) return null;
      return {
        system: MITRE_ATTACK_SYSTEM_PROMPT,
        user: buildSupplyChainPrompt(context, deps),
      };
    }
    case "ml_threats": {
      const ml = extraction?.mlComponents ?? [];
      if (ml.length === 0) return null;
      return {
        system: MITRE_ATTACK_SYSTEM_PROMPT,
        user: buildMLThreatPrompt(context, ml, extraction?.dataFlows ?? []),
      };
    }
  }
}

/** Build the verify-pass (system, user) prompt pair — verbatim legacy shape. */
export function buildVerificationPrompt(
  context: ThreatModelContext,
  threats: AgenticThreat[],
): { system: string; user: string } {
  const contextText = formatContext(context);
  // Compact digest (exact titles kept — verification keys on them).
  const threatsText = buildFindingsDigest(
    toDigestFindings(threats),
    AGENTIC_VERIFY_DIGEST_TOKENS,
  );
  return {
    system: VERIFICATION_PROMPT,
    user: `${contextText}\n\n## Threats to Verify (${threats.length})\n${threatsText}`,
  };
}

/** Parse a verify-pass raw response into the structured VerificationResult. */
export function parseVerificationResult(raw: string): VerificationResult {
  try {
    const parsed = extractJsonObject(raw);
    if (parsed) {
      return {
        overallScore: (parsed.overallScore as number) ?? 70,
        rejected: (parsed.rejected as VerificationResult["rejected"]) ?? [],
        duplicates:
          (parsed.duplicates as VerificationResult["duplicates"]) ?? [],
        missing: (parsed.missing as VerificationResult["missing"]) ?? [],
        severityAdjustments:
          (parsed.severityAdjustments as VerificationResult["severityAdjustments"]) ??
          [],
      };
    }
  } catch {
    // parse failed
  }
  return {
    overallScore: 70,
    rejected: [],
    duplicates: [],
    missing: [],
    severityAdjustments: [],
  };
}

/** Apply one verification result to the running threat list (legacy logic). */
export function applyVerification(
  threats: AgenticThreat[],
  verification: VerificationResult,
): AgenticThreat[] {
  let result = threats;
  if (verification.rejected.length > 0) {
    const rejectedTitles = new Set(
      verification.rejected.map((r) => r.title.toLowerCase()),
    );
    result = result.filter((t) => !rejectedTitles.has(t.title.toLowerCase()));
  }
  if (verification.duplicates.length > 0) {
    const removeTitles = new Set(
      verification.duplicates.map((d) => d.remove.toLowerCase()),
    );
    result = result.filter((t) => !removeTitles.has(t.title.toLowerCase()));
  }
  for (const adj of verification.severityAdjustments) {
    const threat = result.find(
      (t) => t.title.toLowerCase() === adj.title.toLowerCase(),
    );
    if (threat) threat.severity = adj.suggested;
  }
  for (const t of result) t.verified = true;
  return result;
}

/** Public framework selection (re-export of the internal helper). */
export function selectFrameworks(
  context: ThreatModelContext,
  extraction?: ExtractionResult,
): AgenticFramework[] {
  return determineFrameworks(context, extraction) as AgenticFramework[];
}

/** Final consolidation (sort + coverage) — shared by legacy and v2 paths. */
export function consolidateAgentic(
  finalThreats: AgenticThreat[],
  context: ThreatModelContext,
  frameworks: string[],
  confidenceScore: number,
  verificationLoops: number,
  frameworkResults: Record<string, { threats: number; duration: number }>,
  startTime: number,
): AgenticAnalysisResult {
  const severityOrder: Record<string, number> = {
    CRITICAL: 0,
    HIGH: 1,
    MEDIUM: 2,
    LOW: 3,
    INFO: 4,
  };
  finalThreats.sort(
    (a, b) =>
      (severityOrder[a.severity] ?? 5) - (severityOrder[b.severity] ?? 5),
  );

  const componentIds = new Set(context.components.map((c) => c.id));
  const coveredComponents = new Set(
    finalThreats
      .map((t) => t.targetComponentId)
      .filter((id): id is string => id !== null && componentIds.has(id)),
  );
  const allCategories = new Set(finalThreats.map((t) => t.category));
  const categoryCoverage: Record<string, number> = {};
  for (const cat of allCategories) {
    categoryCoverage[cat] = finalThreats.filter(
      (t) => t.category === cat,
    ).length;
  }

  return {
    threats: finalThreats,
    summary: {
      totalThreats: finalThreats.length,
      frameworksUsed: frameworks,
      categoryCoverage,
      componentsCovered: coveredComponents.size,
      totalComponents: context.components.length,
      confidenceScore,
      verificationLoops,
      duration: Date.now() - startTime,
    },
    frameworkResults,
  };
}

// ---------------------------------------------------------------------------
// Main Pipeline
// ---------------------------------------------------------------------------

export async function runAgenticAnalysis(
  client: AIProviderClient,
  context: ThreatModelContext,
  options: AgenticAnalysisOptions = {},
): Promise<AgenticAnalysisResult> {
  const startTime = Date.now();
  const report = options.onProgress || (() => {});
  const minConfidence = options.minConfidence ?? 85;
  const maxLoops = options.maxLoops ?? 2;

  // Determine which frameworks to run
  const frameworks =
    options.frameworks || determineFrameworks(context, options.extraction);

  logger.info({ frameworks }, "Starting agentic analysis");
  report("init", "starting", `Frameworks: ${frameworks.join(", ")}`);

  // --- Phase 1: Run framework agents (sequentially to avoid rate limits) ---
  const allThreats: AgenticThreat[] = [];
  const frameworkResults: Record<
    string,
    { threats: number; duration: number }
  > = {};

  for (const framework of frameworks) {
    const fwStart = Date.now();
    report(framework, "running", "Generating threats...");

    let threats: AgenticThreat[] = [];
    try {
      switch (framework) {
        case "stride":
          threats = await runStrideAgent(client, context);
          break;
        case "pasta":
          threats = await runPastaAgent(client, context);
          break;
        case "kill_chain":
          threats = await runKillChainAgent(client, context);
          break;
        case "mitre_attack":
          threats = await runMitreAttackAgent(client, context);
          break;
        case "supply_chain":
          threats = await runSupplyChainAgent(
            client,
            context,
            options.extraction?.dependencies || [],
          );
          break;
        case "ml_threats":
          threats = await runMLThreatAgent(
            client,
            context,
            options.extraction?.mlComponents || [],
            options.extraction?.dataFlows || [],
          );
          break;
      }
    } catch (err) {
      logger.error({ err, framework }, "Framework agent failed");
      report(
        framework,
        "error",
        `Failed: ${err instanceof Error ? err.message : "unknown"}`,
      );
    }

    const duration = Date.now() - fwStart;
    frameworkResults[framework] = { threats: threats.length, duration };
    allThreats.push(...threats);

    report(
      framework,
      "complete",
      `${threats.length} threats in ${Math.round(duration / 1000)}s`,
    );
  }

  // --- Phase 2: Verification loop ---
  let finalThreats = allThreats;
  let verificationLoops = 0;
  let confidenceScore = 0;

  for (let loop = 0; loop < maxLoops; loop++) {
    verificationLoops++;
    report("verification", "running", `Loop ${loop + 1}/${maxLoops}`);

    const verification = await runVerification(client, context, finalThreats);

    confidenceScore = verification.overallScore;

    // Apply rejections
    if (verification.rejected.length > 0) {
      const rejectedTitles = new Set(
        verification.rejected.map((r) => r.title.toLowerCase()),
      );
      finalThreats = finalThreats.filter(
        (t) => !rejectedTitles.has(t.title.toLowerCase()),
      );
    }

    // Apply deduplication
    if (verification.duplicates.length > 0) {
      const removeTitles = new Set(
        verification.duplicates.map((d) => d.remove.toLowerCase()),
      );
      finalThreats = finalThreats.filter(
        (t) => !removeTitles.has(t.title.toLowerCase()),
      );
    }

    // Apply severity adjustments
    for (const adj of verification.severityAdjustments) {
      const threat = finalThreats.find(
        (t) => t.title.toLowerCase() === adj.title.toLowerCase(),
      );
      if (threat) threat.severity = adj.suggested;
    }

    // Mark verified
    for (const t of finalThreats) {
      t.verified = true;
    }

    report(
      "verification",
      "complete",
      `Score: ${confidenceScore}/100, ${verification.rejected.length} rejected, ${verification.duplicates.length} deduped, ${verification.missing.length} gaps`,
    );

    if (confidenceScore >= minConfidence && verification.missing.length === 0) {
      break;
    }

    // If there are gaps and we have loops left, we could fill them
    // The next loop's verification will check if they were addressed
  }

  // --- Phase 3: Final consolidation (sort by severity + coverage) ---
  const result = consolidateAgentic(
    finalThreats,
    context,
    frameworks,
    confidenceScore,
    verificationLoops,
    frameworkResults,
    startTime,
  );

  logger.info(
    {
      threats: finalThreats.length,
      frameworks: frameworks.length,
      confidence: confidenceScore,
      duration: Date.now() - startTime,
    },
    "Agentic analysis complete",
  );

  return result;
}

// ---------------------------------------------------------------------------
// Framework Selection
// ---------------------------------------------------------------------------

function determineFrameworks(
  context: ThreatModelContext,
  extraction?: ExtractionResult,
): AgenticAnalysisOptions["frameworks"] & string[] {
  const frameworks: string[] = ["stride", "pasta"];

  // Always run kill chain for systems with external exposure
  const hasExternalComponents = context.components.some(
    (c) =>
      c.type === "EXTERNAL_USER" ||
      c.type === "EXTERNAL_SYSTEM" ||
      c.type === "API_GATEWAY",
  );
  if (hasExternalComponents || context.components.length >= 5) {
    frameworks.push("kill_chain");
  }

  // Run MITRE ATT&CK for any system with significant complexity
  if (context.components.length >= 3) {
    frameworks.push("mitre_attack");
  }

  // Supply chain if dependencies exist
  if (extraction?.dependencies && extraction.dependencies.length > 0) {
    frameworks.push("supply_chain");
  }

  // ML threats if ML components exist
  if (extraction?.mlComponents && extraction.mlComponents.length > 0) {
    frameworks.push("ml_threats");
  }

  return frameworks as AgenticAnalysisOptions["frameworks"] & string[];
}

// ---------------------------------------------------------------------------
// Framework Agent Runners
// ---------------------------------------------------------------------------

async function runStrideAgent(
  client: AIProviderClient,
  context: ThreatModelContext,
): Promise<AgenticThreat[]> {
  const userPrompt = buildThreatAnalysisPrompt(context);
  const response = await client.complete({
    messages: [
      { role: "system", content: THREAT_ANALYSIS_SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.3,
    maxTokens: 45000,
  });
  return parseThreats(response.content, "stride", context.components);
}

async function runPastaAgent(
  client: AIProviderClient,
  context: ThreatModelContext,
): Promise<AgenticThreat[]> {
  const userPrompt = buildContextPrompt(PASTA_ANALYSIS_PROMPT, context);
  const response = await client.complete({
    messages: [
      { role: "system", content: PASTA_SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.3,
    maxTokens: 45000,
  });
  return parseThreats(response.content, "pasta");
}

async function runKillChainAgent(
  client: AIProviderClient,
  context: ThreatModelContext,
): Promise<AgenticThreat[]> {
  const userPrompt = buildContextPrompt(KILL_CHAIN_ANALYSIS_PROMPT, context);
  const response = await client.complete({
    messages: [
      { role: "system", content: KILL_CHAIN_SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.3,
    maxTokens: 45000,
  });
  return parseThreats(response.content, "kill_chain");
}

async function runMitreAttackAgent(
  client: AIProviderClient,
  context: ThreatModelContext,
): Promise<AgenticThreat[]> {
  const userPrompt = buildContextPrompt(MITRE_ATTACK_ANALYSIS_PROMPT, context);
  const response = await client.complete({
    messages: [
      { role: "system", content: MITRE_ATTACK_SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.3,
    maxTokens: 45000,
  });
  return parseThreats(response.content, "mitre_attack");
}

/** Build the supply-chain runner user prompt (extracted for v2 reuse). */
function buildSupplyChainPrompt(
  context: ThreatModelContext,
  dependencies: ExtractedDependency[],
): string {
  const depText = dependencies
    .map(
      (d) =>
        `- ${d.name} (${d.type}, ${d.language || "unknown lang"}, risk: ${d.riskLevel})${d.version ? ` v${d.version}` : ""}`,
    )
    .join("\n");

  const extComponents = context.components
    .filter((c) => c.type === "EXTERNAL_SYSTEM")
    .map(
      (c) =>
        `- ${c.name} (${c.type})${c.description ? `: ${c.description}` : ""}`,
    )
    .join("\n");

  return SUPPLY_CHAIN_ANALYSIS_PROMPT.replace(
    "{{systemName}}",
    context.name || "Unnamed System",
  )
    .replace(
      "{{components}}",
      context.components
        .map((c) => `- **${c.name}** [${c.id}] (${c.type})`)
        .join("\n"),
    )
    .replace("{{dependencies}}", depText || "None identified")
    .replace("{{externalIntegrations}}", extComponents || "None identified");
}

async function runSupplyChainAgent(
  client: AIProviderClient,
  context: ThreatModelContext,
  dependencies: ExtractedDependency[],
): Promise<AgenticThreat[]> {
  if (dependencies.length === 0) return [];

  const prompt = buildSupplyChainPrompt(context, dependencies);

  const response = await client.complete({
    messages: [
      { role: "system", content: MITRE_ATTACK_SYSTEM_PROMPT },
      { role: "user", content: prompt },
    ],
    temperature: 0.3,
    maxTokens: 45000,
  });
  return parseThreats(response.content, "supply_chain");
}

/** Build the ML-threat runner user prompt (extracted for v2 reuse). */
function buildMLThreatPrompt(
  context: ThreatModelContext,
  mlComponents: ExtractedMLComponent[],
  dataFlows: ExtractionResult["dataFlows"],
): string {
  const mlText = mlComponents
    .map(
      (m) =>
        `- **${m.name}** [${m.id}] (Framework: ${m.framework || "unknown"}, Type: ${m.modelType || "unknown"})
    Training: ${m.trainingDataDescription || "unknown"}
    Input: ${m.inputFormat || "unknown"} → Output: ${m.outputFormat || "unknown"}
    Attack Surface: ${m.attackSurface.join(", ")}`,
    )
    .join("\n\n");

  const mlIds = new Set(mlComponents.map((m) => m.id));
  const mlFlows = dataFlows
    .filter((f) => mlIds.has(f.sourceId) || mlIds.has(f.targetId))
    .map(
      (f) =>
        `- ${f.sourceId} → ${f.targetId} [${f.protocol || "unknown"}] ${f.encrypted ? "encrypted" : "UNENCRYPTED"}`,
    )
    .join("\n");

  return ML_THREAT_ANALYSIS_PROMPT.replace(
    "{{systemName}}",
    context.name || "Unnamed System",
  )
    .replace("{{mlComponents}}", mlText || "None identified")
    .replace("{{mlDataFlows}}", mlFlows || "No ML-specific flows identified");
}

async function runMLThreatAgent(
  client: AIProviderClient,
  context: ThreatModelContext,
  mlComponents: ExtractedMLComponent[],
  dataFlows: ExtractionResult["dataFlows"],
): Promise<AgenticThreat[]> {
  if (mlComponents.length === 0) return [];

  const prompt = buildMLThreatPrompt(context, mlComponents, dataFlows);

  const response = await client.complete({
    messages: [
      { role: "system", content: MITRE_ATTACK_SYSTEM_PROMPT },
      { role: "user", content: prompt },
    ],
    temperature: 0.3,
    maxTokens: 45000,
  });
  return parseThreats(response.content, "ml_threats");
}

// ---------------------------------------------------------------------------
// Verification
// ---------------------------------------------------------------------------

interface VerificationResult {
  overallScore: number;
  rejected: Array<{ title: string; reason: string }>;
  duplicates: Array<{ keep: string; remove: string; reason: string }>;
  missing: Array<{
    description: string;
    targetComponent?: string;
    suggestedCategory?: string;
  }>;
  severityAdjustments: Array<{
    title: string;
    current: string;
    suggested: string;
    reason: string;
  }>;
}

async function runVerification(
  client: AIProviderClient,
  context: ThreatModelContext,
  threats: AgenticThreat[],
): Promise<VerificationResult> {
  const contextText = formatContext(context);
  // Compact digest (exact titles kept — verification keys on them).
  const threatsText = buildFindingsDigest(
    toDigestFindings(threats),
    AGENTIC_VERIFY_DIGEST_TOKENS,
  );

  const response = await client.complete({
    messages: [
      { role: "system", content: VERIFICATION_PROMPT },
      {
        role: "user",
        content: `${contextText}\n\n## Threats to Verify (${threats.length})\n${threatsText}`,
      },
    ],
    temperature: 0.2,
    maxTokens: 45000,
  });

  return parseVerificationResult(response.content);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildContextPrompt(
  template: string,
  context: ThreatModelContext,
): string {
  const nameById = new Map(context.components.map((c) => [c.id, c.name]));
  const resolveName = (id: string): string =>
    nameById.get(id) || `external (${id.slice(0, 8)})`;

  const components = context.components
    .map(
      (c) =>
        `- **${c.name}** (Type: ${c.type}, Trust: ${c.trustZone || "unset"})${c.description ? `\n  ${c.description}` : ""}`,
    )
    .join("\n");

  const connections = context.connections
    .map(
      (c) =>
        `- ${resolveName(c.source)} → ${resolveName(c.target)} [${c.protocol || "unknown"}] ${c.encrypted ? "encrypted" : "UNENCRYPTED"}${c.label ? ` (${c.label})` : ""}`,
    )
    .join("\n");

  const boundaries = context.boundaries
    .map((b) => `- ${b.name}${b.trustLevel ? ` (${b.trustLevel})` : ""}`)
    .join("\n");

  return template
    .replace("{{systemName}}", context.name || "Unnamed System")
    .replace("{{components}}", components || "None defined")
    .replace("{{connections}}", connections || "None defined")
    .replace("{{boundaries}}", boundaries || "None defined");
}

function formatContext(context: ThreatModelContext): string {
  // Strip raw DB IDs — LLM parrots them into threat descriptions otherwise.
  const nameById = new Map(context.components.map((c) => [c.id, c.name]));
  const resolveName = (id: string): string =>
    nameById.get(id) || `external (${id.slice(0, 8)})`;

  const components = context.components
    .map((c) => `- **${c.name}** (${c.type})`)
    .join("\n");
  const connections = context.connections
    .map(
      (c) =>
        `- ${resolveName(c.source)} → ${resolveName(c.target)} [${c.protocol || "?"}] ${c.encrypted ? "🔒" : "⚠️"}`,
    )
    .join("\n");

  return `## System: ${context.name}\n\n## Components (${context.components.length})\n${components}\n\n## Data Flows (${context.connections.length})\n${connections}`;
}

export function parseThreats(
  raw: string,
  sourceFramework: string,
  components?: Pick<ComponentContext, "id" | "name">[],
): AgenticThreat[] {
  const parsed = extractJsonArray(raw);
  // The STRIDE prompt shows names, not ids; map `targetComponent` back.
  const arr =
    parsed && components
      ? resolveComponentNames(parsed as Record<string, unknown>[], components)
      : parsed;
  if (!arr || arr.length === 0) {
    logger.warn(
      {
        rawLength: raw.length,
        preview: raw.slice(0, 200),
        framework: sourceFramework,
      },
      "No threats parsed from framework agent",
    );
    return [];
  }

  return (arr as Record<string, unknown>[]).map(
    (t): AgenticThreat => ({
      title: (t.title as string) || "Untitled threat",
      description: (t.description as string) || "",
      category: (t.category as string) || "UNKNOWN",
      severity: (t.severity as string) || "MEDIUM",
      targetComponentId: (t.targetComponentId as string) || null,
      targetComponentName: (t.targetComponentName as string) || null,
      attackVector: (t.attackVector as string) || "",
      prerequisites: (t.prerequisites as string) || "",
      mitigation: (t.mitigation as string) || "",
      mitigationEffectiveness:
        typeof t.mitigationEffectiveness === "number"
          ? t.mitigationEffectiveness
          : 0.5,
      residualRisk: (t.residualRisk as string) || "",
      confidence: typeof t.confidence === "number" ? t.confidence : 0.7,
      references: Array.isArray(t.references) ? (t.references as string[]) : [],
      analysisType: (t.analysisType as string) || sourceFramework,
      sourceFramework,
      mitreAttackId: t.mitreAttackId as string | undefined,
      pastaStage: t.pastaStage as number | undefined,
      killChainStage:
        (t.killChainStage as string) || (t.category as string | undefined),
      businessImpact: t.businessImpact as string | undefined,
      detectionOpportunity: t.detectionOpportunity as string | undefined,
      mlAttackType: t.mlAttackType as string | undefined,
      blastRadius: t.blastRadius as string | undefined,
      verified: false,
    }),
  );
}

/**
 * Seed: `threat-analysis-v2` PromptPipeline + 8 PipelineStage rows (A1-1).
 *
 * Idempotent — running twice changes nothing. The pipeline is matched by
 * name (built-in, org-less); stages are upserted on the (pipelineId, order)
 * unique constraint and updated in place.
 *
 * CODE-BACKED STAGES — no schema change needed:
 * `PipelineStage.promptTemplateId` is a plain String column with NO foreign
 * key relation (see prisma/schema/22-prompts.prisma), so code-backed stages
 * use the sentinel `handler:<StageName>`. The unified executor (A1-4)
 * dispatches these rows to the stage registry handler with the same name
 * (server/src/services/ai/stages/registry.ts) instead of preparePrompt().
 * The legacy pipeline-service path is never pointed at this pipeline.
 *
 * MAPPING DECISIONS (where ARCHITECTURE §2.1 doesn't pin a detail, this uses
 * the simplest shape pipeline-service's resolveVariables supports —
 * `{ varName: { source: <stageId>|"input", field } }`):
 * - ArchitectureReader has an empty inputMapping: it derives everything from
 *   StageContext.threatModelId (executionId/orgId/sessionId ride on ctx too).
 * - StrideClassifier is conditional on methodology === "STRIDE" (flattened
 *   condition key `<architectureReaderStageId>.methodology`). Because a
 *   skipped stage produces no output, MitigationSynthesizer maps BOTH
 *   `threats` (EvidenceEnricher) and `classifiedThreats` (StrideClassifier);
 *   its handler prefers classifiedThreats when present.
 * - Every stage lists `parseFailures` in outputFields — StageResult always
 *   carries it (empty array for non-LLM stages).
 * - Verifier is seeded `optional: false` (A4-1): its handler is the
 *   adversarial challenger gate (topology → citation → refutation).
 *
 * Run: npm run seed:pipelines
 */
import type { Prisma, PrismaClient } from "@prisma/client";
import {
  THREAT_ANALYSIS_STAGE_NAMES,
  type StageName,
} from "../src/services/ai/stages/registry.js";
import {
  EXPERT_PASS_PROMPTS,
  EXPERT_PASS_TEMPLATE_IDS,
  EXPERT_PIPELINE_NAME,
} from "../src/services/ai/expert-analysis.js";
import {
  AGENTIC_PIPELINE_NAME,
  AGENTIC_STAGE_NAMES,
  AGENTIC_TEMPLATE_IDS,
  AGENTIC_VERIFY_STAGE_NAME,
  VERIFICATION_PROMPT,
  buildFrameworkPrompt,
  type AgenticFramework,
} from "../src/services/ai/agentic-analysis.js";

export const PIPELINE_NAME = "threat-analysis-v2";

/**
 * A6-1 loop-until-dry discovery config (§2.6) — the pipeline-definition default.
 * Seeded as mode "single" (loop-until-dry OFF): the unified path runs a single
 * pass unless a job opts in via the suggest-threats advanced options
 * (`discovery: { mode: "until-dry", maxRounds }`). The runtime constant lives in
 * jobs/suggest-threats-v2-discovery.ts (DISCOVERY_DEFAULT); re-exported here so
 * the pipeline definition states its discovery default in one place.
 */
export { DISCOVERY_DEFAULT } from "../src/jobs/suggest-threats-v2-discovery.js";

const HANDLER_SENTINEL_PREFIX = "handler:";

/** `{source, field}` lookup or `{value}` literal (pipeline-service A2-1). */
type MappingRef = { source: string; field: string } | { value: unknown };

interface StageSeedDef {
  name: StageName;
  description: string;
  optional: boolean;
  outputFields: string[];
  /** Build inputMapping given stageName → actual stage id. */
  inputMapping: (ids: Record<StageName, string>) => Record<string, MappingRef>;
  /** Build condition JSON given stageName → actual stage id (or null). */
  condition?: (ids: Record<StageName, string>) => string;
}

const STAGE_DEFS: StageSeedDef[] = [
  {
    name: "ArchitectureReader",
    description:
      "Context assembly: component graph, sequence flows, skip-set (analysisHash). Non-LLM.",
    optional: false,
    outputFields: [
      "componentContexts",
      "skipSet",
      "sequenceFlows",
      "methodology",
      "context",
      "requirements",
      "parseFailures",
    ],
    // context/options/persist ride on inputMetadata (A1-3): the e2e/fixture
    // path supplies a pre-built context; DB runs omit it and the handler
    // assembles from ctx.threatModelId.
    inputMapping: () => ({
      context: { source: "input", field: "context" },
      options: { source: "input", field: "options" },
      persist: { source: "input", field: "persist" },
    }),
  },
  {
    name: "ThreatIdentifier",
    description:
      "Per-(component, category) threat analysis (component-analyzer + category-analyzer); supplemental + compound sub-steps.",
    optional: false,
    // attackChains + llmCalls ride along for SeverityCalibrator/observability;
    // skippedComponentCount feeds the legacy result summary (A1-4);
    // failedUnits + fanOutUnitCount surface A2-1 fan-out results (A2-2 wires
    // failedUnits into the job result + retry route).
    outputFields: [
      "threats",
      "parseFailures",
      "attackChains",
      "llmCalls",
      "skippedComponentCount",
      "failedUnits",
      "fanOutUnitCount",
    ],
    inputMapping: (ids) => ({
      componentContexts: {
        source: ids.ArchitectureReader,
        field: "componentContexts",
      },
      skipSet: { source: ids.ArchitectureReader, field: "skipSet" },
      sequenceFlows: { source: ids.ArchitectureReader, field: "sequenceFlows" },
      methodology: { source: ids.ArchitectureReader, field: "methodology" },
      context: { source: ids.ArchitectureReader, field: "context" },
      options: { source: "input", field: "options" },
      persist: { source: "input", field: "persist" },
      // A2-1: fan-out is ON by default for v2 — a pipeline-definition literal,
      // not caller input. The stage falls back to the sequential loop when the
      // FlowProducer is not initialized (no Redis) or fanOut !== true.
      fanOut: { value: true },
    }),
  },
  {
    name: "EvidenceEnricher",
    description:
      "Surfaces the CWE/OWASP/compliance reference data injected during identification (reference-lookup runs inside the per-category prompts — verified pass-through, see handler doc). Non-LLM.",
    optional: false,
    outputFields: ["enrichedThreats", "referenceCoverage", "parseFailures"],
    inputMapping: (ids) => ({
      threats: { source: ids.ThreatIdentifier, field: "threats" },
    }),
  },
  {
    name: "StrideClassifier",
    description:
      "Validates/repairs category labels on the merged threat list. Skipped when methodology !== STRIDE. Validate-only unless repairCategories is set (A1-4 wires the flag).",
    optional: false,
    outputFields: ["classifiedThreats", "invalidCategories", "parseFailures"],
    inputMapping: (ids) => ({
      threats: { source: ids.EvidenceEnricher, field: "enrichedThreats" },
      methodology: { source: ids.ArchitectureReader, field: "methodology" },
      repairCategories: { source: "input", field: "repairCategories" },
    }),
    condition: (ids) =>
      JSON.stringify({
        field: `${ids.ArchitectureReader}.methodology`,
        equals: "STRIDE",
      }),
  },
  {
    name: "MitigationSynthesizer",
    description:
      "2-4 mitigations per threat from distinct control categories (mitigation-analyzer). Prefers classifiedThreats when StrideClassifier ran. Includes the mitigations-only preseed.",
    optional: false,
    outputFields: ["threatsWithMitigations", "llmCalls", "parseFailures"],
    inputMapping: (ids) => ({
      threats: { source: ids.EvidenceEnricher, field: "enrichedThreats" },
      classifiedThreats: {
        source: ids.StrideClassifier,
        field: "classifiedThreats",
      },
      componentContexts: {
        source: ids.ArchitectureReader,
        field: "componentContexts",
      },
      requirements: { source: ids.ArchitectureReader, field: "requirements" },
      options: { source: "input", field: "options" },
      persist: { source: "input", field: "persist" },
    }),
  },
  {
    name: "ComplianceMapper",
    description: "Compliance-control mapping (frameworks features). Non-LLM.",
    optional: false,
    outputFields: [
      "complianceMappedThreats",
      "controlMatches",
      "parseFailures",
    ],
    inputMapping: (ids) => ({
      threats: {
        source: ids.MitigationSynthesizer,
        field: "threatsWithMitigations",
      },
      componentContexts: {
        source: ids.ArchitectureReader,
        field: "componentContexts",
      },
    }),
  },
  {
    name: "SeverityCalibrator",
    description:
      "Full-context severity recalibration (severity-calibrator) + T3.2 LLM dedup tail (legacy order).",
    optional: false,
    outputFields: ["calibratedThreats", "llmCalls", "parseFailures"],
    inputMapping: (ids) => ({
      threats: {
        source: ids.ComplianceMapper,
        field: "complianceMappedThreats",
      },
      attackChains: { source: ids.ThreatIdentifier, field: "attackChains" },
      options: { source: "input", field: "options" },
      persist: { source: "input", field: "persist" },
    }),
  },
  {
    name: "Verifier",
    description:
      "Adversarial challenger gate (A4-1): topology (code) → citation (code) → adversarial refutation (LLM). REFUTED ≥0.7 deleted (session-scoped); UNCERTAIN kept & flagged.",
    optional: false,
    outputFields: [
      "verdicts",
      "verifiedThreats",
      "decisions",
      "deletedCount",
      "topologyRefutedCount",
      "requeueCandidates",
      // A4-2 refutation feedback loop: number of gate passes run (1 = no
      // re-queue; 2 = one re-run for the > 40%-refuted pairs; hard cap 2).
      "loopCount",
      "parseFailures",
    ],
    inputMapping: (ids) => ({
      threats: { source: ids.SeverityCalibrator, field: "calibratedThreats" },
      context: { source: ids.ArchitectureReader, field: "context" },
      persist: { source: "input", field: "persist" },
      // A4-2: the ThreatIdentifier inputs the Verifier re-runs for refuted
      // (component, category) pairs. Same ArchitectureReader-derived context +
      // caller options/persist the ThreatIdentifier stage itself consumes, so
      // the re-run uses the identical methodology / confidence / session.
      identifierInputs: {
        source: "input",
        field: "identifierInputs",
      },
    }),
  },
];

type StageCore = Omit<
  Prisma.PipelineStageUncheckedCreateInput,
  "pipelineId" | "order"
>;

/** Find-or-create the built-in (org-less) pipeline by name, updating in place. */
async function upsertBuiltInPipeline(
  prisma: PrismaClient,
  name: string,
  description: string,
) {
  const existing = await prisma.promptPipeline.findFirst({
    where: { name, isBuiltIn: true, organizationId: null },
  });
  const pipelineData = {
    name,
    description,
    isSequential: true,
    stopOnError: false,
    isBuiltIn: true,
    isActive: true,
    organizationId: null,
  };
  return existing
    ? prisma.promptPipeline.update({
        where: { id: existing.id },
        data: pipelineData,
      })
    : prisma.promptPipeline.create({ data: pipelineData });
}

/** Upsert stage rows on (pipelineId, order); order is the 1-based index. */
async function upsertPipelineStages(
  prisma: PrismaClient,
  pipelineId: string,
  cores: StageCore[],
) {
  for (const [index, core] of cores.entries()) {
    const order = index + 1;
    await prisma.pipelineStage.upsert({
      where: { pipelineId_order: { pipelineId, order } },
      update: core,
      create: { ...core, pipelineId, order },
    });
  }
}

/** Map stage name -> stage id for a pipeline. */
async function loadStageIds(
  prisma: PrismaClient,
  pipelineId: string,
): Promise<Record<string, string>> {
  const stages = await prisma.pipelineStage.findMany({
    where: { pipelineId },
    orderBy: { order: "asc" },
  });
  return Object.fromEntries(stages.map((s) => [s.name, s.id]));
}

/** Idempotently seed the threat-analysis-v2 pipeline. */
export async function seedThreatAnalysisV2Pipeline(
  prisma: PrismaClient,
): Promise<{ pipelineId: string; stageIds: Record<StageName, string> }> {
  // Match on pipeline name (built-in, no org); update in place.
  const pipeline = await upsertBuiltInPipeline(
    prisma,
    PIPELINE_NAME,
    "Unified 8-stage AI orchestrator (go-forward Track A).",
  );

  // Pass 1: upsert the 8 stage rows on (pipelineId, order); mappings need ids.
  await upsertPipelineStages(
    prisma,
    pipeline.id,
    STAGE_DEFS.map((def) => ({
      name: def.name,
      description: def.description,
      promptTemplateId: `${HANDLER_SENTINEL_PREFIX}${def.name}`,
      outputFields: JSON.stringify(def.outputFields),
      optional: def.optional,
    })),
  );

  // Pass 2: resolve actual stage ids, then write inputMapping/dependsOn/condition.
  const stageIds = (await loadStageIds(prisma, pipeline.id)) as Record<
    StageName,
    string
  >;

  for (const [index, def] of STAGE_DEFS.entries()) {
    const previous = index > 0 ? [stageIds[STAGE_DEFS[index - 1].name]] : [];
    await prisma.pipelineStage.update({
      where: { id: stageIds[def.name] },
      data: {
        inputMapping: JSON.stringify(def.inputMapping(stageIds)),
        dependsOn: JSON.stringify(previous),
        condition: def.condition ? def.condition(stageIds) : null,
      },
    });
  }

  return { pipelineId: pipeline.id, stageIds };
}

// ===========================================================================
// expert-analysis-v2 (A3-1) — the 6-pass expert orchestrator as a pipeline
// ===========================================================================
//
// The 6 expert passes (services/ai/expert-analysis.ts) do NOT map onto the
// micro stage handlers: every pass is a WHOLE-ARCHITECTURE prompt producing
// markdown narrative or bespoke ExpertThreat JSON (attackVector / residualRisk
// / mitigationEffectiveness) plus an adversarial Challenge-Defend verification
// loop — a different shape from the per-(component,category) MicroThreat
// handlers. Routing them through a handler would change the prompts and break
// parity against the legacy expert path. So per ARCHITECTURE §2.1's escape
// hatch + TASKS A3-1 ("genuinely expert-specific prompts become PromptTemplate
// rows"), the 5 LLM passes are PROMPT-TEMPLATE-backed stages and Pass 6
// (Consolidate) is a CODE-ONLY stage (`code:consolidate` sentinel).
//
// MAPPING (pass → stage backing):
//   Pass 1 Understand   → PromptTemplate builtin-expert-pass-1-understand
//   Pass 2 Flows        → PromptTemplate builtin-expert-pass-2-flows
//   Pass 3 Threats      → PromptTemplate builtin-expert-pass-3-threats
//   Pass 4 Chains       → PromptTemplate builtin-expert-pass-4-chains
//   Pass 5 Verify       → PromptTemplate builtin-expert-pass-5-verify (loops)
//   Pass 6 Consolidate  → code-only (`code:consolidate`), no LLM
//
// The PromptTemplate systemPrompt is the verbatim PASS_N constant; the
// userPromptTemplate is `{{userContent}}` so the v2 orchestrator
// (runExpertAnalysisV2) interpolates the exact inter-pass hand-off string the
// legacy orchestrator builds → identical replay-journal hashes.

export const CODE_STAGE_PREFIX = "code:";

interface ExpertTemplateSeed {
  id: string;
  name: string;
  systemPrompt: string;
  outputFormat: "JSON" | "MARKDOWN";
}

interface ExpertStageSeed {
  name: string;
  description: string;
  /** PromptTemplate id, or `code:<key>` sentinel for the code-only stage. */
  promptTemplateId: string;
  optional: boolean;
  outputFields: string[];
}

const EXPERT_TEMPLATE_SEEDS: ExpertTemplateSeed[] = [
  {
    id: EXPERT_PASS_TEMPLATE_IDS.pass1,
    name: "Expert Analysis — Pass 1 (Understand)",
    systemPrompt: EXPERT_PASS_PROMPTS.PASS_1_UNDERSTAND,
    outputFormat: "MARKDOWN",
  },
  {
    id: EXPERT_PASS_TEMPLATE_IDS.pass2,
    name: "Expert Analysis — Pass 2 (Data Flows)",
    systemPrompt: EXPERT_PASS_PROMPTS.PASS_2_FLOWS,
    outputFormat: "MARKDOWN",
  },
  {
    id: EXPERT_PASS_TEMPLATE_IDS.pass3,
    name: "Expert Analysis — Pass 3 (Identify Threats)",
    systemPrompt: EXPERT_PASS_PROMPTS.PASS_3_THREATS,
    outputFormat: "JSON",
  },
  {
    id: EXPERT_PASS_TEMPLATE_IDS.pass4,
    name: "Expert Analysis — Pass 4 (Attack Chains)",
    systemPrompt: EXPERT_PASS_PROMPTS.PASS_4_CHAINS,
    outputFormat: "JSON",
  },
  {
    id: EXPERT_PASS_TEMPLATE_IDS.pass5,
    name: "Expert Analysis — Pass 5 (Verify)",
    systemPrompt: EXPERT_PASS_PROMPTS.PASS_5_VERIFY,
    outputFormat: "JSON",
  },
];

const EXPERT_STAGE_SEEDS: ExpertStageSeed[] = [
  {
    name: "Understand",
    description: "Pass 1 — read the architecture, classify each component.",
    promptTemplateId: EXPERT_PASS_TEMPLATE_IDS.pass1,
    optional: false,
    outputFields: ["understanding"],
  },
  {
    name: "DataFlows",
    description: "Pass 2 — examine every connection, flag gaps.",
    promptTemplateId: EXPERT_PASS_TEMPLATE_IDS.pass2,
    optional: false,
    outputFields: ["dataFlowFindings"],
  },
  {
    name: "IdentifyThreats",
    description: "Pass 3 — component-by-component STRIDE threat JSON.",
    promptTemplateId: EXPERT_PASS_TEMPLATE_IDS.pass3,
    optional: false,
    outputFields: ["threats", "parseFailures"],
  },
  {
    name: "AttackChains",
    description: "Pass 4 — trace lateral-movement attack-chain threats.",
    promptTemplateId: EXPERT_PASS_TEMPLATE_IDS.pass4,
    optional: false,
    outputFields: ["chainThreats", "parseFailures"],
  },
  {
    name: "Verify",
    description:
      "Pass 5 — adversarial Challenge-Defend review (loops up to 2x).",
    promptTemplateId: EXPERT_PASS_TEMPLATE_IDS.pass5,
    optional: false,
    outputFields: ["verifiedThreats"],
  },
  {
    name: "Consolidate",
    description: "Pass 6 — dedup + severity sort (code-only, no LLM).",
    promptTemplateId: `${CODE_STAGE_PREFIX}consolidate`,
    optional: false,
    outputFields: ["threats", "summary"],
  },
];

/** Idempotently seed the expert pass PromptTemplate rows (built-in, org-less). */
async function seedExpertPassTemplates(prisma: PrismaClient): Promise<void> {
  for (const t of EXPERT_TEMPLATE_SEEDS) {
    const data = {
      name: t.name,
      description: "Expert multi-pass analysis prompt (A3-1).",
      category: "ANALYSIS" as const,
      systemPrompt: t.systemPrompt,
      // The v2 orchestrator passes the full inter-pass hand-off string as
      // `userContent`; interpolatePrompt substitutes it verbatim.
      userPromptTemplate: "{{userContent}}",
      variables: JSON.stringify([
        { name: "userContent", type: "text", required: true },
      ]),
      outputFormat: t.outputFormat,
      temperature: 0.3,
      maxTokens: 45000,
      isBuiltIn: true,
      isActive: true,
      organizationId: null,
    };
    await prisma.promptTemplate.upsert({
      where: { id: t.id },
      update: data,
      create: { id: t.id, ...data },
    });
  }
}

/** Idempotently seed the expert-analysis-v2 pipeline + 6 stage rows. */
export async function seedExpertAnalysisV2Pipeline(
  prisma: PrismaClient,
): Promise<{ pipelineId: string; stageIds: Record<string, string> }> {
  await seedExpertPassTemplates(prisma);

  const pipeline = await upsertBuiltInPipeline(
    prisma,
    EXPERT_PIPELINE_NAME,
    "Expert 6-pass analysis as a pipeline (go-forward A3-1).",
  );

  await upsertPipelineStages(
    prisma,
    pipeline.id,
    EXPERT_STAGE_SEEDS.map((def, index) => ({
      name: def.name,
      description: def.description,
      promptTemplateId: def.promptTemplateId,
      outputFields: JSON.stringify(def.outputFields),
      optional: def.optional,
      dependsOn: JSON.stringify(
        index > 0 ? [EXPERT_STAGE_SEEDS[index - 1].name] : [],
      ),
    })),
  );

  return {
    pipelineId: pipeline.id,
    stageIds: await loadStageIds(prisma, pipeline.id),
  };
}

// ===========================================================================
// agentic-analysis-v2 (A3-2) — the multi-framework agentic path as a pipeline
// ===========================================================================
//
// The legacy agentic orchestrator (services/ai/agentic-analysis.ts) runs four
// PARALLEL framework runners (STRIDE / PASTA / Kill Chain / MITRE ATT&CK; plus
// conditional supply-chain / ML runners) each as ONE whole-architecture LLM
// call, then a verify loop. Like the expert passes (and per ARCHITECTURE §2.1's
// escape hatch), these do NOT map onto the per-(component,category) micro stage
// handlers without changing the prompts and breaking parity. So:
//
// METHODOLOGY → FAN-OUT MAPPING: ARCHITECTURE §2.3 frames the runners as a
// ThreatIdentifier fan-out "parameterized by methodology". A real
// per-(component,category) FlowProducer fan-out keyed by each methodology's
// category set is the micro path's mechanism (threat-analysis-v2, A2-1) and
// would re-prompt the agentic path entirely. Here the methodology dimension is
// expressed as ONE runner STAGE per methodology — StrideRunner / PastaRunner /
// KillChainRunner / MitreAttackRunner — all four visible in the flow as
// PipelineStageExecution rows (A3-2 gate: "all four methodologies' children
// visible in the flow"). The verify loop maps to the Verifier SLOT:
//   Verify → PromptTemplate builtin-agentic-verify (verbatim VERIFICATION_PROMPT)
// seeded `optional: true` (the A4-1 Verifier handler replaces the slot later).
//
// Each runner stage's PromptTemplate systemPrompt is the verbatim framework
// system prompt; the userPromptTemplate is `{{userContent}}` so the v2
// orchestrator (runAgenticAnalysisV2) interpolates the exact legacy runner user
// prompt → identical replay-journal hashes → parity by construction.

interface AgenticStageSeed {
  framework: AgenticFramework | "verify";
  stageName: string;
  templateId: string;
  systemPrompt: string;
  description: string;
  optional: boolean;
  outputFields: string[];
}

/**
 * Build the seed rows. The framework runner system prompts are sourced from the
 * SAME constants the runners use, via buildFrameworkPrompt for the four
 * methodologies and the supply-chain / ML add-ons; the verify template is the
 * verbatim VERIFICATION_PROMPT. We extract each system prompt from the prompt
 * builder against a throwaway empty context (system prompts are static — they
 * carry no context interpolation, only the user prompt does).
 */
function buildAgenticStageSeeds(): AgenticStageSeed[] {
  // Empty context just to read the static system prompts off buildFrameworkPrompt.
  const emptyCtx = {
    name: "",
    methodology: "stride",
    components: [],
    connections: [],
    boundaries: [],
  } as unknown as Parameters<typeof buildFrameworkPrompt>[1];

  const sysFor = (fw: AgenticFramework): string => {
    // supply_chain / ml return null on empty extraction, so pass a stub.
    const stubExtraction =
      fw === "supply_chain"
        ? ({
            dependencies: [{ name: "x" }],
            mlComponents: [],
            dataFlows: [],
          } as never)
        : fw === "ml_threats"
          ? ({
              dependencies: [],
              mlComponents: [{ id: "m", name: "m", attackSurface: [] }],
              dataFlows: [],
            } as never)
          : undefined;
    const p = buildFrameworkPrompt(fw, emptyCtx, stubExtraction);
    if (!p) throw new Error(`No system prompt for agentic framework ${fw}`);
    return p.system;
  };

  const runnerFrameworks: AgenticFramework[] = [
    "stride",
    "pasta",
    "kill_chain",
    "mitre_attack",
    "supply_chain",
    "ml_threats",
  ];

  const seeds: AgenticStageSeed[] = runnerFrameworks.map((fw) => ({
    framework: fw,
    stageName: AGENTIC_STAGE_NAMES[fw],
    templateId: AGENTIC_TEMPLATE_IDS[fw],
    systemPrompt: sysFor(fw),
    description: `Agentic ${fw} framework runner (whole-architecture pass).`,
    optional: true, // supply_chain/ml only run when extraction provides inputs
    outputFields: ["threats", "parseFailures"],
  }));

  // The verify-loop stage SLOT (Verifier handler lands in A4-1).
  seeds.push({
    framework: "verify",
    stageName: AGENTIC_VERIFY_STAGE_NAME,
    templateId: AGENTIC_TEMPLATE_IDS.verify,
    systemPrompt: VERIFICATION_PROMPT,
    description:
      "Verify loop — quality/coverage gate (Verifier handler lands in A4-1; optional until then).",
    optional: true,
    outputFields: ["verifiedThreats", "verification"],
  });

  return seeds;
}

/** Idempotently seed the agentic runner + verify PromptTemplate rows. */
async function seedAgenticTemplates(
  prisma: PrismaClient,
  seeds: AgenticStageSeed[],
): Promise<void> {
  for (const s of seeds) {
    const data = {
      name: `Agentic Analysis — ${s.stageName}`,
      description: "Agentic multi-framework analysis prompt (A3-2).",
      category: "ANALYSIS" as const,
      systemPrompt: s.systemPrompt,
      userPromptTemplate: "{{userContent}}",
      variables: JSON.stringify([
        { name: "userContent", type: "text", required: true },
      ]),
      outputFormat: "JSON" as const,
      temperature: 0.3,
      maxTokens: 45000,
      isBuiltIn: true,
      isActive: true,
      organizationId: null,
    };
    await prisma.promptTemplate.upsert({
      where: { id: s.templateId },
      update: data,
      create: { id: s.templateId, ...data },
    });
  }
}

/** Idempotently seed the agentic-analysis-v2 pipeline + stage rows. */
export async function seedAgenticAnalysisV2Pipeline(
  prisma: PrismaClient,
): Promise<{ pipelineId: string; stageIds: Record<string, string> }> {
  const seeds = buildAgenticStageSeeds();
  await seedAgenticTemplates(prisma, seeds);

  const pipeline = await upsertBuiltInPipeline(
    prisma,
    AGENTIC_PIPELINE_NAME,
    "Agentic multi-framework analysis as a pipeline (go-forward A3-2).",
  );

  await upsertPipelineStages(
    prisma,
    pipeline.id,
    seeds.map((def, index) => ({
      name: def.stageName,
      description: def.description,
      promptTemplateId: def.templateId,
      outputFields: JSON.stringify(def.outputFields),
      optional: def.optional,
      dependsOn: JSON.stringify(index > 0 ? [seeds[index - 1].stageName] : []),
    })),
  );

  return {
    pipelineId: pipeline.id,
    stageIds: await loadStageIds(prisma, pipeline.id),
  };
}

// ===========================================================================
// attack-chain-v1 (A5-2…A5-4) — the agentic attack-chain analysis pipeline
// ===========================================================================
//
// A SECOND code-backed PromptPipeline (ARCHITECTURE §2.5) running the 5
// attack-chain passes (AGENTIC_AI.md) over the same stage registry. All five
// passes are now seeded (A5-2 passes 1-2, A5-3 pass 3, A5-4 passes 4-5).
//
//   Pass 1 EntryPointDetector  → handler:EntryPointDetector
//   Pass 2 TargetAssetDetector → handler:TargetAssetDetector
//   Pass 3 PathGenerator       → handler:PathGenerator
//   Pass 4 ChainValidator      → handler:ChainValidator (CODE topology + LLM review)
//   Pass 5 ChainScorer         → handler:ChainScorer (residual severity)
//
// Both consume the ArchitectureReader-built `context` (topology) that every AI
// path uses. Pass 2 is SKIPPED when the job payload supplies explicit target
// assets — expressed as a stage `condition` { field: "targetAssets",
// exists: false } (run only when no override is present).

export const ATTACK_CHAIN_PIPELINE_NAME = "attack-chain-v1";

interface AttackChainStageSeed {
  name: Extract<
    StageName,
    | "EntryPointDetector"
    | "TargetAssetDetector"
    | "PathGenerator"
    | "ChainValidator"
    | "ChainScorer"
  >;
  description: string;
  optional: boolean;
  outputFields: string[];
  /**
   * inputMapping refs. `source: "input"` reads execution input; a `source`
   * of `STAGE_REF_PREFIX + <StageName>` references a prior stage's output and
   * is rewritten to that stage's real id in a second pass (pipeline-service
   * resolves stage outputs by stage id — names are not valid at runtime).
   */
  inputMapping: Record<string, MappingRef>;
  /** Condition JSON, or null for unconditional. */
  condition?: string;
}

/** Marker in a seed inputMapping source — rewritten to a real stage id post-create. */
const STAGE_REF_PREFIX = "stageRef:";

const ATTACK_CHAIN_STAGE_DEFS: AttackChainStageSeed[] = [
  {
    name: "EntryPointDetector",
    description:
      "Pass 1 — external-facing entry-point detection (LLM). Validates ids against topology; drops hallucinated ids.",
    optional: false,
    outputFields: ["entryPoints", "hallucinatedIds", "parseFailures"],
    // context rides on inputMetadata (fixture/e2e path) or is supplied by the
    // ArchitectureReader stage when the attack-chain executor prepends it.
    inputMapping: { context: { source: "input", field: "context" } },
  },
  {
    name: "TargetAssetDetector",
    description:
      "Pass 2 — high-value target-asset detection (LLM). Skipped when the payload supplies explicit targetAssets. Validates ids against topology.",
    optional: false,
    outputFields: ["targetAssets", "hallucinatedIds", "parseFailures"],
    inputMapping: {
      context: { source: "input", field: "context" },
      targetAssetsOverride: { source: "input", field: "targetAssets" },
    },
    // Run only when the job payload did NOT specify target assets (override
    // skips Pass 2). pipeline-service: exists:false → field must be undefined.
    condition: JSON.stringify({ field: "targetAssets", exists: false }),
  },
  {
    name: "PathGenerator",
    description:
      "Pass 3 — per (entry, target) pair, generate up to 3 candidate attack chains (LLM). Each hop carries §2.5 capability tokens (preconditions/yields). New-threat hops persist AI_SUGGESTED via the dedup path. Drops chains with hallucinated component ids.",
    optional: false,
    outputFields: ["candidateChains", "newThreatsPersisted", "parseFailures"],
    // entryPoints + targetAssets are prior-stage outputs; context rides on the
    // execution input. existingThreats/persist/maxChain* are supplied by the
    // attack-chain executor when present (DB-free without persist).
    inputMapping: {
      context: { source: "input", field: "context" },
      entryPoints: {
        source: `${STAGE_REF_PREFIX}EntryPointDetector`,
        field: "entryPoints",
      },
      targetAssets: {
        source: `${STAGE_REF_PREFIX}TargetAssetDetector`,
        field: "targetAssets",
      },
      existingThreats: { source: "input", field: "existingThreats" },
      persist: { source: "input", field: "persist" },
      maxChainPairs: { source: "input", field: "maxChainPairs" },
      maxChainDepth: { source: "input", field: "maxChainDepth" },
    },
  },
  {
    name: "ChainValidator",
    description:
      "Pass 4 — CODE topology + capability validation (ARCHITECTURE §2.5): each hop's preconditions ⊆ entry assumptions ∪ prior-hop yields AND an edge path exists between consecutive hop components. Topology-impossible chains are dropped here; survivors get a secondary LLM sanity review.",
    optional: false,
    outputFields: ["validatedChains", "rejections", "parseFailures"],
    inputMapping: {
      context: { source: "input", field: "context" },
      candidateChains: {
        source: `${STAGE_REF_PREFIX}PathGenerator`,
        field: "candidateChains",
      },
    },
  },
  {
    name: "ChainScorer",
    description:
      "Pass 5 — residual severity via the shared mitigation-effectiveness model (0–85% cap, diminishing returns). IMPLEMENTED breaking mitigations drop a chain's severity. Persists validated chains AI_SUGGESTED via the A5-1 AttackChain CRUD.",
    optional: false,
    outputFields: ["scoredChains", "chainsPersisted", "parseFailures"],
    inputMapping: {
      context: { source: "input", field: "context" },
      validatedChains: {
        source: `${STAGE_REF_PREFIX}ChainValidator`,
        field: "validatedChains",
      },
      persist: { source: "input", field: "persist" },
    },
  },
];

/** Idempotently seed the attack-chain-v1 pipeline + its (A5-2) stage rows. */
export async function seedAttackChainV1Pipeline(
  prisma: PrismaClient,
): Promise<{ pipelineId: string; stageIds: Record<string, string> }> {
  const pipeline = await upsertBuiltInPipeline(
    prisma,
    ATTACK_CHAIN_PIPELINE_NAME,
    "Agentic attack-chain analysis pipeline (go-forward A5; passes 1-5 seeded: entry points, target assets, path generation, code validation, residual scoring).",
  );

  await upsertPipelineStages(
    prisma,
    pipeline.id,
    ATTACK_CHAIN_STAGE_DEFS.map((def, index) => ({
      name: def.name,
      description: def.description,
      promptTemplateId: `${HANDLER_SENTINEL_PREFIX}${def.name}`,
      outputFields: JSON.stringify(def.outputFields),
      optional: def.optional,
      inputMapping: JSON.stringify(def.inputMapping),
      // PathGenerator consumes BOTH prior passes' outputs, so it depends on
      // both (TargetAssetDetector may be condition-skipped, but the executor
      // still needs the dependency edge). Earlier stages depend on their
      // immediate predecessor.
      dependsOn: JSON.stringify(
        def.name === "PathGenerator"
          ? ["EntryPointDetector", "TargetAssetDetector"]
          : index > 0
            ? [ATTACK_CHAIN_STAGE_DEFS[index - 1].name]
            : [],
      ),
      condition: def.condition ?? null,
    })),
  );

  const stageIdByName = await loadStageIds(prisma, pipeline.id);

  // Second pass: rewrite stageRef:<Name> sources to real stage ids. Must run
  // after every stage exists. Idempotent — re-running derives identical JSON.
  for (const def of ATTACK_CHAIN_STAGE_DEFS) {
    const hasStageRef = Object.values(def.inputMapping).some(
      (m) => "source" in m && m.source.startsWith(STAGE_REF_PREFIX),
    );
    if (!hasStageRef) continue;
    const resolved: Record<string, MappingRef> = {};
    for (const [varName, m] of Object.entries(def.inputMapping)) {
      if ("source" in m && m.source.startsWith(STAGE_REF_PREFIX)) {
        const refName = m.source.slice(STAGE_REF_PREFIX.length);
        const refId = stageIdByName[refName];
        if (!refId)
          throw new Error(
            `attack-chain-v1 seed: "${def.name}" references unknown stage "${refName}"`,
          );
        resolved[varName] = { source: refId, field: m.field };
      } else {
        resolved[varName] = m;
      }
    }
    await prisma.pipelineStage.updateMany({
      where: { pipelineId: pipeline.id, name: def.name },
      data: { inputMapping: JSON.stringify(resolved) },
    });
  }

  return {
    pipelineId: pipeline.id,
    stageIds: stageIdByName,
  };
}

async function main(): Promise<void> {
  const { getPrisma } = await import("../src/db.js");
  const prisma = await getPrisma();
  const { pipelineId, stageIds } = await seedThreatAnalysisV2Pipeline(prisma);
  console.log(
    `Seeded pipeline "${PIPELINE_NAME}" (${pipelineId}) with stages:`,
  );
  for (const name of THREAT_ANALYSIS_STAGE_NAMES)
    console.log(`  ${name} -> ${stageIds[name]}`);

  const expert = await seedExpertAnalysisV2Pipeline(prisma);
  console.log(
    `Seeded pipeline "${EXPERT_PIPELINE_NAME}" (${expert.pipelineId}) with stages:`,
  );
  for (const [name, id] of Object.entries(expert.stageIds)) {
    console.log(`  ${name} -> ${id}`);
  }

  const agentic = await seedAgenticAnalysisV2Pipeline(prisma);
  console.log(
    `Seeded pipeline "${AGENTIC_PIPELINE_NAME}" (${agentic.pipelineId}) with stages:`,
  );
  for (const [name, id] of Object.entries(agentic.stageIds)) {
    console.log(`  ${name} -> ${id}`);
  }

  const attackChain = await seedAttackChainV1Pipeline(prisma);
  console.log(
    `Seeded pipeline "${ATTACK_CHAIN_PIPELINE_NAME}" (${attackChain.pipelineId}) with stages:`,
  );
  for (const [name, id] of Object.entries(attackChain.stageIds)) {
    console.log(`  ${name} -> ${id}`);
  }
}

if (process.argv[1]?.endsWith("seed-pipelines.ts")) {
  main().catch((err) => {
    console.error("seed:pipelines failed:", err);
    process.exit(1);
  });
}

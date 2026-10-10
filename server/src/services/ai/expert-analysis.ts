/**
 * Expert Threat Analysis — Multi-Pass Iterative Pipeline
 *
 * Models how a real security architect works:
 *
 * Pass 1: UNDERSTAND — Read the architecture, classify each component
 * Pass 2: ANALYZE FLOWS — Examine every connection, flag gaps
 * Pass 3: IDENTIFY THREATS — Component-by-component STRIDE analysis
 * Pass 4: ATTACK CHAINS — Trace lateral movement paths
 * Pass 5: VERIFY — Review findings, remove false positives, check coverage
 * Pass 6: CONSOLIDATE — Prioritize, deduplicate, produce final report
 *
 * Each pass is a separate, focused LLM call that builds on the previous.
 * The verification pass (5) loops back if it finds issues.
 */
import {
  buildFindingsDigest,
  capNarrative,
  type DigestFinding,
} from "./findings-digest.js";
import type { AIProviderClient, ThreatModelContext } from "../../types/ai.js";
import logger from "../../utils/logger.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ExpertAnalysisResult {
  threats: ExpertThreat[];
  summary: {
    totalThreats: number;
    strideCoverage: string[];
    analysisTypes: string[];
    passesCompleted: number;
    verificationLoops: number;
    duration: number;
  };
  architectureUnderstanding: string;
  dataFlowFindings: string;
  attackChains: string;
}

export interface ExpertThreat {
  title: string;
  description: string;
  category: string;
  severity: string;
  targetComponentId: string | null;
  targetComponentName: string | null;
  attackVector: string;
  prerequisites: string;
  mitigation: string;
  mitigationEffectiveness: number; // 0.0-0.85 realistic
  residualRisk: string; // What risk remains
  confidence: number;
  references: string[];
  analysisType: string;
  verifiedInPass5: boolean;
  /**
   * Set when the Pass 5 verification reply for this loop failed to
   * parse. Distinct from verifiedInPass5 so the UI/API can render a failed
   * state instead of silently treating an unparseable reply as a clean pass.
   */
  verificationFailed?: boolean;
}

interface PassResult {
  pass: number;
  name: string;
  output: string;
  duration: number;
}

// ---------------------------------------------------------------------------
// Pass Prompts
// ---------------------------------------------------------------------------

const PASS_1_UNDERSTAND = `You are a security architect reviewing a system architecture for the first time. Your ONLY job in this pass is to UNDERSTAND the architecture. Do not identify threats yet.

For each component, determine:
1. What it does and what data it handles
2. Its attack surface (internet-facing? internal? database?)
3. What trust level it should have based on the data it processes
4. What security controls you'd EXPECT to see for this component type

For each connection, determine:
1. What data flows through it
2. Whether the protocol is appropriate
3. Whether encryption is present and sufficient
4. What authentication should protect this flow

Output a structured analysis as markdown. Be specific to THIS architecture.`;

const PASS_2_FLOWS = `You are continuing your security assessment. You've already understood the architecture (provided below). Now analyze EVERY data flow in detail.

For EACH connection:
- Is the protocol appropriate for the data sensitivity?
- Is encryption present? If not, what data is exposed?
- What authentication protects this flow?
- Could an attacker intercept, modify, or replay traffic on this flow?
- Are there missing flows that SHOULD exist? (e.g., no audit log flow, no backup flow)

Also identify TRUST BOUNDARY CROSSINGS — where does data move from a high-trust zone to a low-trust zone or vice versa?

Output your findings as markdown with a section per data flow.`;

const PASS_3_THREATS = `You are now identifying threats. You have your architecture understanding and data flow analysis (provided below).

For EACH component and EACH data flow, apply STRIDE:
- S: Can anyone spoof identity on this component/flow?
- T: Can data be tampered with?
- R: Can actions be denied without proof?
- I: Can sensitive data leak?
- D: Can this be made unavailable?
- E: Can privileges be escalated?

Also identify MISSING CONTROLS — what security measures SHOULD exist but DON'T?

Output as a JSON array of threat objects:
[{"title":"...","description":"...","category":"STRIDE_CATEGORY","severity":"CRITICAL|HIGH|MEDIUM|LOW","targetComponentId":"id or null","targetComponentName":"name or null","attackVector":"step-by-step","prerequisites":"conditions","mitigation":"specific fix","mitigationEffectiveness":0.35-0.75,"residualRisk":"what risk remains after mitigation","confidence":0.0-1.0,"references":["CWE-XXX"],"analysisType":"component_risk|data_flow|missing_control"}]

IMPORTANT: mitigationEffectiveness must be realistic (0.35-0.75 typical). No mitigation fully eliminates a threat. Use non-round numbers (0.47, 0.63 not 0.50, 0.80). Always explain residualRisk.

## Threat count — match the architecture, do NOT anchor on a number
Before writing any threat, enumerate silently:
  1. each component and what a full compromise would expose
  2. each data flow crossing a trust boundary
  3. each flow lacking encryption, authentication, or authorization
  4. each security control that SHOULD exist but doesn't
  5. each compliance requirement the architecture leaves unmet

Produce ONE threat per distinct risk you identified. Every STRIDE category must be CONSIDERED, but a category that does not apply need not produce a threat. Do NOT anchor on 8, 10, or any round number — that is habit, not assessment. Trivial systems may yield 4. Complex platforms may yield 30+. The architecture decides.

Citation discipline — each threat's "description" field MUST embed at least one inline citation tag. Valid tag forms:
  [ref:CWE-89]            cites a CWE
  [ref:A03:2021]          cites OWASP Top-10 2021
  [component:NODE_ID]     cites a canvas component (use exact ids from the architecture above)
  Per [doc:FILE §SECTION] when an imported document section supports the claim
  Not found: <claim>      prefix when no source supports the claim
NEVER fabricate a CWE number, OWASP id, or component id.

CRITICAL: Your response must be ONLY a valid JSON array starting with [ and ending with ]. No markdown, no explanation, no code fences. Just the raw JSON array.`;

const PASS_4_CHAINS = `You are analyzing attack chains. Given the architecture, data flows, and identified threats (provided below), trace LATERAL MOVEMENT paths.

For the 3 most critical components (highest exposure + most connections):
1. If this component is compromised, what can the attacker reach?
2. What credentials or tokens does this component have access to?
3. What's the WORST CASE blast radius — how far can the attacker go?
4. What would stop lateral movement? (network segmentation, least privilege, etc.)

Output as a JSON array of attack chain threats:
[{"title":"Lateral Movement via [Component]","description":"...","category":"ELEVATION_OF_PRIVILEGE","severity":"CRITICAL|HIGH","targetComponentId":"id","targetComponentName":"name","attackVector":"1. Compromise X via Y. 2. Use X's access to reach Z. 3. Exfiltrate from Z.","prerequisites":"...","mitigation":"...","mitigationEffectiveness":0.35-0.65,"residualRisk":"what risk remains","confidence":0.8,"references":["CWE-XXX"],"analysisType":"attack_chain"}]

IMPORTANT: mitigationEffectiveness must be realistic. Attack chain mitigations are typically 0.35-0.65 because lateral movement is hard to fully prevent.

CRITICAL: Your response must be ONLY a valid JSON array starting with [ and ending with ]. No markdown, no explanation, no code fences. Just the raw JSON array.`;

const PASS_5_VERIFY = `You are the REVIEWER. You've been given the complete threat analysis (architecture understanding, data flow analysis, identified threats, attack chains). Your job is to FIND MISTAKES and GAPS.

Check each threat:
1. Is the threat SPECIFIC to this architecture, or is it generic boilerplate?
2. Is the severity rating accurate based on the actual data and exposure?
3. Is the mitigation ACTIONABLE and technology-specific?
4. Are there DUPLICATE threats that should be merged?
5. Are there MISSING threats — any STRIDE category not covered?
6. Are there FALSE POSITIVES — threats that don't apply given the architecture?

## Challenge-Defend (adversarial round)

Pick the 3 highest-severity threats from the list (CRITICAL before HIGH before MEDIUM; break ties by list order). For EACH of those three, choose ONE action:

  DEFEND — the claim is grounded and you supply a citation for it. Acceptable citation forms:
             [ref:CWE-XXX], [ref:A0X:2021], [component:NODE_ID],
             Per [doc:FILENAME §SECTION], Per [req:REQID]
           A DEFEND without one of these tag forms in "citation" will be treated as RETRACT.

  QUALIFY — the original claim overreached. Narrow it to what IS supported and state what was overclaimed.

  RETRACT — the claim was speculation beyond the provided architecture. Withdraw it entirely.

Be honest. A confident defense without grounding is a trust failure; retracting is a valid, professional action.

Output as JSON:
{
  "approved": ["threat title 1", "threat title 2"],
  "rejected": [{"title": "...", "reason": "too generic / doesn't apply / duplicate of X"}],
  "missing": [{"title": "suggested new threat", "category": "STRIDE_CATEGORY", "reason": "why this was missed"}],
  "severityAdjustments": [{"title": "...", "currentSeverity": "HIGH", "suggestedSeverity": "CRITICAL", "reason": "..."}],
  "defenses": [
    {"title": "...", "action": "DEFEND", "citation": "[ref:CWE-XXX] or [component:NODE_ID] or Per [doc:FILE §SEC]", "rationale": "one sentence"},
    {"title": "...", "action": "QUALIFY", "qualification": "narrower restated claim", "rationale": "what was overclaimed"},
    {"title": "...", "action": "RETRACT", "rationale": "why speculation"}
  ],
  "overallQuality": "A|B|C|D",
  "strideCoverage": ["SPOOFING", "TAMPERING", ...],
  "missingCategories": ["DENIAL_OF_SERVICE"]
}

Be CRITICAL. A real CISO would reject generic findings.

CRITICAL: Your response must be ONLY a valid JSON object starting with { and ending with }. No markdown, no explanation, no code fences. Just the raw JSON.`;

/** Max Pass-5 verification loops. Shared by the legacy + v2 orchestrators. */
export const MAX_VERIFICATION_LOOPS = 2;

/** expert-analysis-v2 pipeline name (seeded by scripts/seed-pipelines.ts). */
export const EXPERT_PIPELINE_NAME = "expert-analysis-v2";

/** Stable, well-known PromptTemplate ids for the 5 LLM passes. */
export const EXPERT_PASS_TEMPLATE_IDS = {
  pass1: "builtin-expert-pass-1-understand",
  pass2: "builtin-expert-pass-2-flows",
  pass3: "builtin-expert-pass-3-threats",
  pass4: "builtin-expert-pass-4-chains",
  pass5: "builtin-expert-pass-5-verify",
} as const;

/** Temperature every expert pass uses (legacy runPass; changing it alters output). */
/**
 * Per-pass user-content builders — the exact inter-pass hand-off strings the
 * legacy orchestrator assembles. Exported so the v2 pipeline orchestrator
 * produces byte-identical prompts (same replay-journal hashes).
 */
export const EXPERT_PASS_PROMPTS = {
  PASS_1_UNDERSTAND,
  PASS_2_FLOWS,
  PASS_3_THREATS,
  PASS_4_CHAINS,
  PASS_5_VERIFY,
} as const;

export function buildPass2Input(archContext: string, pass1: string): string {
  return `${archContext}\n\n## Previous Analysis (Pass 1: Architecture Understanding)\n${pass1}`;
}

/**
 * Token budgets (≈4 chars/token) that keep every expert prompt, system
 * message included, at or under ~4k tokens on the go-forward fixture (system
 * 331–643, architecture context 687). Pass 3 keeps the most flow analysis
 * because identification depends on it; later passes get a findings digest.
 */
const EXPERT_INPUT_BUDGETS = {
  pass3: { understanding: 800, flows: 1600 },
  pass4: { digest: 2500 },
  pass5: { understanding: 300, flows: 300, digest: 2000 },
} as const;

/** Digest rows for expert/agentic threats (exact titles — verification keys on them). */
export function toDigestFindings(
  threats: Array<{
    title: string;
    description: string;
    category: string;
    severity: string;
    targetComponentId: string | null;
    targetComponentName?: string | null;
    references?: string[];
    sourceFramework?: string;
  }>,
): DigestFinding[] {
  return threats.map((t) => ({
    title: t.title,
    component: t.targetComponentName ?? t.targetComponentId ?? undefined,
    category: t.sourceFramework
      ? `${t.category} (${t.sourceFramework})`
      : t.category,
    severity: t.severity,
    description: t.description,
    citationSource: (t.references ?? []).join(" "),
  }));
}

export function buildPass3Input(
  archContext: string,
  pass1: string,
  pass2: string,
): string {
  const b = EXPERT_INPUT_BUDGETS.pass3;
  return `${archContext}\n\n## Architecture Understanding\n${capNarrative(pass1, b.understanding)}\n\n## Data Flow Analysis\n${capNarrative(pass2, b.flows)}`;
}

export function buildPass4Input(
  archContext: string,
  threats: ExpertThreat[],
): string {
  return `${archContext}\n\n## Identified Threats (${threats.length})\n${buildFindingsDigest(toDigestFindings(threats), EXPERT_INPUT_BUDGETS.pass4.digest)}`;
}

export function buildPass5Input(
  archContext: string,
  pass1: string,
  pass2: string,
  allThreats: ExpertThreat[],
): string {
  const b = EXPERT_INPUT_BUDGETS.pass5;
  return `${archContext}\n\n## Architecture Understanding\n${capNarrative(pass1, b.understanding)}\n\n## Data Flow Analysis\n${capNarrative(pass2, b.flows)}\n\n## All Threats (${allThreats.length})\n${buildFindingsDigest(toDigestFindings(allThreats), b.digest)}`;
}

// ---------------------------------------------------------------------------
// Pipeline
// ---------------------------------------------------------------------------

export async function runExpertAnalysis(
  client: AIProviderClient,
  context: ThreatModelContext,
  onProgress?: (pass: number, name: string, status: string) => void,
): Promise<ExpertAnalysisResult> {
  const startTime = Date.now();
  const passes: PassResult[] = [];
  let verificationLoops = 0;

  const report = (pass: number, name: string, status: string) => {
    logger.info({ pass, name, status }, "Expert analysis pass");
    onProgress?.(pass, name, status);
  };

  // Format context for prompts
  const archContext = formatContext(context);

  // --- Pass 1: Understand ---
  report(1, "Understand Architecture", "running");
  const pass1 = await runPass(
    client,
    PASS_1_UNDERSTAND,
    archContext,
    "Understand the architecture",
  );
  passes.push({ pass: 1, name: "Understand", output: pass1, duration: 0 });
  report(1, "Understand Architecture", "complete");

  // --- Pass 2: Analyze Flows ---
  report(2, "Analyze Data Flows", "running");
  const pass2Input = buildPass2Input(archContext, pass1);
  const pass2 = await runPass(
    client,
    PASS_2_FLOWS,
    pass2Input,
    "Analyze every data flow",
  );
  passes.push({ pass: 2, name: "Flows", output: pass2, duration: 0 });
  report(2, "Analyze Data Flows", "complete");

  // --- Pass 3: Identify Threats ---
  report(3, "Identify Threats", "running");
  const pass3Input = buildPass3Input(archContext, pass1, pass2);
  const pass3Raw = await runPass(
    client,
    PASS_3_THREATS,
    pass3Input,
    "Identify STRIDE threats",
  );
  const threats = parseThreatsJson(pass3Raw);
  passes.push({ pass: 3, name: "Threats", output: pass3Raw, duration: 0 });
  report(3, "Identify Threats", `complete (${threats.length} found)`);

  // --- Pass 4: Attack Chains ---
  report(4, "Trace Attack Chains", "running");
  const pass4Input = buildPass4Input(archContext, threats);
  const pass4Raw = await runPass(
    client,
    PASS_4_CHAINS,
    pass4Input,
    "Trace lateral movement",
  );
  const chainThreats = parseThreatsJson(pass4Raw);
  passes.push({ pass: 4, name: "Chains", output: pass4Raw, duration: 0 });
  report(4, "Trace Attack Chains", `complete (${chainThreats.length} chains)`);

  // Combine all threats
  let allThreats = [...threats, ...chainThreats];

  // --- Pass 5: Verify (with loop) ---
  for (let loop = 0; loop < MAX_VERIFICATION_LOOPS; loop++) {
    verificationLoops++;
    report(5, `Verify (loop ${loop + 1})`, "running");

    const pass5Input = buildPass5Input(archContext, pass1, pass2, allThreats);
    const pass5Raw = await runPass(
      client,
      PASS_5_VERIFY,
      pass5Input,
      "Review and verify findings",
    );
    passes.push({
      pass: 5,
      name: `Verify-${loop + 1}`,
      output: pass5Raw,
      duration: 0,
    });

    // Apply the verification result (shared with the v2 pipeline path).
    const applied = applyExpertVerification(allThreats, pass5Raw);
    allThreats = applied.threats;
    report(5, `Verify (loop ${loop + 1})`, applied.summary);
    if (applied.done) break;

    // If there are missing threats and we have another loop, the next iteration will catch them
    // (the verification output serves as guidance for manual review)
  }

  // --- Pass 6: Consolidate (done in code, not LLM) ---
  report(6, "Consolidate", "running");

  const deduped = consolidateExpertThreats(allThreats);
  const strideCoverage = [...new Set(deduped.map((t) => t.category))];
  const analysisTypes = [...new Set(deduped.map((t) => t.analysisType))];

  report(
    6,
    "Consolidate",
    `final: ${deduped.length} threats, ${strideCoverage.length}/6 STRIDE`,
  );

  return {
    threats: deduped,
    summary: {
      totalThreats: deduped.length,
      strideCoverage,
      analysisTypes,
      passesCompleted: passes.length,
      verificationLoops,
      duration: Date.now() - startTime,
    },
    architectureUnderstanding: pass1,
    dataFlowFindings: pass2,
    attackChains: pass4Raw,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Apply one Pass-5 verification result to the running threat list. Extracted
 * verbatim from the legacy verify loop so the v2 pipeline orchestrator drives
 * the SAME Challenge-Defend → reject → severity-adjust → mark-verified
 * mutation. Returns the new list plus the loop's
 * progress summary string and the legacy done-condition (quality A/B and no
 * missing categories). Mutates severities/verifiedInPass5 in place exactly as
 * the legacy code did; `threats` is a fresh array (applyDefenses/filter).
 */
export function applyExpertVerification(
  threats: ExpertThreat[],
  pass5Raw: string,
): {
  threats: ExpertThreat[];
  done: boolean;
  summary: string;
  failed: boolean;
} {
  const verification = parseVerification(pass5Raw);
  const retractCount = verification.defenses.filter(
    (d) =>
      d.action === "RETRACT" ||
      (d.action === "DEFEND" && !hasValidCitation(d.citation)),
  ).length;
  const summary =
    `quality=${verification.quality}, rejected=${verification.rejected.length}, missing=${verification.missing.length}, retracted=${retractCount}` +
    (verification.failed ? " (Pass 5 reply failed to parse)" : "");

  // Challenge-Defend outcomes first — retractions/qualifications take
  // precedence over the coarser rejected[] list (per-claim adversarial round).
  let out = applyDefenses(threats, verification.defenses);

  if (verification.rejected.length > 0) {
    const rejectedTitles = new Set(
      verification.rejected.map((r) => r.title.toLowerCase()),
    );
    out = out.filter((t) => !rejectedTitles.has(t.title.toLowerCase()));
  }

  for (const adj of verification.severityAdjustments) {
    const threat = out.find(
      (t) => t.title.toLowerCase() === adj.title.toLowerCase(),
    );
    if (threat) threat.severity = adj.suggestedSeverity;
  }

  if (verification.failed) {
    // Do not mark a failed-to-parse pass as verified; mark it failed
    // instead so the API/UI can surface it, and never exit the loop early.
    for (const t of out) t.verificationFailed = true;
  } else {
    for (const t of out) t.verifiedInPass5 = true;
  }

  const done =
    !verification.failed &&
    (verification.quality === "A" || verification.quality === "B") &&
    verification.missing.length === 0;

  return { threats: out, done, summary, failed: verification.failed };
}

/**
 * Pass 6 consolidation (code, not LLM): dedup by title-similarity key, then
 * sort by severity. Shared by the legacy orchestrator and the v2 pipeline
 * orchestrator so both produce a byte-identical final set.
 */
export function consolidateExpertThreats(
  allThreats: ExpertThreat[],
): ExpertThreat[] {
  const seen = new Set<string>();
  const deduped: ExpertThreat[] = [];
  for (const t of allThreats) {
    const key = t.title.toLowerCase().replace(/[^a-z]/g, "");
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(t);
    }
  }

  const severityOrder: Record<string, number> = {
    CRITICAL: 0,
    HIGH: 1,
    MEDIUM: 2,
    LOW: 3,
    INFO: 4,
  };
  deduped.sort(
    (a, b) =>
      (severityOrder[a.severity] ?? 5) - (severityOrder[b.severity] ?? 5),
  );
  return deduped;
}

export function formatContext(ctx: ThreatModelContext): string {
  // Names not DB IDs — LLM parrots IDs into threat descriptions otherwise.
  const nameById = new Map(ctx.components.map((c) => [c.id, c.name]));
  const resolveName = (id: string): string =>
    nameById.get(id) || `external (${id.slice(0, 8)})`;

  const components = ctx.components
    .map(
      (c) =>
        `- **${c.name}** (Type: ${c.type})${c.description ? `\n  ${c.description}` : ""}`,
    )
    .join("\n");

  const connections = ctx.connections
    .map(
      (c) =>
        `- ${resolveName(c.source)} → ${resolveName(c.target)} [${c.protocol || "unknown"}] ${c.encrypted ? "🔒 encrypted" : "⚠️ UNENCRYPTED"}${c.label ? ` (${c.label})` : ""}`,
    )
    .join("\n");

  const boundaries = ctx.boundaries
    .map((b) => `- ${b.name}${b.trustLevel ? ` (${b.trustLevel})` : ""}`)
    .join("\n");

  return `## System: ${ctx.name || "Unnamed"}

## Components
${components || "None defined"}

## Data Flows
${connections || "None defined"}

## Trust Boundaries
${boundaries || "None defined"}`;
}

async function runPass(
  client: AIProviderClient,
  systemPrompt: string,
  userContent: string,
  taskDescription: string,
): Promise<string> {
  const start = Date.now();
  try {
    const response = await client.complete({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
      temperature: 0.3,
      maxTokens: 45000,
    });
    logger.debug(
      {
        task: taskDescription,
        duration: Date.now() - start,
        tokens: response.usage?.totalTokens,
      },
      "Expert pass complete",
    );
    return response.content;
  } catch (err) {
    logger.error({ err, task: taskDescription }, "Expert pass failed");
    return `Error in ${taskDescription}: ${err instanceof Error ? err.message : "unknown"}`;
  }
}

export function parseThreatsJson(raw: string): ExpertThreat[] {
  try {
    let content = raw.trim();

    // Strip <think>...</think> blocks (qwen, deepseek)
    content = content.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();

    // Strategy 1: Strip all markdown code fences (```json ... ```)
    const codeBlockMatch = content.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (codeBlockMatch) {
      content = codeBlockMatch[1].trim();
    }

    // Strategy 2: Find JSON array anywhere in the text
    const arrayStart = content.indexOf("[");
    const arrayEnd = content.lastIndexOf("]");
    if (arrayStart !== -1 && arrayEnd !== -1 && arrayEnd > arrayStart) {
      content = content.slice(arrayStart, arrayEnd + 1);
    }

    const parsed = JSON.parse(content);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((t) => ({ ...t, verifiedInPass5: false }));
  } catch (_e) {
    // Strategy 3: Try to find individual JSON objects and collect them
    try {
      const objects: ExpertThreat[] = [];
      const regex = /\{[^{}]*"title"[^{}]*"category"[^{}]*\}/g;
      let match;
      while ((match = regex.exec(raw)) !== null) {
        try {
          objects.push({ ...JSON.parse(match[0]), verifiedInPass5: false });
        } catch {
          /* skip malformed */
        }
      }
      if (objects.length > 0) return objects;
    } catch {
      /* fallthrough */
    }

    logger.warn(
      { rawLength: raw.length, preview: raw.slice(0, 200) },
      "Failed to parse threats JSON from LLM output",
    );
    return [];
  }
}

export interface VerificationDefense {
  title: string;
  action: "DEFEND" | "QUALIFY" | "RETRACT";
  citation?: string;
  qualification?: string;
  rationale?: string;
}

export function parseVerification(raw: string): {
  quality: string;
  rejected: Array<{ title: string; reason: string }>;
  missing: Array<{ title: string; category: string }>;
  severityAdjustments: Array<{ title: string; suggestedSeverity: string }>;
  defenses: VerificationDefense[];
  /**
   * True when the reply could not be parsed as JSON. The caller
   * (applyExpertVerification) must not treat this the same as a clean pass:
   * before this field existed, a parse failure returned the exact same
   * shape as `{quality:"B", missing:[]}`, so every threat got stamped
   * `verifiedInPass5 = true` and the loop exited early, indistinguishable
   * from a genuine clean pass.
   */
  failed: boolean;
} {
  try {
    let content = raw.trim();
    if (content.startsWith("```")) {
      content = content.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }
    const start = content.indexOf("{");
    const end = content.lastIndexOf("}");
    if (start !== -1 && end !== -1) {
      content = content.slice(start, end + 1);
    }
    const parsed = JSON.parse(content);
    return {
      quality: parsed.overallQuality || "B",
      rejected: parsed.rejected || [],
      missing: parsed.missing || [],
      severityAdjustments: parsed.severityAdjustments || [],
      defenses: normalizeDefenses(parsed.defenses),
      failed: false,
    };
  } catch {
    return {
      quality: "B",
      rejected: [],
      missing: [],
      severityAdjustments: [],
      defenses: [],
      failed: true,
    };
  }
}

function normalizeDefenses(raw: unknown): VerificationDefense[] {
  if (!Array.isArray(raw)) return [];
  const result: VerificationDefense[] = [];
  for (const d of raw) {
    if (!d || typeof d !== "object") continue;
    const obj = d as Record<string, unknown>;
    const title = typeof obj.title === "string" ? obj.title : "";
    const action =
      typeof obj.action === "string" ? obj.action.toUpperCase() : "";
    if (!title) continue;
    if (action !== "DEFEND" && action !== "QUALIFY" && action !== "RETRACT")
      continue;
    result.push({
      title,
      action: action as VerificationDefense["action"],
      citation: typeof obj.citation === "string" ? obj.citation : undefined,
      qualification:
        typeof obj.qualification === "string" ? obj.qualification : undefined,
      rationale: typeof obj.rationale === "string" ? obj.rationale : undefined,
    });
  }
  return result;
}

/**
 * A DEFEND is only valid if the citation contains at least one of the
 * approved evidence-tag forms from the universal system prompt. An
 * unsupported DEFEND is silently promoted to RETRACT — the Challenge-Defend
 * contract: confident defense without grounding = trust failure.
 */
const CITATION_TAG_RE =
  /\[ref:(?:CWE-\d+|A\d{2}:\d{4}|[A-Z0-9_-]+)\]|\[component:[^\]]+\]|Per\s+\[doc:[^\]]+\]|Per\s+\[req:[^\]]+\]/i;

export function hasValidCitation(citation: string | undefined): boolean {
  if (!citation) return false;
  return CITATION_TAG_RE.test(citation);
}

/**
 * Apply the Challenge-Defend outcomes to the threat list:
 *   - RETRACT (or DEFEND without a valid citation) → remove the threat
 *   - QUALIFY → replace description with the narrower qualification
 *   - DEFEND with a valid citation → append the citation to the description
 *     if it isn't already carried there
 *
 * Returns a new array; does not mutate the input. Matches titles case-
 * insensitively with whitespace tolerance so minor LLM formatting drift
 * doesn't make defenses silently no-op.
 */
export function applyDefenses(
  threats: ExpertThreat[],
  defenses: VerificationDefense[],
): ExpertThreat[] {
  if (defenses.length === 0) return threats;

  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
  const byTitle = new Map<string, VerificationDefense>();
  for (const d of defenses) byTitle.set(norm(d.title), d);

  const out: ExpertThreat[] = [];
  for (const t of threats) {
    const d = byTitle.get(norm(t.title));
    if (!d) {
      out.push(t);
      continue;
    }
    if (d.action === "RETRACT") continue;
    if (d.action === "DEFEND" && !hasValidCitation(d.citation)) continue;
    if (d.action === "QUALIFY" && d.qualification) {
      out.push({ ...t, description: d.qualification });
      continue;
    }
    if (d.action === "DEFEND" && d.citation) {
      const alreadyCited = t.description.includes(d.citation);
      out.push({
        ...t,
        description: alreadyCited
          ? t.description
          : `${d.citation} ${t.description}`,
      });
      continue;
    }
    out.push(t);
  }
  return out;
}

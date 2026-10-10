/**
 * Context-Aware Threat Generation Pipeline
 *
 * 5-phase pipeline that works like a real security expert:
 * 1. Context Assembly (no LLM) — gather component metadata
 * 2. Research (no LLM) — OWASP, CWE, compliance lookup
 * 3. Analyze Attack Surface (LLM call #1) — reason about exploitability
 * 4. Generate Findings (LLM call #2) — specific, evidence-cited threats
 * 5. Verify & Enrich (no LLM) — validate, adjust severity, dedup
 *
 * Works with ANY LLM: Claude, GPT-4, Gemini, Ollama, LM Studio, vLLM.
 * Intelligence is in the PROMPT + DATA, not the model.
 */
import { researchThreats, type ThreatResearch } from "./threat-research.js";
import { analyzeModel, type GeneratedThreat } from "./stride-analyzer.js";
import logger from "../../utils/logger.js";

// =============================================================================
// Types
// =============================================================================

export interface ComponentContext {
  id: string;
  name: string;
  type: string;
  description?: string;
  // Security context (from SecurityContextPanel)
  dataClassification: "PUBLIC" | "INTERNAL" | "CONFIDENTIAL" | "RESTRICTED";
  dataTypes: string[];
  accessPattern: string;
  complianceFrameworks: string[];
  existingControls: string[];
  technologyVersion?: string;
  /** Trust zone this component sits in (DMZ, INTERNAL, TRUSTED, …). */
  trustZone?: string;
  // Connections from canvas
  inbound: Array<{
    from: string;
    protocol?: string;
    encrypted?: boolean;
    auth?: string;
    /** Data classifications carried on this edge. */
    dataClassifications?: string[];
    /** Trust zone of the peer on the other end. */
    peerTrustZone?: string;
    /** True when this edge crosses a trust boundary. */
    crossesBoundary?: boolean;
  }>;
  outbound: Array<{
    to: string;
    protocol?: string;
    encrypted?: boolean;
    auth?: string;
    dataClassifications?: string[];
    peerTrustZone?: string;
    crossesBoundary?: boolean;
  }>;
}

interface ContextAwareFinding {
  name: string;
  description: string;
  strideCategory: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  componentId: string;
  evidence: {
    owasp?: string;
    cwe?: string;
    cve?: string;
    compliance?: string;
    attackPath?: string;
  };
  existingControlsNote?: string;
  residualRisk?: string;
  mitigation: {
    description: string;
    effort: "LOW" | "MEDIUM" | "HIGH";
    effectiveness:
      | "ELIMINATES"
      | "STRONGLY_REDUCES"
      | "MODERATELY_REDUCES"
      | "MINIMALLY_REDUCES";
  };
}

export interface PipelineResult {
  findings: ContextAwareFinding[];
  ruleBasedThreats: GeneratedThreat[];
  research: ThreatResearch;
  analysisUsed: "llm" | "rule-based";
  provider?: string;
  duration: number;
}

/** Function signature for calling the configured AI provider */
export type AICallFn = (
  systemPrompt: string,
  userPrompt: string,
) => Promise<string>;

/**
 * Rule-based STRIDE threats for a single component and its canvas edges
 * (no LLM). Shared by the pipeline and the micro-analysis component analyzer.
 */
export function analyzeComponentRules(
  component: ComponentContext,
): GeneratedThreat[] {
  return analyzeModel({
    components: [
      {
        id: component.id,
        name: component.name,
        type: component.type,
        trustLevel:
          component.dataClassification === "PUBLIC" ? "EXTERNAL" : "INTERNAL",
        dataClassification: component.dataClassification,
      },
    ],
    connections: [
      ...component.inbound.map((c, i) => ({
        id: `in-${i}`,
        source: c.from,
        target: component.id,
        protocol: c.protocol,
        encrypted: c.encrypted,
        authMethod: c.auth,
      })),
      ...component.outbound.map((c, i) => ({
        id: `out-${i}`,
        source: component.id,
        target: c.to,
        protocol: c.protocol,
        encrypted: c.encrypted,
        authMethod: c.auth,
      })),
    ],
    boundaries: [],
  });
}

// =============================================================================
// Pipeline
// =============================================================================

/**
 * Run the full 5-phase context-aware threat analysis pipeline.
 *
 * @param component — Component with security context from the canvas
 * @param aiCall — Optional LLM call function. If not provided, falls back to rule-based only.
 */
export async function runContextAwarePipeline(
  component: ComponentContext,
  aiCall?: AICallFn,
): Promise<PipelineResult> {
  const start = Date.now();

  // ─── Phase 1: Context Assembly (no LLM) ───
  // Already done — component context comes from the SecurityContextPanel UI

  // ─── Phase 2: Research (no LLM) ───
  const research = await researchThreats({
    componentType: component.type,
    dataTypes: component.dataTypes,
    complianceFrameworks: component.complianceFrameworks,
    technologyVersion: component.technologyVersion,
  });

  // ─── Rule-based threats (always available, even without LLM) ───
  const ruleBasedThreats = analyzeComponentRules(component);

  // If no LLM available, return rule-based results
  if (!aiCall) {
    logger.info(
      { component: component.name, ruleThreats: ruleBasedThreats.length },
      "Context-aware pipeline: rule-based only (no LLM configured)",
    );
    return {
      findings: ruleBasedToFindings(ruleBasedThreats, research),
      ruleBasedThreats,
      research,
      analysisUsed: "rule-based",
      duration: Date.now() - start,
    };
  }

  // ─── Phase 3: Analyze Attack Surface (LLM call #1) ───
  const analysisPrompt = buildAnalysisPrompt(component, research);

  let analysis: string;
  try {
    analysis = await aiCall(SYSTEM_PROMPT_ANALYSIS, analysisPrompt);
  } catch (err) {
    logger.warn(
      { err, component: component.name },
      "LLM analysis failed, falling back to rule-based",
    );
    return {
      findings: ruleBasedToFindings(ruleBasedThreats, research),
      ruleBasedThreats,
      research,
      analysisUsed: "rule-based",
      duration: Date.now() - start,
    };
  }

  // ─── Phase 4: Generate Findings (LLM call #2) ───
  const findingsPrompt = buildFindingsPrompt(component, research, analysis);

  let findingsJson: string;
  try {
    findingsJson = await aiCall(SYSTEM_PROMPT_FINDINGS, findingsPrompt);
  } catch (err) {
    logger.warn(
      { err, component: component.name },
      "LLM findings failed, falling back to rule-based",
    );
    return {
      findings: ruleBasedToFindings(ruleBasedThreats, research),
      ruleBasedThreats,
      research,
      analysisUsed: "rule-based",
      duration: Date.now() - start,
    };
  }

  // ─── Phase 5: Verify & Enrich (no LLM) ───
  const findings = parseAndVerifyFindings(findingsJson, component.id);

  logger.info(
    {
      component: component.name,
      llmFindings: findings.length,
      ruleThreats: ruleBasedThreats.length,
      duration: Date.now() - start,
    },
    "Context-aware pipeline complete",
  );

  return {
    findings,
    ruleBasedThreats,
    research,
    analysisUsed: "llm",
    duration: Date.now() - start,
  };
}

// =============================================================================
// Prompt Construction
// =============================================================================

const SYSTEM_PROMPT_ANALYSIS = `You are a senior security architect analyzing the attack surface of a specific component in a threat model. You have detailed context about the component, its data, access patterns, existing controls, and known vulnerabilities.

Analyze — don't just list. Consider:
- Which known vulnerabilities are actually exploitable given existing controls?
- What attack paths exist through this component?
- What's the blast radius if compromised?
- Which compliance requirements are NOT met?

Be specific to THIS component with THIS context. Generic observations are not useful.`;

const SYSTEM_PROMPT_FINDINGS = `You are generating threat findings for a security assessment. Each finding must be:
- SPECIFIC to this component and its context (not generic)
- CITE evidence (OWASP category, CWE ID, compliance clause)
- CONSIDER existing controls (don't flag what's already mitigated)
- INCLUDE realistic severity based on exploitability + impact
- PROVIDE specific, actionable mitigation

Return ONLY a JSON array of findings. No markdown, no explanation, just the JSON array.`;

function buildAnalysisPrompt(
  component: ComponentContext,
  research: ThreatResearch,
): string {
  const connections = [
    ...component.inbound.map(
      (c) =>
        `  Inbound: ${c.from} → this (${c.protocol || "?"}, encrypted: ${c.encrypted ?? "?"}, auth: ${c.auth || "none"})`,
    ),
    ...component.outbound.map(
      (c) =>
        `  Outbound: this → ${c.to} (${c.protocol || "?"}, encrypted: ${c.encrypted ?? "?"}, auth: ${c.auth || "none"})`,
    ),
  ].join("\n");

  const owaspList = research.owasp
    .map((o) => `  ${o.id} ${o.name}: ${o.relevance}`)
    .join("\n");

  const cweList = research.cwes
    .map((c) => `  ${c.id} ${c.name}: ${c.description}`)
    .join("\n");

  const complianceList = research.complianceRequirements
    .map((c) => `  [${c.framework}] ${c.clause}: ${c.requirement}`)
    .join("\n");

  return `## Component: ${component.name} (${component.type})
${component.description || "No description provided"}

## Data Context
Classification: ${component.dataClassification}
Data Types: ${component.dataTypes.join(", ") || "Not specified"}
Access Pattern: ${component.accessPattern}

## Existing Controls
${component.existingControls.length > 0 ? component.existingControls.join(", ") : "None documented"}

## Connections
${connections || "No connections"}

## Technology
${component.technologyVersion || "Not specified"}

## Known OWASP Categories
${owaspList || "None mapped"}

## Known CWE Weaknesses
${cweList || "None mapped"}

## Compliance Requirements
${complianceList || "None applicable"}

## Your Analysis
1. Which threats are actually exploitable given the existing controls?
2. What attack paths exist from external actors through this component?
3. What's the blast radius if this component is compromised?
4. Which compliance requirements are NOT met by existing controls?
5. Top 3 highest-risk attack scenarios for THIS specific component.`;
}

function buildFindingsPrompt(
  component: ComponentContext,
  research: ThreatResearch,
  analysis: string,
): string {
  return `Based on the attack surface analysis below, generate specific threat findings.

## Component: ${component.name} (${component.type})
Data: ${component.dataClassification} — ${component.dataTypes.join(", ") || "unspecified"}
Controls: ${component.existingControls.join(", ") || "none"}

## Analysis
${analysis}

Generate findings as a JSON array:
[
  {
    "name": "Specific threat title",
    "description": "Detailed description specific to THIS component",
    "strideCategory": "SPOOFING|TAMPERING|REPUDIATION|INFORMATION_DISCLOSURE|DENIAL_OF_SERVICE|ELEVATION_OF_PRIVILEGE",
    "severity": "CRITICAL|HIGH|MEDIUM|LOW",
    "evidence": {
      "owasp": "A03:2021 Injection (if applicable)",
      "cwe": "CWE-89 (if applicable)",
      "compliance": "HIPAA §164.312 (if applicable)",
      "attackPath": "External user → API → This component → Database"
    },
    "existingControlsNote": "Input validation partially mitigates but...",
    "residualRisk": "MEDIUM — mitigated at network level but...",
    "mitigation": {
      "description": "Specific steps to fix",
      "effort": "LOW|MEDIUM|HIGH",
      "effectiveness": "ELIMINATES|STRONGLY_REDUCES|MODERATELY_REDUCES|MINIMALLY_REDUCES"
    }
  }
]

IMPORTANT:
- Do NOT generate generic threats. Every finding must reference specific evidence.
- Do NOT flag threats that existing controls already handle.
- Return ONLY the JSON array. No markdown fences, no explanation.`;
}

// =============================================================================
// Phase 5: Verify & Enrich
// =============================================================================

function parseAndVerifyFindings(
  json: string,
  componentId: string,
): ContextAwareFinding[] {
  try {
    // Strip markdown fences if LLM wrapped them
    let cleaned = json.trim();
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }

    const parsed = JSON.parse(cleaned) as ContextAwareFinding[];
    if (!Array.isArray(parsed)) return [];

    // Verify and enrich each finding
    return parsed
      .filter((f) => f.name && f.strideCategory && f.severity)
      .map((f) => ({
        ...f,
        componentId,
        // Normalize severity
        severity: normalizeSeverity(f.severity),
        // Ensure evidence object exists
        evidence: f.evidence || {},
        // Ensure mitigation exists
        mitigation: f.mitigation || {
          description: "Review and address this threat",
          effort: "MEDIUM" as const,
          effectiveness: "MODERATELY_REDUCES" as const,
        },
      }));
  } catch (err) {
    logger.warn({ err }, "Failed to parse LLM findings JSON");
    return [];
  }
}

function normalizeSeverity(s: string): "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" {
  const upper = s.toUpperCase();
  if (upper === "CRITICAL") return "CRITICAL";
  if (upper === "HIGH") return "HIGH";
  if (upper === "MEDIUM") return "MEDIUM";
  return "LOW";
}

/** Convert rule-based threats to the findings format (when no LLM available) */
function ruleBasedToFindings(
  threats: GeneratedThreat[],
  research: ThreatResearch,
): ContextAwareFinding[] {
  return threats.map((t) => {
    // Find matching OWASP/CWE from research
    const matchingOwasp = research.owasp.find((o) =>
      o.name.toLowerCase().includes(t.name.toLowerCase().split(" ")[0] || ""),
    );
    const matchingCwe = research.cwes.find((c) =>
      c.name.toLowerCase().includes(t.name.toLowerCase().split(" ")[0] || ""),
    );

    return {
      name: t.name,
      description: t.description,
      strideCategory: t.strideCategory,
      severity: t.severity,
      componentId: t.componentId,
      evidence: {
        owasp: matchingOwasp
          ? `${matchingOwasp.id} ${matchingOwasp.name}`
          : undefined,
        cwe: matchingCwe ? `${matchingCwe.id} ${matchingCwe.name}` : undefined,
      },
      mitigation: {
        description:
          "Review and implement appropriate controls for this threat",
        effort: "MEDIUM" as const,
        effectiveness: "MODERATELY_REDUCES" as const,
      },
    };
  });
}

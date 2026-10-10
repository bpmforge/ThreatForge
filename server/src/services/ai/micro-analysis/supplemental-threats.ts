/**
 * Supplemental Threat Generators
 *
 * Rule-based (no LLM) threat generation for:
 * 1. Supply chain / SOUP / OTS dependencies
 * 2. ML/AI model-specific threats
 *
 * Reads from DB (Dependency table, component properties)
 * and maps to pre-built threat templates.
 */
import { getPrisma } from "../../../db.js";
import { getSupplyChainThreats } from "../../threat-generation/supply-chain-threats.js";
import { queryOsvVulnerabilities } from "../../vuln-intel/osv-client.js";
import { isExternalEnrichmentAllowed } from "../../vuln-intel/enrichment-gate.js";
import type { ThreatModelContext } from "../../../types/ai.js";
import { SUPPLY_CHAIN_COMPONENT_SENTINEL } from "./compound-analyzer.js";
import type { MicroThreat } from "./types.js";
import logger from "../../../utils/logger.js";

// Language → package ecosystem mapping
const LANG_TO_ECOSYSTEM: Record<string, string> = {
  javascript: "npm",
  typescript: "npm",
  python: "pypi",
  rust: "cargo",
  java: "maven",
  kotlin: "maven",
  go: "npm", // fallback to common
  shell: "npm",
};

/**
 * Generate supply chain threats from persisted dependencies.
 * Reads Dependency table, maps each to threat templates.
 */
export async function generateSupplyChainThreats(
  threatModelId: string,
): Promise<MicroThreat[]> {
  const prisma = await getPrisma();
  const deps = await prisma.dependency.findMany({
    where: { threatModelId },
  });

  if (deps.length === 0) return [];

  // CVE enrichment makes outbound calls to OSV — only when org policy permits.
  const enrichExternally = await isExternalEnrichmentAllowed(threatModelId);

  const threats: MicroThreat[] = [];

  for (const dep of deps) {
    const ecosystem =
      LANG_TO_ECOSYSTEM[(dep.language || "").toLowerCase()] || "npm";

    // Enrich with real CVEs from OSV when allowed; degrades to templates only.
    let osvCveIds: string[] = [];
    if (enrichExternally) {
      const osv = await queryOsvVulnerabilities(
        ecosystem,
        dep.name,
        dep.version,
      );
      osvCveIds = osv.cveIds;
      if (osvCveIds.length > 0) {
        threats.push({
          name: `Known vulnerabilities in ${dep.name}`,
          description: `OSV reports ${osvCveIds.length} known vulnerability(ies) for ${dep.name}${dep.version ? ` v${dep.version}` : ""}: ${osvCveIds.slice(0, 5).join(", ")}${osvCveIds.length > 5 ? ", …" : ""}.${osv.summary ? ` ${osv.summary}` : ""}`,
          category: "TAMPERING",
          severity: "HIGH",
          componentId: SUPPLY_CHAIN_COMPONENT_SENTINEL,
          componentName: `Dependency: ${dep.name}`,
          cweIds: ["CWE-1395"],
          owaspIds: ["A06:2021"],
          cveIds: osvCveIds,
          evidence: {
            attackPath: `Exploit a published CVE in ${dep.name} reachable through the application's use of the dependency.`,
          },
          mitigations: [
            {
              description: `Upgrade ${dep.name} to a patched version and add automated dependency vulnerability scanning to CI.`,
              controlCategory: "SUPPLY_CHAIN",
              testCriteria: `Verify ${dep.name} is upgraded past all listed CVEs and that CI fails on new known-vulnerable dependencies`,
              effort: "MEDIUM",
              effectiveness: "0.7",
            },
          ],
          mitigation: {
            description: `Upgrade ${dep.name} past the listed CVEs; enforce SCA scanning in CI.`,
            effort: "MEDIUM",
            effectiveness: "0.7",
          },
          confidence: 0.95,
          sourceMethodology: "supply_chain",
        });
      }
    }

    const templates = getSupplyChainThreats(
      ecosystem as
        | "npm"
        | "pypi"
        | "cargo"
        | "maven"
        | "docker"
        | "github-action",
    );

    // Only take the top 2 most relevant templates per dependency
    for (const tmpl of templates.slice(0, 2)) {
      threats.push({
        name: `${tmpl.name}: ${dep.name}`,
        description: `${tmpl.description} Affects dependency: ${dep.name}${dep.version ? ` v${dep.version}` : ""} (${dep.type}, ${dep.language || "unknown"}).`,
        category: tmpl.strideCategory,
        severity: tmpl.severity,
        componentId: SUPPLY_CHAIN_COMPONENT_SENTINEL,
        componentName: `Dependency: ${dep.name}`,
        cweIds: tmpl.references.filter((r) => r.startsWith("CWE-")),
        owaspIds: [],
        evidence: {
          attackPath: tmpl.attackVector,
        },
        mitigations: [
          {
            description: tmpl.mitigation,
            controlCategory: "SUPPLY_CHAIN",
            testCriteria: `Verify that ${dep.name} is pinned to exact version, integrity-checked, and scanned for vulnerabilities`,
            effort: "MEDIUM",
            effectiveness: "0.55",
          },
        ],
        mitigation: {
          description: tmpl.mitigation,
          effort: "MEDIUM",
          effectiveness: "0.55",
        },
        confidence: 0.85,
        sourceMethodology: "supply_chain",
      });
    }
  }

  logger.info(
    { dependencies: deps.length, threats: threats.length },
    "Supply chain threats generated",
  );
  return threats;
}

/**
 * Component TYPE allowlist for ML/AI detection. Exact match only
 * (never substring): a component whose type is e.g. "html_template" must
 * not match on "ml" the way `.includes("ml")` used to.
 */
const ML_TYPES = new Set([
  "ai_ml_model",
  "llm_api",
  "training_pipeline",
  "feature_store",
  "vector_db",
  "embedding_service",
  "ai_agent",
]);

/**
 * Name-based ML signal tokens, matched on word boundaries only (never
 * bare substring). Split into STRONG (unambiguous outside an ML context —
 * a real component is never named "Embedding" or "LLM" for a non-ML
 * reason) and WEAK (also common in non-ML names: "User Agent Service",
 * "Data Model API", "Vector Graphics" all contain a WEAK token but are not
 * ML components). A single WEAK hit is not enough signal; two WEAK/STRONG
 * hits together are, because coincidental double collisions are rare.
 */
const STRONG_ML_NAME_TOKENS = [
  "llm",
  "gpt",
  "embedding",
  "tensorflow",
  "neural",
  "random forest",
  "anomaly detection",
];
const WEAK_ML_NAME_TOKENS = ["ml", "model", "agent", "vector"];

function escapeRegExp(token: string): string {
  return token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hasWordBoundaryMatch(haystack: string, token: string): boolean {
  return new RegExp(`\\b${escapeRegExp(token)}\\b`, "i").test(haystack);
}

/**
 * True when a component's name carries enough ML signal to treat it as an
 * ML component: any STRONG token alone, or two-or-more WEAK/STRONG tokens
 * together. Word-boundary matched throughout — see token comment above.
 */
export function hasMLNameSignal(name: string): boolean {
  let strongHit = false;
  let signalCount = 0;
  for (const token of STRONG_ML_NAME_TOKENS) {
    if (hasWordBoundaryMatch(name, token)) {
      strongHit = true;
      signalCount++;
    }
  }
  for (const token of WEAK_ML_NAME_TOKENS) {
    if (hasWordBoundaryMatch(name, token)) signalCount++;
  }
  return strongHit || signalCount >= 2;
}

/** True when the component's declared type or name indicates ML/AI usage. */
export function isMLComponent(c: { type: string; name: string }): boolean {
  return ML_TYPES.has(c.type.toLowerCase()) || hasMLNameSignal(c.name);
}

/**
 * Generate ML/AI-specific threats from components with ML indicators.
 * A component matches by an exact TYPE allowlist hit, or by carrying at
 * least two independent ML name signals (see `hasMLNameSignal`) — never
 * a bare substring match. A plain `.includes("agent"|"model"|...)` check
 * would hardcode threats onto components like "User Agent Service" that
 * have nothing to do with ML.
 */
export async function generateMLThreats(
  threatModelId: string,
  context: ThreatModelContext,
): Promise<MicroThreat[]> {
  const mlComponents = context.components.filter((c) => isMLComponent(c));

  if (mlComponents.length === 0) return [];

  const threats: MicroThreat[] = [];

  for (const comp of mlComponents) {
    const mlThreats: Array<{
      name: string;
      desc: string;
      cat: string;
      sev: MicroThreat["severity"];
      cwe: string;
      test: string;
    }> = [
      {
        name: `Model poisoning: ${comp.name}`,
        desc: `Attacker manipulates training data to cause the model to produce incorrect predictions. If ${comp.name} is retrained on live data, poisoned inputs could shift decision boundaries.`,
        cat: "TAMPERING",
        sev: "CRITICAL",
        cwe: "CWE-1327",
        test: `Verify that training data undergoes integrity validation and anomaly detection before model retraining`,
      },
      {
        name: `Adversarial input evasion: ${comp.name}`,
        desc: `Crafted inputs cause ${comp.name} to misclassify or produce wrong outputs. In a threat model context, this could mean missed threats or false negatives.`,
        cat: "TAMPERING",
        sev: "HIGH",
        cwe: "CWE-693",
        test: `Verify that model inputs are validated against expected distributions and outliers are flagged`,
      },
      {
        name: `Model extraction via query access: ${comp.name}`,
        desc: `Attacker with query access to ${comp.name} can reconstruct the model through systematic probing, stealing proprietary algorithms.`,
        cat: "INFORMATION_DISCLOSURE",
        sev: "HIGH",
        cwe: "CWE-200",
        test: `Verify that model API has rate limiting and does not return confidence scores or internal representations`,
      },
      {
        name: `Training data leakage: ${comp.name}`,
        desc: `${comp.name} may memorize and leak sensitive training data through its outputs, especially if trained on PII or proprietary data.`,
        cat: "INFORMATION_DISCLOSURE",
        sev: "MEDIUM",
        cwe: "CWE-212",
        test: `Verify that model outputs do not contain or correlate to individual training records`,
      },
      {
        name: `Prompt injection: ${comp.name}`,
        desc: `Attacker embeds malicious instructions in user-controlled input to override system prompt constraints and hijack ${comp.name} behavior, causing unintended actions or data disclosure.`,
        cat: "TAMPERING",
        sev: "CRITICAL",
        cwe: "CWE-77",
        test: `Verify that user input is sanitized before being passed to ${comp.name} and that system instructions cannot be overridden by user content`,
      },
      {
        name: `Excessive agency / tool misuse: ${comp.name}`,
        desc: `If ${comp.name} has access to tools or external systems, an attacker may manipulate it into taking unintended real-world actions (file deletion, email sending, code execution) through crafted inputs.`,
        cat: "ELEVATION_OF_PRIVILEGE",
        sev: "CRITICAL",
        cwe: "CWE-250",
        test: `Verify that ${comp.name} operates under least-privilege tool access and that irreversible actions require human-in-the-loop confirmation`,
      },
      {
        name: `Model supply chain compromise: ${comp.name}`,
        desc: `${comp.name} may use a pre-trained model, library, or dataset from a public registry that has been tampered with, inserting backdoors that persist through fine-tuning.`,
        cat: "TAMPERING",
        sev: "HIGH",
        cwe: "CWE-494",
        test: `Verify that model weights are sourced from trusted registries, checksums are validated, and dependencies are pinned to specific versions`,
      },
    ];

    for (const t of mlThreats) {
      threats.push({
        name: t.name,
        description: t.desc,
        category: t.cat,
        severity: t.sev,
        componentId: comp.id,
        componentName: comp.name,
        cweIds: [t.cwe],
        owaspIds: [],
        evidence: {},
        mitigations: [
          {
            description: t.name.split(":")[0] + " controls",
            controlCategory: "INPUT_VALIDATION",
            testCriteria: t.test,
            effort: "HIGH",
            effectiveness: "0.45",
          },
        ],
        mitigation: {
          description: t.name.split(":")[0] + " controls",
          effort: "HIGH",
          effectiveness: "0.45",
        },
        confidence: 0.8,
        sourceMethodology: "ml_threat",
      });
    }
  }

  logger.info(
    { mlComponents: mlComponents.length, threats: threats.length },
    "ML threats generated",
  );
  return threats;
}

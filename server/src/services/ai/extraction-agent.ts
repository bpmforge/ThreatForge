/**
 * Extraction Agent — Agentic Loop for Architecture Extraction
 *
 * Instead of a single LLM call, this agent iterates until confident:
 *
 * Pass 1: EXTRACT — Initial architecture extraction from document
 * Pass 2: VALIDATE — Check for missed components, flows, boundaries
 * Pass 3: ENRICH — Add trust levels, data classification, SOUP/OTS
 * Pass 4: CROSS-REFERENCE — Merge with other document extractions
 *
 * Confidence gate: loops back if coverage < 85%
 */
import type { AIProviderClient } from "../../types/ai.js";
import logger from "../../utils/logger.js";
import { normalizeForQuoteCheck } from "../../utils/text-normalize.js";
import { coerceComponentTypeOrCustom } from "./component-types.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * verificationStatus on an extracted artifact:
 *   VERIFIED   — sourceText is a verbatim substring of the source document
 *   UNVERIFIED — LLM emitted sourceText but it cannot be located in the doc
 *   INFERRED   — populated by applyComponentDefaults / heuristics, no quote
 *   undefined  — not yet verified (e.g., legacy data)
 */
type ExtractionVerificationStatus = "VERIFIED" | "UNVERIFIED" | "INFERRED";

export interface ExtractedComponent {
  id: string;
  name: string;
  type: string;
  description?: string;
  technology?: string;
  dataHandled?: string[];
  dataClassification?: string[]; // pii, phi, pci, credentials, internal, public
  trustLevel?: "UNTRUSTED" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  confidence: number;
  sourceText?: string;
  sourceDocument?: string;
  derivedFrom?: string;
  verificationStatus?: ExtractionVerificationStatus;
}

interface ExtractedDataFlow {
  id: string;
  sourceId: string;
  targetId: string;
  label?: string;
  protocol?: string;
  dataTypes?: string[];
  encrypted?: boolean;
  authentication?: string;
  trustBoundaryCross?: boolean;
  confidence: number;
  sourceText?: string;
  sourceDocument?: string;
  verificationStatus?: ExtractionVerificationStatus;
}

interface ExtractedBoundary {
  id: string;
  name: string;
  type?: string;
  trustLevel?: "UNTRUSTED" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  componentIds: string[];
  confidence: number;
  sourceText?: string;
  verificationStatus?: ExtractionVerificationStatus;
}

export interface ExtractedDependency {
  name: string;
  version?: string;
  type: "direct" | "external" | "ots" | "soup";
  language?: string;
  riskLevel: "low" | "medium" | "high" | "critical";
  knownVulnerabilities?: string;
  sourceDocument?: string;
}

export interface ExtractedMLComponent {
  id: string;
  name: string;
  framework?: string;
  modelType?: string;
  trainingDataDescription?: string;
  inputFormat?: string;
  outputFormat?: string;
  attackSurface: string[];
  sourceDocument?: string;
}

export interface ExtractionResult {
  components: ExtractedComponent[];
  dataFlows: ExtractedDataFlow[];
  boundaries: ExtractedBoundary[];
  dependencies: ExtractedDependency[];
  mlComponents: ExtractedMLComponent[];
  technologies: string[];
  dataTypes: string[];
  securityRequirements?: Array<{
    id: string;
    requirement: string;
    category: string;
    implication: string;
  }>;
  confidence: number;
  warnings: string[];
  passesCompleted: number;
  coverageMetrics: CoverageMetrics;
}

export interface CoverageMetrics {
  componentCount: number;
  flowCount: number;
  boundaryCount: number;
  componentsWithTrustLevels: number;
  componentsWithDataClassification: number;
  flowsWithProtocol: number;
  flowsWithEncryptionStatus: number;
  boundariesWithComponents: number;
  dependenciesExtracted: number;
  mlComponentsExtracted: number;
  overallScore: number; // 0-100
  /**
   * Reported only — fraction (0-1) of extracted artifacts (components + flows
   * + boundaries) whose sourceText is a verbatim substring of the source doc.
   * Items in INFERRED state (defaulted by applyComponentDefaults) are
   * EXCLUDED from both numerator and denominator so heuristic fills don't
   * tank the score. NOT folded into overallScore — used for QA visibility
   * and downstream filtering.
   */
  quotesCoverage?: number;
  /** Counts behind quotesCoverage — useful for debug + UI surfaces. */
  quotesVerified?: number;
  quotesUnverified?: number;
  quotesInferred?: number;
}

interface PassResult {
  pass: number;
  name: string;
  duration: number;
}

// ---------------------------------------------------------------------------
// Prompts
// ---------------------------------------------------------------------------

const PASS_1_EXTRACT = `You are an expert software architect extracting system architecture from technical documentation. Be EXHAUSTIVE — extract EVERY component, data flow, and boundary mentioned or implied.

## CRITICAL: Things Most Extractors Miss
1. **ML/AI models** — Random Forest, neural networks, TensorFlow models are COMPONENTS with attack surfaces
2. **Configuration services** — etcd, Consul, config servers control system behavior
3. **Message topics/queues** — Each Kafka topic, SQS queue is a distinct component
4. **External gateways** — SMS gateways, email services, webhook endpoints
5. **Monitoring/APM** — Datadog, Prometheus, log aggregators receive sensitive telemetry
6. **IaC/Terraform** — Infrastructure management is an attack surface
7. **SOUP/OTS dependencies** — Third-party libraries listed in the document

## Trust Level Assignment (MANDATORY for every component)
- UNTRUSTED: Internet-facing, sensors, external users, public APIs
- LOW: DMZ components, API gateways, ingestion services
- MEDIUM: Internal services, message brokers
- HIGH: Databases, config services, auth services, secrets
- CRITICAL: ML models (data poisoning risk), encryption key stores

## Data Classification (MANDATORY for every component that handles data)
- pii: Personal data (names, emails, user IDs)
- phi: Health/medical data
- pci: Payment card data
- credentials: API keys, tokens, certificates, passwords
- sensor_data: IoT/telemetry data (can be proprietary)
- internal: Business logic, algorithms, trade secrets
- public: Non-sensitive data

Return as JSON:
\`\`\`json
{
  "components": [
    {
      "id": "slug-id",
      "name": "Name",
      "type": "WEB_APP|API|API_GATEWAY|DATABASE|CACHE|QUEUE|OBJECT_STORAGE|FILE_SYSTEM|AUTH_SERVICE|EXTERNAL_ENTITY|ACTOR|MICROSERVICE|LOAD_BALANCER|CDN|FIREWALL|WAF|IAM|CONTAINER|KUBERNETES|VM|SERVERLESS|AI_ML_MODEL|<vendor-specific like AWS_S3|AWS_RDS|AZURE_COSMOS|GCP_CLOUDSQL when document literally names the product>",
      "description": "What it does",
      "technology": "Specific tech",
      "dataHandled": ["types of data"],
      "dataClassification": ["pii","credentials","internal","sensor_data"],
      "trustLevel": "UNTRUSTED|LOW|MEDIUM|HIGH|CRITICAL",
      "confidence": 0.0-1.0,
      "sourceText": "Quote from document"
    }
  ],
  "dataFlows": [
    {
      "id": "flow-id",
      "sourceId": "component-id",
      "targetId": "component-id",
      "label": "What flows",
      "protocol": "HTTPS|HTTP|gRPC|WebSocket|TCP|SQL|AMQP|Kafka|Redis|MQTT",
      "dataTypes": ["what data"],
      "encrypted": true|false,
      "authentication": "mTLS|JWT|API_KEY|certificate|none|unknown",
      "trustBoundaryCross": true|false,
      "confidence": 0.0-1.0
    }
  ],
  "boundaries": [
    {
      "id": "boundary-id",
      "name": "Zone name",
      "type": "trust|network|vpc|organization",
      "trustLevel": "UNTRUSTED|LOW|MEDIUM|HIGH|CRITICAL",
      "componentIds": ["ids inside this zone"],
      "confidence": 0.0-1.0
    }
  ],
  "dependencies": [
    {
      "name": "library-name",
      "version": "if mentioned",
      "type": "direct|external|ots|soup",
      "language": "Go|Python|JavaScript|etc",
      "riskLevel": "low|medium|high|critical"
    }
  ],
  "mlComponents": [
    {
      "id": "ml-component-id",
      "name": "Model name",
      "framework": "TensorFlow|PyTorch|scikit-learn",
      "modelType": "Random Forest|Neural Network|etc",
      "trainingDataDescription": "What data trained it",
      "inputFormat": "What it takes as input",
      "outputFormat": "What it produces",
      "attackSurface": ["model poisoning", "adversarial inputs", "training data leakage"]
    }
  ],
  "technologies": ["all tech mentioned"],
  "dataTypes": ["pii","credentials","sensor_data","internal"],
  "securityRequirements": [
    {
      "id": "req-id",
      "requirement": "Original text",
      "category": "authentication|authorization|encryption|audit|compliance",
      "implication": "How this affects threats"
    }
  ],
  "confidence": 0.0-1.0,
  "warnings": ["anything unclear or missing"]
}
\`\`\`

## Source-Quote Discipline (mandatory for every artifact)

Every component, dataFlow, and boundary you emit MUST carry a "sourceText" field with a VERBATIM sentence (or short fragment) copied character-for-character from the document. Not a paraphrase. Not a summary. The exact text.

If a component / flow / boundary is GENUINELY implied (e.g., "RBAC mentioned" → an auth service must exist) and no single sentence supports it, set sourceText to "INFERRED: <one-sentence rationale>". The verifier will mark these as INFERRED rather than VERIFIED — both are acceptable, but a fabricated "verbatim" quote that isn't in the document will be rejected as UNVERIFIED.

Do not invent plausible-sounding quotes. The verifier substring-checks every sourceText against the document text. A confident wrong quote is worse than an honest INFERRED rationale.

IMPORTANT:
- Extract ALL components — even implied ones (e.g., "sends SMS" implies SMS gateway)
- Every dataFlow MUST have valid sourceId/targetId referencing component IDs
- Every component MUST have trustLevel and dataClassification
- Every boundary MUST list its componentIds
- Extract dependencies/SOUP/OTS if listed in the document
- Extract ML/AI models as separate components with attack surfaces`;

const PASS_2_VALIDATE = `You are reviewing an architecture extraction for COMPLETENESS. The original document and the extraction are provided below.

Your job: find what was MISSED. Compare the extraction against the source document and identify:

1. **Missing components** — Any system, service, model, database, queue, or external integration mentioned in the doc but not in the extraction
2. **Missing data flows** — Any described communication path not captured
3. **Missing trust boundaries** — Any security zone or network segment implied but not defined
4. **Incorrect trust levels** — Components with wrong trust levels (e.g., sensors marked MEDIUM instead of UNTRUSTED)
5. **Missing data classification** — Components handling sensitive data without proper classification
6. **Missing dependencies** — SOUP/OTS libraries listed in the doc but not extracted
7. **Missing ML/AI components** — Any machine learning model or AI system not captured

## Source-quote discipline (mandatory for every "missing" claim)

Every entry in missingComponents / missingFlows / missingBoundaries / missingDependencies / missingMLComponents MUST carry a "sourceText" field with a VERBATIM sentence from the document that proves the item is actually mentioned. Not a paraphrase. The verifier substring-checks each sourceText against the document; entries whose quote isn't found are dropped automatically as phantom-missings. A confident phantom is worse than a small list of well-grounded misses.

If you cannot find a verbatim quote for something you'd like to flag as missing, do not flag it. Either omit it, or list it under "gaps" with a short note for the human reviewer.

## Challenge-Defend (adversarial self-review)

After producing the missingComponents list, pick the 3 highest-impact entries (CRITICAL trust level first, then HIGH, then by structural importance). For EACH of those three, choose ONE action:

  DEFEND — supply a "citation" field with the verbatim doc quote that grounds this claim. The quote MUST appear in the document text. A DEFEND without a quote is treated as RETRACT.
  QUALIFY — narrow the claim. Provide "qualification" with a more conservative restatement.
  RETRACT — withdraw the claim. The missing entry is dropped before enrichment.

This catches LLM tendency to "find" missing items that aren't really there.

Return as JSON:
\`\`\`json
{
  "missingComponents": [
    {"name": "...", "type": "...", "sourceText": "verbatim quote from doc", "trustLevel": "..."}
  ],
  "missingFlows": [
    {"sourceId": "...", "targetId": "...", "sourceText": "verbatim quote", "description": "...", "protocol": "...", "encrypted": false}
  ],
  "missingBoundaries": [
    {"name": "...", "sourceText": "verbatim quote", "trustLevel": "...", "componentIds": ["..."]}
  ],
  "trustLevelCorrections": [
    {"componentId": "...", "currentLevel": "MEDIUM", "correctLevel": "UNTRUSTED", "reason": "..."}
  ],
  "missingClassifications": [
    {"componentId": "...", "missingClassifications": ["credentials", "sensor_data"], "reason": "..."}
  ],
  "missingDependencies": [
    {"name": "...", "type": "soup|ots|direct", "language": "...", "sourceText": "verbatim quote"}
  ],
  "missingMLComponents": [
    {"name": "...", "framework": "...", "sourceText": "verbatim quote"}
  ],
  "defenses": [
    {"name": "missing component name", "action": "DEFEND", "citation": "verbatim doc quote"},
    {"name": "missing component name", "action": "QUALIFY", "qualification": "narrower restated claim"},
    {"name": "missing component name", "action": "RETRACT", "rationale": "why withdrawing"}
  ],
  "completenessScore": 0-100,
  "gaps": ["concrete missing input (not 'more detail') — names a specific section / fact you couldn't extract"]
}
\`\`\`

Be THOROUGH but HONEST. A real security architect would not invent missing items to look diligent.`;

const PASS_3_ENRICH = `You are enriching an architecture extraction with security-critical details. The extraction and validation gaps are provided below.

Your job:
1. **Fix all gaps** identified in the validation pass
2. **Infer trust boundary crossings** — mark data flows that cross between zones of different trust levels
3. **Add authentication expectations** — for each flow, what auth SHOULD be there?
4. **Map data sensitivity** — which flows carry the most sensitive data?
5. **Identify implied components** — services that MUST exist but aren't mentioned (e.g., if there's RBAC, there must be an auth service)

Return the COMPLETE, CORRECTED extraction as JSON (same schema as the initial extraction). Include ALL original components plus any new ones discovered. Fix trust levels, add missing classifications, add missing flows.

IMPORTANT: Return the full merged result, not just the additions.`;

// ---------------------------------------------------------------------------
// Agent Pipeline
// ---------------------------------------------------------------------------

const MIN_CONFIDENCE = 85;
const MAX_LOOPS = 3;

export async function runExtractionAgent(
  client: AIProviderClient,
  documentText: string,
  options?: {
    documentType?: string;
    existingExtraction?: ExtractionResult;
    onProgress?: (pass: number, name: string, status: string) => void;
  },
): Promise<ExtractionResult> {
  const startTime = Date.now();
  const passes: PassResult[] = [];
  const report = options?.onProgress || (() => {});

  // --- Pass 1: Initial extraction ---
  report(1, "Extract Architecture", "running");
  const pass1Raw = await runPass(
    client,
    PASS_1_EXTRACT,
    `## Document\n${documentText}`,
  );
  let extraction = parseExtractionResult(pass1Raw);
  passes.push({ pass: 1, name: "Extract", duration: Date.now() - startTime });
  report(
    1,
    "Extract Architecture",
    `complete (${extraction.components.length} components, ${extraction.dataFlows.length} flows)`,
  );

  // --- Validation/enrichment loop ---
  for (let loop = 0; loop < MAX_LOOPS; loop++) {
    const coverage = calculateCoverage(extraction);

    if (coverage.overallScore >= MIN_CONFIDENCE) {
      logger.info(
        { score: coverage.overallScore, loop },
        "Extraction confidence met, stopping loop",
      );
      break;
    }

    // --- Pass 2: Validate ---
    report(2, `Validate (loop ${loop + 1})`, "running");
    const pass2Input = `## Original Document\n${documentText}\n\n## Current Extraction\n${JSON.stringify(extraction, null, 2)}`;
    const pass2Raw = await runPass(client, PASS_2_VALIDATE, pass2Input);
    const gaps = parseValidationGaps(pass2Raw);

    // Phantom-missing kill: drop any "missing X" entry whose sourceText
    // isn't in the document. Apply Challenge-Defend retractions next —
    // a DEFEND without an in-doc citation is silently promoted to RETRACT.
    const purge = purgePhantomMissings(gaps, documentText, {
      requireSourceText: true,
    });
    const defense = applyValidationDefenses(gaps, documentText);

    passes.push({
      pass: 2,
      name: `Validate-${loop + 1}`,
      duration: Date.now() - startTime,
    });
    report(
      2,
      `Validate (loop ${loop + 1})`,
      `found ${gaps.missingComponents.length} components, ${gaps.missingFlows.length} flows, score=${gaps.completenessScore} (purged ${purge.removed} phantoms, retracted ${defense.dropped})`,
    );

    // If validation says we're complete, stop
    if (
      gaps.completenessScore >= MIN_CONFIDENCE &&
      gaps.missingComponents.length === 0 &&
      gaps.missingFlows.length === 0
    ) {
      break;
    }

    // --- Pass 3: Enrich ---
    report(3, `Enrich (loop ${loop + 1})`, "running");
    const pass3Input = `## Original Document\n${documentText}\n\n## Current Extraction\n${JSON.stringify(extraction, null, 2)}\n\n## Validation Gaps Found\n${JSON.stringify(gaps, null, 2)}`;
    const pass3Raw = await runPass(client, PASS_3_ENRICH, pass3Input);
    const enriched = parseExtractionResult(pass3Raw);

    // Merge enriched into extraction (take the better one)
    if (enriched.components.length >= extraction.components.length) {
      extraction = enriched;
    } else {
      // Merge additions without losing existing data
      extraction = mergeExtractions(extraction, enriched);
    }

    passes.push({
      pass: 3,
      name: `Enrich-${loop + 1}`,
      duration: Date.now() - startTime,
    });
    report(
      3,
      `Enrich (loop ${loop + 1})`,
      `now ${extraction.components.length} components, ${extraction.dataFlows.length} flows`,
    );
  }

  // Verify every artifact's sourceText against the document BEFORE applying
  // defaults — defaults will mark any item it touches as INFERRED and we
  // don't want to overwrite a verified status with an inferred one.
  validateExtractionQuotes(extraction, documentText);

  // Apply sensible defaults for fields the LLM sometimes skips
  applyComponentDefaults(extraction);

  // Calculate final coverage (now includes quotesCoverage)
  const finalCoverage = calculateCoverage(extraction);
  extraction.coverageMetrics = finalCoverage;
  extraction.confidence = finalCoverage.overallScore / 100;
  extraction.passesCompleted = passes.length;

  logger.info(
    {
      components: extraction.components.length,
      flows: extraction.dataFlows.length,
      boundaries: extraction.boundaries.length,
      deps: extraction.dependencies.length,
      ml: extraction.mlComponents.length,
      confidence: finalCoverage.overallScore,
      quotesCoverage: finalCoverage.quotesCoverage,
      verified: finalCoverage.quotesVerified,
      unverified: finalCoverage.quotesUnverified,
      inferred: finalCoverage.quotesInferred,
      passes: passes.length,
      duration: Date.now() - startTime,
    },
    "Extraction agent complete",
  );

  return extraction;
}

// ---------------------------------------------------------------------------
// Quote validation — source-grounding
// ---------------------------------------------------------------------------

/**
 * For every component / dataFlow / boundary, decide its verificationStatus
 * by checking sourceText against the original document.
 *
 *   "INFERRED: <rationale>"     → INFERRED (LLM admitted no direct quote)
 *   sourceText is verbatim hit  → VERIFIED
 *   sourceText present, no hit  → UNVERIFIED (likely fabricated/paraphrased)
 *   sourceText missing entirely → leave undefined (defaults pass may set INFERRED)
 *
 * Match is whitespace-tolerant + case-insensitive. Text shorter than 12
 * chars is too short to be discriminating and is treated as INFERRED so a
 * one-word "quote" doesn't false-positive against a long document.
 */
export function validateExtractionQuotes(
  extraction: ExtractionResult,
  documentText: string,
): void {
  const normalizedDoc = normalizeForQuoteCheck(documentText);

  const verifyOne = (item: {
    sourceText?: string;
  }): ExtractionVerificationStatus | undefined => {
    if (!item.sourceText) return undefined;
    const text = item.sourceText.trim();
    if (text.toUpperCase().startsWith("INFERRED:")) return "INFERRED";
    const normalized = normalizeForQuoteCheck(text);
    if (normalized.length < 12) return "INFERRED";
    return normalizedDoc.includes(normalized) ? "VERIFIED" : "UNVERIFIED";
  };

  for (const c of extraction.components) {
    const status = verifyOne(c);
    if (status) c.verificationStatus = status;
  }
  for (const f of extraction.dataFlows) {
    const status = verifyOne(f);
    if (status) f.verificationStatus = status;
  }
  for (const b of extraction.boundaries) {
    const status = verifyOne(b);
    if (status) b.verificationStatus = status;
  }
}

// ---------------------------------------------------------------------------
// Multi-Document Merge
// ---------------------------------------------------------------------------

/**
 * Merge extractions from multiple documents into a single unified extraction.
 * Cross-references components by ID and name, deduplicates, and combines
 * data flows and boundaries.
 */
export function mergeMultiDocExtractions(
  extractions: Array<{ extraction: ExtractionResult; documentName: string }>,
): ExtractionResult {
  const componentMap = new Map<string, ExtractedComponent>();
  const flowMap = new Map<string, ExtractedDataFlow>();
  const boundaryMap = new Map<string, ExtractedBoundary>();
  const depMap = new Map<string, ExtractedDependency>();
  const mlMap = new Map<string, ExtractedMLComponent>();
  const allTechs = new Set<string>();
  const allDataTypes = new Set<string>();
  const allWarnings: string[] = [];
  const allSecReqs: ExtractionResult["securityRequirements"] = [];

  for (const { extraction, documentName } of extractions) {
    // Merge components (by ID, prefer higher confidence)
    for (const comp of extraction.components) {
      const existing = componentMap.get(comp.id);
      if (!existing || comp.confidence > existing.confidence) {
        componentMap.set(comp.id, {
          ...comp,
          sourceDocument: documentName,
        });
      } else if (existing) {
        // Merge missing fields from lower-confidence version
        if (!existing.technology && comp.technology) {
          existing.technology = comp.technology;
        }
        if (
          (!existing.dataClassification ||
            existing.dataClassification.length === 0) &&
          comp.dataClassification?.length
        ) {
          existing.dataClassification = comp.dataClassification;
        }
        if (!existing.trustLevel && comp.trustLevel) {
          existing.trustLevel = comp.trustLevel;
        }
      }
    }

    // Also try to match by name (fuzzy) for components with different IDs
    for (const comp of extraction.components) {
      if (componentMap.has(comp.id)) continue;
      const nameMatch = [...componentMap.values()].find(
        (c) =>
          c.name.toLowerCase() === comp.name.toLowerCase() ||
          c.name.toLowerCase().includes(comp.name.toLowerCase()) ||
          comp.name.toLowerCase().includes(c.name.toLowerCase()),
      );
      if (!nameMatch) {
        componentMap.set(comp.id, { ...comp, sourceDocument: documentName });
      }
    }

    // Merge flows (deduplicate by source+target)
    for (const flow of extraction.dataFlows) {
      const key = `${flow.sourceId}→${flow.targetId}`;
      const existing = flowMap.get(key);
      if (!existing || flow.confidence > existing.confidence) {
        flowMap.set(key, { ...flow, sourceDocument: documentName });
      }
    }

    // Merge boundaries
    for (const boundary of extraction.boundaries) {
      const existing = boundaryMap.get(boundary.id);
      if (!existing) {
        boundaryMap.set(boundary.id, boundary);
      } else {
        // Merge component lists
        const merged = new Set([
          ...existing.componentIds,
          ...boundary.componentIds,
        ]);
        existing.componentIds = [...merged];
        if (!existing.trustLevel && boundary.trustLevel) {
          existing.trustLevel = boundary.trustLevel;
        }
      }
    }

    // Merge dependencies
    for (const dep of extraction.dependencies) {
      depMap.set(dep.name, { ...dep, sourceDocument: documentName });
    }

    // Merge ML components
    for (const ml of extraction.mlComponents) {
      mlMap.set(ml.id, { ...ml, sourceDocument: documentName });
    }

    // Collect tech, data types, warnings
    for (const t of extraction.technologies) allTechs.add(t);
    for (const d of extraction.dataTypes) allDataTypes.add(d);
    for (const w of extraction.warnings) {
      allWarnings.push(`[${documentName}] ${w}`);
    }
    if (extraction.securityRequirements) {
      allSecReqs.push(...extraction.securityRequirements);
    }
  }

  // Validate flow references — remove flows pointing to non-existent components
  const validComponentIds = new Set(componentMap.keys());
  const validFlows = [...flowMap.values()].filter((f) => {
    const valid =
      validComponentIds.has(f.sourceId) && validComponentIds.has(f.targetId);
    if (!valid) {
      allWarnings.push(
        `Removed orphan flow: ${f.sourceId} → ${f.targetId} (component not found)`,
      );
    }
    return valid;
  });

  // Infer trust boundary crossings
  const compBoundaryMap = new Map<string, string>();
  for (const boundary of boundaryMap.values()) {
    for (const cid of boundary.componentIds) {
      compBoundaryMap.set(cid, boundary.trustLevel || "MEDIUM");
    }
  }
  for (const flow of validFlows) {
    const srcTrust = compBoundaryMap.get(flow.sourceId);
    const tgtTrust = compBoundaryMap.get(flow.targetId);
    if (srcTrust && tgtTrust && srcTrust !== tgtTrust) {
      flow.trustBoundaryCross = true;
    }
  }

  const merged: ExtractionResult = {
    components: [...componentMap.values()],
    dataFlows: validFlows,
    boundaries: [...boundaryMap.values()],
    dependencies: [...depMap.values()],
    mlComponents: [...mlMap.values()],
    technologies: [...allTechs],
    dataTypes: [...allDataTypes],
    securityRequirements: allSecReqs,
    confidence: 0,
    warnings: allWarnings,
    passesCompleted: 0,
    coverageMetrics: calculateCoverage({
      components: [...componentMap.values()],
      dataFlows: validFlows,
      boundaries: [...boundaryMap.values()],
      dependencies: [...depMap.values()],
      mlComponents: [...mlMap.values()],
      technologies: [...allTechs],
      dataTypes: [...allDataTypes],
      confidence: 0,
      warnings: [],
      passesCompleted: 0,
      coverageMetrics: {} as CoverageMetrics,
    }),
  };
  merged.confidence = merged.coverageMetrics.overallScore / 100;

  return merged;
}

// ---------------------------------------------------------------------------
// Post-Extraction Defaults
// ---------------------------------------------------------------------------

/**
 * Apply sensible defaults for fields the LLM sometimes skips.
 * Ensures every component has trustLevel, dataClassification, and dataHandled.
 */
function applyComponentDefaults(extraction: ExtractionResult): void {
  // Trust level defaults by component type
  const TRUST_DEFAULTS: Record<string, ExtractedComponent["trustLevel"]> = {
    actor: "UNTRUSTED",
    client: "UNTRUSTED",
    externalService: "UNTRUSTED",
    sensor: "UNTRUSTED",
    apiGateway: "LOW",
    loadBalancer: "LOW",
    api: "LOW",
    service: "MEDIUM",
    queue: "MEDIUM",
    monitoringService: "MEDIUM",
    database: "HIGH",
    cache: "HIGH",
    authService: "HIGH",
    configService: "HIGH",
    storage: "HIGH",
    mlModel: "CRITICAL",
    firewall: "MEDIUM",
  };

  // Data classification defaults by component type
  const CLASSIFICATION_DEFAULTS: Record<string, string[]> = {
    database: ["internal"],
    cache: ["internal"],
    authService: ["credentials"],
    configService: ["internal"],
    mlModel: ["internal"],
    actor: ["public"],
    externalService: ["internal"],
    queue: ["internal"],
    api: ["internal"],
    apiGateway: ["internal"],
    service: ["internal"],
  };

  for (const comp of extraction.components) {
    // Fill missing trustLevel
    if (!comp.trustLevel) {
      comp.trustLevel = TRUST_DEFAULTS[comp.type] || "MEDIUM";
    }

    // Fill missing dataClassification
    if (!comp.dataClassification || comp.dataClassification.length === 0) {
      comp.dataClassification = CLASSIFICATION_DEFAULTS[comp.type] || [
        "internal",
      ];
    }

    // Fill missing dataHandled from dataClassification
    if (!comp.dataHandled || comp.dataHandled.length === 0) {
      comp.dataHandled = comp.dataClassification;
    }
  }

  // Also ensure ML components extracted as regular components get proper trust/classification
  for (const ml of extraction.mlComponents) {
    const asComponent = extraction.components.find(
      (c) => c.id === ml.id || c.name === ml.name,
    );
    if (asComponent) {
      if (!asComponent.trustLevel || asComponent.trustLevel === "MEDIUM") {
        asComponent.trustLevel = "CRITICAL";
      }
      if (
        !asComponent.dataClassification ||
        asComponent.dataClassification.length === 0
      ) {
        asComponent.dataClassification = ["internal"];
      }
      if (ml.trainingDataDescription) {
        asComponent.description =
          (asComponent.description || "") +
          ` Training data: ${ml.trainingDataDescription}`;
      }
    }
  }

  // Final sweep: any artifact without a verificationStatus at this point
  // either had no sourceText to begin with or was created by the validation
  // loop without one. Mark them INFERRED so the coverage metric distinguishes
  // them from genuinely UNVERIFIED items (which had a quote that didn't match).
  for (const c of extraction.components) {
    if (!c.verificationStatus) c.verificationStatus = "INFERRED";
  }
  for (const f of extraction.dataFlows) {
    if (!f.verificationStatus) f.verificationStatus = "INFERRED";
  }
  for (const b of extraction.boundaries) {
    if (!b.verificationStatus) b.verificationStatus = "INFERRED";
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function calculateCoverage(extraction: ExtractionResult): CoverageMetrics {
  const components = extraction.components;
  const flows = extraction.dataFlows;
  const boundaries = extraction.boundaries;

  const componentCount = components.length;
  const flowCount = flows.length;
  const boundaryCount = boundaries.length;

  const componentsWithTrustLevels = components.filter(
    (c) => c.trustLevel && c.trustLevel !== "MEDIUM",
  ).length;
  const componentsWithDataClassification = components.filter(
    (c) => c.dataClassification && c.dataClassification.length > 0,
  ).length;
  const flowsWithProtocol = flows.filter(
    (f) => f.protocol && f.protocol !== "unknown",
  ).length;
  const flowsWithEncryptionStatus = flows.filter(
    (f) => f.encrypted !== undefined,
  ).length;
  const boundariesWithComponents = boundaries.filter(
    (b) => b.componentIds.length > 0,
  ).length;
  const dependenciesExtracted = extraction.dependencies.length;
  const mlComponentsExtracted = extraction.mlComponents.length;

  // Weighted scoring
  let score = 0;
  const maxScore = 100;

  // Components exist (20 pts)
  score += Math.min(20, componentCount * 2);

  // Flows exist and reference valid components (20 pts)
  score += Math.min(20, flowCount * 1.5);

  // Trust levels assigned (15 pts)
  if (componentCount > 0) {
    score += Math.round((componentsWithTrustLevels / componentCount) * 15);
  }

  // Data classification assigned (15 pts)
  if (componentCount > 0) {
    score += Math.round(
      (componentsWithDataClassification / componentCount) * 15,
    );
  }

  // Flow details (10 pts)
  if (flowCount > 0) {
    const protocolPct = flowsWithProtocol / flowCount;
    const encryptPct = flowsWithEncryptionStatus / flowCount;
    score += Math.round(((protocolPct + encryptPct) / 2) * 10);
  }

  // Boundaries with components (10 pts)
  if (boundaryCount > 0) {
    score += Math.round((boundariesWithComponents / boundaryCount) * 10);
  } else {
    // No boundaries at all = penalty
    score += 0;
  }

  // Dependencies extracted (5 pts bonus)
  score += Math.min(5, dependenciesExtracted);

  // ML components (5 pts bonus — only if doc mentions ML)
  score += Math.min(5, mlComponentsExtracted * 5);

  // Quote-coverage rollup — REPORTED ONLY, not folded into overallScore.
  // INFERRED items (defaults / no quote attempted) are excluded from both
  // numerator and denominator so a well-formed extraction with many
  // defaulted fields doesn't crater the metric.
  const allArtifacts = [...components, ...flows, ...boundaries] as Array<{
    verificationStatus?: ExtractionVerificationStatus;
  }>;
  let quotesVerified = 0;
  let quotesUnverified = 0;
  let quotesInferred = 0;
  for (const a of allArtifacts) {
    if (a.verificationStatus === "VERIFIED") quotesVerified++;
    else if (a.verificationStatus === "UNVERIFIED") quotesUnverified++;
    else if (a.verificationStatus === "INFERRED") quotesInferred++;
  }
  const quotesDenom = quotesVerified + quotesUnverified;
  const quotesCoverage =
    quotesDenom === 0 ? undefined : quotesVerified / quotesDenom;

  return {
    componentCount,
    flowCount,
    boundaryCount,
    componentsWithTrustLevels,
    componentsWithDataClassification,
    flowsWithProtocol,
    flowsWithEncryptionStatus,
    boundariesWithComponents,
    dependenciesExtracted,
    mlComponentsExtracted,
    overallScore: Math.min(maxScore, score),
    quotesCoverage,
    quotesVerified,
    quotesUnverified,
    quotesInferred,
  };
}

function mergeExtractions(
  base: ExtractionResult,
  additions: ExtractionResult,
): ExtractionResult {
  const existingIds = new Set(base.components.map((c) => c.id));
  const existingFlowKeys = new Set(
    base.dataFlows.map((f) => `${f.sourceId}→${f.targetId}`),
  );
  const existingBoundaryIds = new Set(base.boundaries.map((b) => b.id));
  const existingDepNames = new Set(base.dependencies.map((d) => d.name));

  return {
    ...base,
    components: [
      ...base.components,
      ...additions.components.filter((c) => !existingIds.has(c.id)),
    ],
    dataFlows: [
      ...base.dataFlows,
      ...additions.dataFlows.filter(
        (f) => !existingFlowKeys.has(`${f.sourceId}→${f.targetId}`),
      ),
    ],
    boundaries: [
      ...base.boundaries,
      ...additions.boundaries.filter((b) => !existingBoundaryIds.has(b.id)),
    ],
    dependencies: [
      ...base.dependencies,
      ...additions.dependencies.filter((d) => !existingDepNames.has(d.name)),
    ],
    mlComponents: [
      ...base.mlComponents,
      ...additions.mlComponents.filter(
        (m) => !base.mlComponents.some((bm) => bm.id === m.id),
      ),
    ],
    technologies: [
      ...new Set([...base.technologies, ...additions.technologies]),
    ],
    dataTypes: [...new Set([...base.dataTypes, ...additions.dataTypes])],
    warnings: [...base.warnings, ...additions.warnings],
  };
}

async function runPass(
  client: AIProviderClient,
  systemPrompt: string,
  userContent: string,
): Promise<string> {
  const start = Date.now();
  try {
    const response = await client.complete({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
      temperature: 0.2,
      maxTokens: 45000,
    });
    logger.debug(
      {
        duration: Date.now() - start,
        tokens: response.usage?.totalTokens,
      },
      "Extraction pass complete",
    );
    return response.content;
  } catch (err) {
    logger.error({ err }, "Extraction pass failed");
    return `Error: ${err instanceof Error ? err.message : "unknown"}`;
  }
}

function parseExtractionResult(raw: string): ExtractionResult {
  const empty: ExtractionResult = {
    components: [],
    dataFlows: [],
    boundaries: [],
    dependencies: [],
    mlComponents: [],
    technologies: [],
    dataTypes: [],
    confidence: 0,
    warnings: [],
    passesCompleted: 0,
    coverageMetrics: {
      componentCount: 0,
      flowCount: 0,
      boundaryCount: 0,
      componentsWithTrustLevels: 0,
      componentsWithDataClassification: 0,
      flowsWithProtocol: 0,
      flowsWithEncryptionStatus: 0,
      boundariesWithComponents: 0,
      dependenciesExtracted: 0,
      mlComponentsExtracted: 0,
      overallScore: 0,
    },
  };

  try {
    let content = raw.trim();
    // Strip thinking blocks
    content = content.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
    // Strip markdown fences (greedy — grab everything between first ``` and last ```)
    const fenceMatch = content.match(/```(?:json)?\s*\n?([\s\S]*)\n?```/);
    if (fenceMatch) content = fenceMatch[1].trim();
    // Find JSON object
    const objStart = content.indexOf("{");
    const objEnd = content.lastIndexOf("}");
    if (objStart !== -1 && objEnd > objStart) {
      content = content.slice(objStart, objEnd + 1);
    }
    // Fix trailing commas
    content = content.replace(/,\s*([}\]])/g, "$1");

    const parsed = JSON.parse(content);
    const components = (parsed.components || []).map(
      (c: { type?: unknown; [k: string]: unknown }) => ({
        ...c,
        type: coerceComponentTypeOrCustom(c.type),
      }),
    );
    return {
      components,
      dataFlows: parsed.dataFlows || [],
      boundaries: parsed.boundaries || [],
      dependencies: parsed.dependencies || [],
      mlComponents: parsed.mlComponents || [],
      technologies: parsed.technologies || [],
      dataTypes: parsed.dataTypes || [],
      securityRequirements: parsed.securityRequirements,
      confidence: parsed.confidence || 0,
      warnings: parsed.warnings || [],
      passesCompleted: 0,
      coverageMetrics: empty.coverageMetrics,
    };
  } catch (e) {
    logger.warn(
      { rawLength: raw.length, preview: raw.slice(0, 200) },
      "Failed to parse extraction result",
    );
    return {
      ...empty,
      warnings: [`Parse error: ${e instanceof Error ? e.message : "unknown"}`],
    };
  }
}

interface ValidationDefense {
  name: string;
  action: "DEFEND" | "QUALIFY" | "RETRACT";
  citation?: string;
  qualification?: string;
  rationale?: string;
}

export interface ValidationGaps {
  missingComponents: Array<{
    name: string;
    type: string;
    sourceText?: string;
    trustLevel?: string;
  }>;
  missingFlows: Array<{
    sourceId: string;
    targetId: string;
    description?: string;
    protocol?: string;
    encrypted?: boolean;
    sourceText?: string;
  }>;
  missingBoundaries: Array<{
    name: string;
    trustLevel?: string;
    componentIds: string[];
    sourceText?: string;
  }>;
  trustLevelCorrections: Array<{
    componentId: string;
    currentLevel: string;
    correctLevel: string;
    reason: string;
  }>;
  missingClassifications: Array<{
    componentId: string;
    missingClassifications: string[];
    reason: string;
  }>;
  missingDependencies: Array<{
    name: string;
    type: string;
    language?: string;
    sourceText?: string;
  }>;
  missingMLComponents: Array<{
    name: string;
    framework?: string;
    sourceText?: string;
  }>;
  defenses: ValidationDefense[];
  completenessScore: number;
  gaps: string[];
}

export function parseValidationGaps(raw: string): ValidationGaps {
  const empty: ValidationGaps = {
    missingComponents: [],
    missingFlows: [],
    missingBoundaries: [],
    trustLevelCorrections: [],
    missingClassifications: [],
    missingDependencies: [],
    missingMLComponents: [],
    defenses: [],
    completenessScore: 50,
    gaps: [],
  };

  try {
    let content = raw.trim();
    content = content.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
    const fenceMatch = content.match(/```(?:json)?\s*\n?([\s\S]*)\n?```/);
    if (fenceMatch) content = fenceMatch[1].trim();
    const objStart = content.indexOf("{");
    const objEnd = content.lastIndexOf("}");
    if (objStart !== -1 && objEnd > objStart) {
      content = content.slice(objStart, objEnd + 1);
    }
    content = content.replace(/,\s*([}\]])/g, "$1");

    const parsed = JSON.parse(content);
    return {
      missingComponents: parsed.missingComponents || [],
      missingFlows: parsed.missingFlows || [],
      missingBoundaries: parsed.missingBoundaries || [],
      trustLevelCorrections: parsed.trustLevelCorrections || [],
      missingClassifications: parsed.missingClassifications || [],
      missingDependencies: parsed.missingDependencies || [],
      missingMLComponents: parsed.missingMLComponents || [],
      defenses: normalizeValidationDefenses(parsed.defenses),
      completenessScore: parsed.completenessScore || 50,
      gaps: Array.isArray(parsed.gaps)
        ? (parsed.gaps as unknown[]).filter(
            (g): g is string => typeof g === "string",
          )
        : [],
    };
  } catch {
    return empty;
  }
}

function normalizeValidationDefenses(raw: unknown): ValidationDefense[] {
  if (!Array.isArray(raw)) return [];
  const out: ValidationDefense[] = [];
  for (const d of raw) {
    if (!d || typeof d !== "object") continue;
    const obj = d as Record<string, unknown>;
    const name = typeof obj.name === "string" ? obj.name : "";
    const action =
      typeof obj.action === "string" ? obj.action.toUpperCase() : "";
    if (!name) continue;
    if (action !== "DEFEND" && action !== "QUALIFY" && action !== "RETRACT")
      continue;
    out.push({
      name,
      action: action as ValidationDefense["action"],
      citation: typeof obj.citation === "string" ? obj.citation : undefined,
      qualification:
        typeof obj.qualification === "string" ? obj.qualification : undefined,
      rationale: typeof obj.rationale === "string" ? obj.rationale : undefined,
    });
  }
  return out;
}

/**
 * Drop "missing X" entries whose sourceText isn't present (whitespace-tolerant)
 * in the document. Catches phantom-missings the LLM hallucinated. Logs the
 * count of phantoms removed for QA visibility.
 *
 * Whether sourceText is REQUIRED to keep an entry is configurable via
 * `requireSourceText` — for backward compat we default to false (entries
 * with NO sourceText are kept). The extraction call site sets it to true
 * so the prompt's source-quote contract is enforced.
 */
export function purgePhantomMissings(
  gaps: ValidationGaps,
  documentText: string,
  options: { requireSourceText?: boolean } = {},
): { removed: number; reasons: string[] } {
  const { requireSourceText = false } = options;
  const normalizedDoc = normalizeForQuoteCheck(documentText);
  const reasons: string[] = [];

  const isGrounded = (
    sourceText: string | undefined,
    label: string,
  ): boolean => {
    if (!sourceText) {
      if (requireSourceText) {
        reasons.push(`dropped (no sourceText): ${label}`);
        return false;
      }
      return true;
    }
    const normalized = normalizeForQuoteCheck(sourceText);
    if (normalized.length < 12) {
      reasons.push(`dropped (sourceText too short): ${label}`);
      return false;
    }
    if (normalizedDoc.includes(normalized)) return true;
    reasons.push(`dropped (sourceText not in doc): ${label}`);
    return false;
  };

  const before =
    gaps.missingComponents.length +
    gaps.missingFlows.length +
    gaps.missingBoundaries.length +
    gaps.missingDependencies.length +
    gaps.missingMLComponents.length;

  gaps.missingComponents = gaps.missingComponents.filter((m) =>
    isGrounded(m.sourceText, `component "${m.name}"`),
  );
  gaps.missingFlows = gaps.missingFlows.filter((m) =>
    isGrounded(m.sourceText, `flow ${m.sourceId}→${m.targetId}`),
  );
  gaps.missingBoundaries = gaps.missingBoundaries.filter((m) =>
    isGrounded(m.sourceText, `boundary "${m.name}"`),
  );
  gaps.missingDependencies = gaps.missingDependencies.filter((m) =>
    isGrounded(m.sourceText, `dependency "${m.name}"`),
  );
  gaps.missingMLComponents = gaps.missingMLComponents.filter((m) =>
    isGrounded(m.sourceText, `ML component "${m.name}"`),
  );

  const after =
    gaps.missingComponents.length +
    gaps.missingFlows.length +
    gaps.missingBoundaries.length +
    gaps.missingDependencies.length +
    gaps.missingMLComponents.length;

  return { removed: before - after, reasons };
}

/**
 * Apply the Pass-2 Challenge-Defend outcomes to the missing lists:
 *   - RETRACT (or DEFEND without a verbatim doc-quoted citation) → drop the missingComponent
 *   - QUALIFY → leave the entry alone (qualification is captured in the
 *     defense list for Pass 3 to read; we don't yet auto-mutate the
 *     missingComponent name/type because that risks data drift)
 *   - DEFEND with a citation that substring-matches the doc → keep
 *
 * Match against missingComponents only (the Challenge-Defend round is
 * scoped to the most consequential gaps). Returns the number dropped for
 * logging.
 */
export function applyValidationDefenses(
  gaps: ValidationGaps,
  documentText: string,
): { dropped: number; retractedNames: string[] } {
  if (gaps.defenses.length === 0) return { dropped: 0, retractedNames: [] };

  const normalizedDoc = normalizeForQuoteCheck(documentText);
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
  const defenseByName = new Map<string, ValidationDefense>();
  for (const d of gaps.defenses) defenseByName.set(norm(d.name), d);

  const before = gaps.missingComponents.length;
  const retractedNames: string[] = [];

  gaps.missingComponents = gaps.missingComponents.filter((m) => {
    const d = defenseByName.get(norm(m.name));
    if (!d) return true;
    if (d.action === "RETRACT") {
      retractedNames.push(m.name);
      return false;
    }
    if (d.action === "DEFEND") {
      const citation = d.citation ? normalizeForQuoteCheck(d.citation) : "";
      if (citation.length < 12 || !normalizedDoc.includes(citation)) {
        // Unverifiable DEFEND → silent RETRACT
        retractedNames.push(m.name);
        return false;
      }
    }
    return true;
  });

  return { dropped: before - gaps.missingComponents.length, retractedNames };
}

/**
 * Multi-Step Extraction Prompt Builders
 *
 * One focused prompt per extraction step. Each step receives only the context
 * it needs — output from prior steps feeds into the next, keeping prompts small
 * and focused for local models.
 */

import type {
  ExtractedComponent,
  ExtractedBoundary,
  ExtractedDataFlow,
} from "./types.js";

/**
 * Type vocabulary offered to the LLM. Generic types are preferred — vendor-
 * specific types (AWS_S3, GCP_CLOUDSQL, AZURE_COSMOS, etc.) are ONLY chosen
 * when the document explicitly names the vendor product. Unknown strings are
 * coerced server-side by `coerceComponentType`, so this list is advisory.
 */
const COMPONENT_TYPES = [
  // Generics (default choice)
  "WEB_APP",
  "API",
  "API_GATEWAY",
  "DATABASE",
  "CACHE",
  "QUEUE",
  "OBJECT_STORAGE",
  "FILE_SYSTEM",
  "AUTH_SERVICE",
  "EXTERNAL_ENTITY",
  "ACTOR",
  "MICROSERVICE",
  "LOAD_BALANCER",
  "CDN",
  "FIREWALL",
  "WAF",
  "IAM",
  "SECRETS_MANAGER",
  "CONTAINER",
  "KUBERNETES",
  "VM",
  "SERVERLESS",
  // AWS (only when document names the AWS product)
  "AWS_EC2",
  "AWS_LAMBDA",
  "AWS_ECS",
  "AWS_EKS",
  "AWS_S3",
  "AWS_RDS",
  "AWS_DYNAMODB",
  "AWS_AURORA",
  "AWS_ELASTICACHE",
  "AWS_REDSHIFT",
  "AWS_CLOUDFRONT",
  "AWS_API_GATEWAY",
  "AWS_COGNITO",
  "AWS_KMS",
  "AWS_SECRETS_MANAGER",
  "AWS_WAF",
  "AWS_SQS",
  "AWS_SNS",
  "AWS_KINESIS",
  "AWS_SAGEMAKER",
  "AWS_BEDROCK",
  // GCP
  "GCP_COMPUTE",
  "GCP_FUNCTIONS",
  "GCP_GKE",
  "GCP_CLOUD_RUN",
  "GCP_STORAGE",
  "GCP_CLOUDSQL",
  "GCP_FIRESTORE",
  "GCP_BIGTABLE",
  "GCP_BIGQUERY",
  "GCP_PUBSUB",
  "GCP_CLOUD_CDN",
  "GCP_IAM",
  "GCP_KMS",
  "GCP_SECRET_MANAGER",
  "GCP_IDENTITY_PLATFORM",
  "GCP_VERTEX_AI",
  // Azure
  "AZURE_VM",
  "AZURE_FUNCTIONS",
  "AZURE_AKS",
  "AZURE_APP_SERVICE",
  "AZURE_BLOB",
  "AZURE_SQL",
  "AZURE_COSMOS",
  "AZURE_POSTGRESQL",
  "AZURE_AD",
  "AZURE_KEY_VAULT",
  "AZURE_WAF",
  "AZURE_SERVICE_BUS",
  "AZURE_EVENT_HUB",
  "AZURE_FRONT_DOOR",
  "AZURE_ML",
  "AZURE_OPENAI",
].join("|");

/** Inline guidance injected into every extraction prompt. */
const TYPE_SELECTION_RULE = `Type selection rules:
- Default to GENERIC types (WEB_APP, DATABASE, OBJECT_STORAGE, QUEUE, ...).
- Use a VENDOR-SPECIFIC type ONLY when the document literally names the cloud product (e.g. "S3", "RDS", "Cosmos DB", "BigQuery", "Cloud Run"). Do not guess a vendor from context.
- When unsure between generic and vendor, pick generic.`;

const SYSTEM_ARCHITECT =
  "You are an expert software architect analyzing technical documents. Be precise and exhaustive. Return only valid JSON.";

// Compact serializers — strip fields that aren't needed downstream
function compactComponents(components: ExtractedComponent[]): string {
  return JSON.stringify(
    components.map((c) => ({ id: c.id, name: c.name, type: c.type })),
  );
}

function compactBoundaries(boundaries: ExtractedBoundary[]): string {
  return JSON.stringify(
    boundaries.map((b) => ({
      id: b.id,
      name: b.name,
      trustLevel: b.trustLevel,
      componentIds: b.componentIds,
    })),
  );
}

function compactFlows(flows: ExtractedDataFlow[]): string {
  return JSON.stringify(
    flows.map((f) => ({
      id: f.id,
      sourceId: f.sourceId,
      targetId: f.targetId,
      label: f.label,
    })),
  );
}

// ---------------------------------------------------------------------------
// Step 1 — Component Discovery
// ---------------------------------------------------------------------------

export function buildStep1Prompt(docText: string): {
  system: string;
  user: string;
} {
  return {
    system: SYSTEM_ARCHITECT,
    user: `## Step 1: Find All Components + Security Requirements

Analyze this document and:
1. List EVERY system component mentioned or implied (services, databases, queues, caches, clients, actors, gateways, external APIs, storage)
2. Extract ONLY security-relevant requirements (auth, encryption, access control, audit, data protection, compliance)

${TYPE_SELECTION_RULE}

## Document
${docText}

Return JSON then on a new line write GAPS:

{ "components": [{ "id": "kebab-case-id", "name": "Human Name", "type": "${COMPONENT_TYPES}", "description": "what it does", "technology": "specific tech", "dataHandled": ["pii","credentials","internal"], "confidence": 0.9 }], "requirements": [{ "id": "req-1", "reqId": "SEC-1", "text": "The system shall use TLS 1.3 for all external connections", "docId": "SAD", "category": "security" }], "confidence": 0.85 }

GAPS: ["what was ambiguous", "what you couldn't determine"]`,
  };
}

export function buildStep1ChallengePrompt(
  docText: string,
  found: ExtractedComponent[],
  gaps: string[],
): { system: string; user: string } {
  const list = found.map((c) => `- ${c.id} (${c.type}): ${c.name}`).join("\n");
  const gapsText =
    gaps.length > 0
      ? `\nGaps you flagged:\n${gaps.map((g) => `- ${g}`).join("\n")}`
      : "";
  return {
    system: SYSTEM_ARCHITECT,
    user: `## Challenge: Did You Miss Any Components?

You found ${found.length} components:
${list}
${gapsText}

Looking at the document again — are there additional components missed?
Consider: message queues, caches, auth providers, CDNs, load balancers, background workers, external APIs, admin actors.

${TYPE_SELECTION_RULE}

Document (excerpt):
${docText.slice(0, 3000)}

Return ONLY additional components not in the list above (empty array if none):
{ "additionalComponents": [{ "id": "", "name": "", "type": "${COMPONENT_TYPES}", "description": "", "technology": "", "dataHandled": [], "confidence": 0.8 }] }`,
  };
}

// ---------------------------------------------------------------------------
// Step 2 — Trust Zone Assignment
// ---------------------------------------------------------------------------

export function buildStep2Prompt(
  docText: string,
  components: ExtractedComponent[],
): { system: string; user: string } {
  return {
    system: SYSTEM_ARCHITECT,
    user: `## Step 2: Assign Trust Zones

Place every component into exactly one security boundary.

Trust levels:
- PUBLIC: Internet-facing (web apps, CDN, load balancers, mobile/browser clients, API gateways)
- INTERNAL: Backend services (APIs, microservices, message queues, background workers)
- CONFIDENTIAL: Auth services, secret managers, key stores, audit services
- RESTRICTED: Data stores handling PII/PHI/PCI (patient records, payment data)

Components to classify:
${compactComponents(components)}

Document context:
${docText.slice(0, 2000)}

Every component must appear in exactly one boundary. Group same-trust components together.

Return JSON then GAPS:

{ "boundaries": [{ "id": "boundary-id", "name": "Zone Name", "type": "trust", "trustLevel": "PUBLIC|INTERNAL|CONFIDENTIAL|RESTRICTED", "componentIds": ["id1","id2"], "description": "why these share a trust level", "confidence": 0.9 }], "confidence": 0.85 }

GAPS: ["components that were hard to classify", "ambiguous network topology"]`,
  };
}

export function buildStep2ChallengePrompt(
  components: ExtractedComponent[],
  boundaries: ExtractedBoundary[],
  gaps: string[],
): { system: string; user: string } {
  const unassigned = components.filter(
    (c) => !boundaries.some((b) => b.componentIds.includes(c.id)),
  );
  const challengeText =
    unassigned.length > 0
      ? `\nUnassigned components: ${unassigned.map((c) => c.id).join(", ")}`
      : "";
  const gapsText =
    gaps.length > 0
      ? `\nGaps flagged: ${gaps
          .slice(0, 5)
          .map((g) => `- ${g}`)
          .join("\n")}`
      : "";
  return {
    system: SYSTEM_ARCHITECT,
    user: `## Challenge: Review Trust Zone Assignments

Current boundaries:
${compactBoundaries(boundaries)}
${challengeText}${gapsText}

Are these trust zone assignments correct? Challenge each one:
- Is anything PUBLIC that should be INTERNAL?
- Is any database INTERNAL that stores PII/PHI (should be RESTRICTED)?
- Are all components assigned?

Return corrected boundaries (replace entire list, not just changes):
{ "boundaries": [{ "id": "", "name": "", "type": "trust", "trustLevel": "PUBLIC|INTERNAL|CONFIDENTIAL|RESTRICTED", "componentIds": [], "description": "", "confidence": 0.9 }] }`,
  };
}

// ---------------------------------------------------------------------------
// Step 3 — Data Flow Mapping
// ---------------------------------------------------------------------------

export function buildStep3Prompt(
  docText: string,
  components: ExtractedComponent[],
  boundaries: ExtractedBoundary[],
): { system: string; user: string } {
  return {
    system: SYSTEM_ARCHITECT,
    user: `## Step 3: Map All Data Flows

For EVERY pair of components that communicate, create a data flow.
Pay special attention to flows that cross trust boundaries.

Components:
${compactComponents(components)}

Trust boundaries:
${compactBoundaries(boundaries)}

Document:
${docText}

Each flow needs: unique id, sourceId, targetId (must be valid component IDs), label, protocol, dataTypes, encrypted, confidence.

Return JSON then GAPS:

{ "dataFlows": [{ "id": "flow-src-to-tgt", "sourceId": "component-id", "targetId": "component-id", "label": "what flows", "protocol": "HTTPS|gRPC|SQL|AMQP|WebSocket|TCP", "dataTypes": ["pii","credentials","internal"], "encrypted": true, "confidence": 0.9 }], "confidence": 0.85 }

GAPS: ["component pairs where communication is unclear", "protocols you couldn't determine"]`,
  };
}

export function buildStep3ChallengePrompt(
  components: ExtractedComponent[],
  flows: ExtractedDataFlow[],
  gaps: string[],
): { system: string; user: string } {
  const coveredPairs = new Set(flows.map((f) => `${f.sourceId}→${f.targetId}`));
  const uncovered: string[] = [];
  for (const a of components) {
    for (const b of components) {
      if (a.id !== b.id && !coveredPairs.has(`${a.id}→${b.id}`)) {
        uncovered.push(`${a.id} → ${b.id}`);
      }
    }
  }
  const sample = uncovered.slice(0, 12).join("\n");
  const gapsText =
    gaps.length > 0
      ? `\nGaps flagged:\n${gaps
          .slice(0, 5)
          .map((g) => `- ${g}`)
          .join("\n")}`
      : "";
  return {
    system: SYSTEM_ARCHITECT,
    user: `## Challenge: Missing Data Flows?

You found ${flows.length} flows. These component pairs have no flow yet:
${sample}
${gapsText}

For each pair above that DOES communicate based on the document, add a flow.
Skip pairs that genuinely don't communicate.

Return ONLY additional flows not already found (empty if none):
{ "additionalFlows": [{ "id": "", "sourceId": "", "targetId": "", "label": "", "protocol": "HTTPS", "dataTypes": [], "encrypted": true, "confidence": 0.8 }] }`,
  };
}

// ---------------------------------------------------------------------------
// Step 4 — Sequence Identification
// ---------------------------------------------------------------------------

export function buildStep4Prompt(
  docText: string,
  components: ExtractedComponent[],
  flows: ExtractedDataFlow[],
): { system: string; user: string } {
  return {
    system: SYSTEM_ARCHITECT,
    user: `## Step 4: Identify Interaction Sequences

Find 2-5 named end-to-end interaction sequences (use cases, workflows, data pipelines).
Each sequence shows how components collaborate to achieve a specific goal.

Components:
${compactComponents(components)}

Available flows:
${compactFlows(flows)}

Document context:
${docText.slice(0, 2500)}

Each sequence needs: id, name, description, and 3-8 ordered steps.
All "from"/"to" values MUST be valid component IDs from the list above.

Return JSON:
{ "sequences": [{ "id": "seq-id", "name": "Sequence Name", "description": "what it achieves", "steps": [{ "from": "comp-id", "to": "comp-id", "message": "HTTP POST /ingest with payload", "notes": "optional detail" }] }] }`,
  };
}

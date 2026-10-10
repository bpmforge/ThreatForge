/**
 * Prompt Builder Functions
 *
 * Helper functions for building prompts with context.
 */

import type { ThreatModelContext } from "../../../types/ai.js";
import { DocumentType, detectDocumentType } from "./document-detection.js";
import {
  THREAT_ANALYSIS_USER_PROMPT,
  MITIGATION_USER_PROMPT,
  COMPONENT_THREAT_USER_PROMPT,
  SEVERITY_CALCULATION_USER_PROMPT,
} from "./threat-prompts.js";
import {
  ARCHITECTURE_EXTRACTION_SYSTEM_PROMPT,
  ARCHITECTURE_EXTRACTION_USER_PROMPT,
  SRS_EXTRACTION_SYSTEM_PROMPT,
  SRS_EXTRACTION_USER_PROMPT,
  ADR_EXTRACTION_SYSTEM_PROMPT,
  ADR_EXTRACTION_USER_PROMPT,
  OPENAPI_EXTRACTION_SYSTEM_PROMPT,
  OPENAPI_EXTRACTION_USER_PROMPT,
  IAC_EXTRACTION_SYSTEM_PROMPT,
  IAC_EXTRACTION_USER_PROMPT,
} from "./extraction-prompts.js";
import { CHAT_SYSTEM_PROMPT, CHAT_CONTEXT_TEMPLATE } from "./chat-prompts.js";

/**
 * Build methodology-aware system prompt prefix
 */
function buildMethodologyContext(methodology?: string): string {
  switch (methodology) {
    case "LINDDUN":
      return `
Threat methodology: LINDDUN (privacy threat modeling). Use LINDDUN categories for classification:
- LINKABILITY: Ability to link two or more items of interest to an individual
- IDENTIFIABILITY: Ability to identify a subject from a set of subjects
- NON_REPUDIATION: Inability to deny having performed an action
- DETECTABILITY: Ability to detect whether an item of interest exists
- DISCLOSURE_OF_INFORMATION: Exposure of personal data to unauthorized parties
- UNAWARENESS: Lack of awareness about data processing
- NON_COMPLIANCE: Not complying with privacy legislation and regulations`;

    case "CIA":
      return `
Threat methodology: CIA Triad. Use CIA categories for classification:
- CONFIDENTIALITY: Unauthorized access to sensitive information
- INTEGRITY: Unauthorized modification of data or systems
- AVAILABILITY: Disruption of service or data access`;

    case "STRIDE_LINDDUN":
      return `
Threat methodology: STRIDE + LINDDUN (combined security and privacy threat modeling). Use both STRIDE and LINDDUN categories as appropriate:
STRIDE: SPOOFING, TAMPERING, REPUDIATION, INFORMATION_DISCLOSURE, DENIAL_OF_SERVICE, ELEVATION_OF_PRIVILEGE
LINDDUN: LINKABILITY, IDENTIFIABILITY, NON_REPUDIATION, DETECTABILITY, DISCLOSURE_OF_INFORMATION, UNAWARENESS, NON_COMPLIANCE`;

    case "PASTA":
      return `
Threat methodology: PASTA (Process for Attack Simulation and Threat Analysis). Use PASTA categories for classification:
- BUSINESS_LOGIC: Attacks on business rules, workflow bypass, fraud
- DATA_EXPOSURE: Unauthorized access to sensitive data
- ACCESS_CONTROL: Authentication/authorization failures
- INJECTION: Code/command/query injection attacks
- SUPPLY_CHAIN: Third-party dependency and integration risks
- INFRASTRUCTURE: Cloud, network, container, orchestration attacks
- INSIDER_THREAT: Malicious or negligent internal actors
- AVAILABILITY: Service disruption, resource exhaustion`;

    case "KILL_CHAIN":
      return `
Threat methodology: Cyber Kill Chain. Use kill chain stages for classification:
- RECONNAISSANCE: Information gathering about the target
- WEAPONIZATION: Creating exploit/payload for discovered weaknesses
- DELIVERY: Transmitting weapon to target environment
- EXPLOITATION: Triggering vulnerability in target component
- INSTALLATION: Establishing persistence in compromised system
- COMMAND_AND_CONTROL: Establishing covert communication channel
- ACTIONS_ON_OBJECTIVES: Achieving attacker's goal (data theft, sabotage)`;

    case "MITRE_ATTACK":
      return `
Threat methodology: MITRE ATT&CK. Use ATT&CK tactics for classification:
- INITIAL_ACCESS: How attackers get into the system
- EXECUTION: How attackers run malicious code
- PERSISTENCE: How attackers maintain access
- PRIVILEGE_ESCALATION: How attackers gain higher access
- DEFENSE_EVASION: How attackers avoid detection
- CREDENTIAL_ACCESS: How attackers steal credentials
- DISCOVERY: How attackers learn the environment
- LATERAL_MOVEMENT: How attackers spread through the network
- COLLECTION: How attackers gather target data
- EXFILTRATION: How attackers steal data out
- IMPACT: How attackers cause damage`;

    case "AGENTIC":
      return `
Threat methodology: Multi-Framework Agentic Analysis (STRIDE + PASTA + Kill Chain + MITRE ATT&CK).
Use the most appropriate category from ANY framework. The agentic pipeline will run multiple frameworks and consolidate.
Valid categories include all STRIDE, PASTA, Kill Chain, and MITRE ATT&CK categories.`;

    default:
      return `
Threat methodology: STRIDE. Use STRIDE categories for classification:
- SPOOFING: Pretending to be someone/something else
- TAMPERING: Unauthorized modification of data or code
- REPUDIATION: Denying actions without proof
- INFORMATION_DISCLOSURE: Unauthorized access to sensitive data
- DENIAL_OF_SERVICE: Making systems unavailable
- ELEVATION_OF_PRIVILEGE: Gaining unauthorized access`;
  }
}

/**
 * Get the valid category values for the prompt based on methodology
 */
function getMethodologyCategoryValues(methodology?: string): string {
  switch (methodology) {
    case "LINDDUN":
      return "LINKABILITY|IDENTIFIABILITY|NON_REPUDIATION|DETECTABILITY|DISCLOSURE_OF_INFORMATION|UNAWARENESS|NON_COMPLIANCE";
    case "CIA":
      return "CONFIDENTIALITY|INTEGRITY|AVAILABILITY";
    case "STRIDE_LINDDUN":
      return "SPOOFING|TAMPERING|REPUDIATION|INFORMATION_DISCLOSURE|DENIAL_OF_SERVICE|ELEVATION_OF_PRIVILEGE|LINKABILITY|IDENTIFIABILITY|NON_REPUDIATION|DETECTABILITY|DISCLOSURE_OF_INFORMATION|UNAWARENESS|NON_COMPLIANCE";
    case "PASTA":
      return "BUSINESS_LOGIC|DATA_EXPOSURE|ACCESS_CONTROL|INJECTION|SUPPLY_CHAIN|INFRASTRUCTURE|INSIDER_THREAT|AVAILABILITY";
    case "KILL_CHAIN":
      return "RECONNAISSANCE|WEAPONIZATION|DELIVERY|EXPLOITATION|INSTALLATION|COMMAND_AND_CONTROL|ACTIONS_ON_OBJECTIVES";
    case "MITRE_ATTACK":
      return "INITIAL_ACCESS|EXECUTION|PERSISTENCE|PRIVILEGE_ESCALATION|DEFENSE_EVASION|CREDENTIAL_ACCESS|DISCOVERY|LATERAL_MOVEMENT|COLLECTION|EXFILTRATION|IMPACT";
    case "AGENTIC":
      return "SPOOFING|TAMPERING|REPUDIATION|INFORMATION_DISCLOSURE|DENIAL_OF_SERVICE|ELEVATION_OF_PRIVILEGE|BUSINESS_LOGIC|DATA_EXPOSURE|ACCESS_CONTROL|INJECTION|SUPPLY_CHAIN|INFRASTRUCTURE|INSIDER_THREAT|AVAILABILITY|RECONNAISSANCE|WEAPONIZATION|DELIVERY|EXPLOITATION|INSTALLATION|COMMAND_AND_CONTROL|ACTIONS_ON_OBJECTIVES|INITIAL_ACCESS|EXECUTION|PERSISTENCE|PRIVILEGE_ESCALATION|DEFENSE_EVASION|CREDENTIAL_ACCESS|DISCOVERY|LATERAL_MOVEMENT|COLLECTION|EXFILTRATION|IMPACT";
    default:
      return "SPOOFING|TAMPERING|REPUDIATION|INFORMATION_DISCLOSURE|DENIAL_OF_SERVICE|ELEVATION_OF_PRIVILEGE";
  }
}

/**
 * Build threat analysis prompt with context
 */
export function buildThreatAnalysisPrompt(context: ThreatModelContext): string {
  const components =
    context.components.length > 0
      ? context.components
          .map(
            (c) =>
              `- **${c.name}** (Type: ${c.type}, Trust: ${c.trustZone || "unset"})${c.description ? `\n  ${c.description}` : ""}`,
          )
          .join("\n")
      : "No components defined.";

  const connections =
    context.connections.length > 0
      ? context.connections
          .map(
            (c) =>
              `- ${c.source} → ${c.target} [${c.protocol || "unknown protocol"}] ${c.encrypted ? "encrypted" : "UNENCRYPTED"}${c.label ? ` (${c.label})` : ""}`,
          )
          .join("\n")
      : "No data flows defined.";

  const boundaries =
    context.boundaries.length > 0
      ? context.boundaries
          .map((b) => `- ${b.name}${b.trustLevel ? ` (${b.trustLevel})` : ""}`)
          .join("\n")
      : "No trust boundaries defined yet.";

  const methodologyContext = buildMethodologyContext(context.methodology);
  const categoryValues = getMethodologyCategoryValues(context.methodology);

  const prompt = THREAT_ANALYSIS_USER_PROMPT.replace(
    "{{systemName}}",
    context.name || "Unnamed System",
  )
    .replace("{{components}}", components)
    .replace("{{connections}}", connections)
    .replace("{{boundaries}}", boundaries);

  // Append methodology context and override category values in the JSON schema hint
  return (
    prompt.replace(
      '"category": "SPOOFING|TAMPERING|REPUDIATION|INFORMATION_DISCLOSURE|DENIAL_OF_SERVICE|ELEVATION_OF_PRIVILEGE"',
      `"category": "${categoryValues}"`,
    ) + `\n\n## Methodology Context${methodologyContext}`
  );
}

/**
 * Build mitigation prompt with context
 */
export function buildMitigationPrompt(
  threat: { title: string; description: string; category: string },
  context?: ThreatModelContext,
): string {
  const contextText = context
    ? `System "${context.name}" with ${context.components.length} components, ${context.connections.length} data flows, and ${context.boundaries.length} trust boundaries.`
    : "No additional system context available.";

  // Format requirement list. Cap at 40 entries to bound prompt length;
  // the LLM only needs enough to match intent, not an exhaustive list.
  const reqs = context?.requirements ?? [];
  const requirementsBlock =
    reqs.length === 0
      ? "No imported requirements available. Do NOT emit [req:...] tags."
      : reqs
          .slice(0, 40)
          .map(
            (r) =>
              `- [req:${r.reqId}] (${r.category || "requirement"}${r.docId ? ` · ${r.docId}` : ""}) ${r.text.slice(0, 160)}`,
          )
          .join("\n");

  return MITIGATION_USER_PROMPT.replace("{{threatTitle}}", threat.title)
    .replace("{{threatDescription}}", threat.description)
    .replace("{{category}}", threat.category)
    .replace("{{context}}", contextText)
    .replace("{{requirements}}", requirementsBlock);
}

/**
 * Build component threat prompt
 */
export function buildComponentThreatPrompt(
  component: { type: string; name: string; description?: string },
  connections?: Array<{
    direction: "inbound" | "outbound";
    protocol?: string;
    encrypted?: boolean;
  }>,
): string {
  const description = component.description
    ? `**Description:** ${component.description}`
    : "";

  const connectionText = connections?.length
    ? `**Connections:**\n${connections.map((c) => `- ${c.direction} ${c.protocol ? `[${c.protocol}]` : ""} ${c.encrypted ? "(encrypted)" : "(unencrypted)"}`).join("\n")}`
    : "";

  return COMPONENT_THREAT_USER_PROMPT.replace(
    "{{componentType}}",
    component.type,
  )
    .replace("{{componentName}}", component.name)
    .replace("{{description}}", description)
    .replace("{{connections}}", connectionText);
}

/**
 * Build severity calculation prompt
 */
export function buildSeverityPrompt(
  threat: { title: string; description: string; category: string },
  context?: {
    componentType?: string;
    dataClassification?: string;
    exposureLevel?: "internal" | "external" | "public";
    existingControls?: string[];
  },
): string {
  const contextParts: string[] = [];
  if (context?.componentType)
    contextParts.push(`Component Type: ${context.componentType}`);
  if (context?.dataClassification)
    contextParts.push(`Data Classification: ${context.dataClassification}`);
  if (context?.exposureLevel)
    contextParts.push(`Exposure Level: ${context.exposureLevel}`);
  if (context?.existingControls?.length)
    contextParts.push(
      `Existing Controls: ${context.existingControls.join(", ")}`,
    );

  const contextText =
    contextParts.length > 0
      ? contextParts.join("\n")
      : "No additional context available.";

  return SEVERITY_CALCULATION_USER_PROMPT.replace(
    "{{threatTitle}}",
    threat.title,
  )
    .replace("{{threatDescription}}", threat.description)
    .replace("{{category}}", threat.category)
    .replace("{{context}}", contextText);
}

/**
 * Build chat system prompt with model context
 */
export function buildChatSystemPrompt(context?: ThreatModelContext): string {
  if (!context) {
    return CHAT_SYSTEM_PROMPT;
  }

  const componentSummary =
    context.components.length > 0
      ? context.components
          .slice(0, 5)
          .map((c) => `- ${c.name} (${c.type})`)
          .join("\n") +
        (context.components.length > 5
          ? `\n- ... and ${context.components.length - 5} more`
          : "")
      : "No components defined.";

  const contextBlock = CHAT_CONTEXT_TEMPLATE.replace(
    "{{modelName}}",
    context.name || "Unnamed",
  )
    .replace("{{componentCount}}", String(context.components.length))
    .replace("{{connectionCount}}", String(context.connections.length))
    .replace("{{boundaryCount}}", String(context.boundaries.length))
    .replace("{{componentSummary}}", componentSummary);

  return CHAT_SYSTEM_PROMPT + contextBlock;
}

/**
 * Build architecture extraction prompt with automatic document type detection
 */
export function buildExtractionPrompt(
  documentText: string,
  options?: {
    maxComponents?: number;
    documentType?: DocumentType | "auto";
    existingComponentsSummary?: string;
  },
): string {
  // Auto-detect document type if not specified
  const docType =
    options?.documentType === "auto" || !options?.documentType
      ? detectDocumentType(documentText)
      : options.documentType;

  // Select appropriate prompt based on document type
  let prompt: string;
  switch (docType) {
    case "srs":
      prompt = SRS_EXTRACTION_USER_PROMPT.replace(
        "{{documentText}}",
        documentText,
      );
      break;
    case "adr":
      prompt = ADR_EXTRACTION_USER_PROMPT.replace(
        "{{documentText}}",
        documentText,
      );
      break;
    case "openapi":
      prompt = OPENAPI_EXTRACTION_USER_PROMPT.replace(
        "{{documentText}}",
        documentText,
      );
      break;
    case "terraform":
    case "cloudformation":
      prompt = IAC_EXTRACTION_USER_PROMPT.replace(
        "{{documentText}}",
        documentText,
      );
      break;
    default:
      // Use generic architecture prompt for other types
      prompt = ARCHITECTURE_EXTRACTION_USER_PROMPT.replace(
        "{{documentText}}",
        documentText,
      );
  }

  if (options?.existingComponentsSummary) {
    prompt += `\n\n${options.existingComponentsSummary}`;
  }

  if (options?.maxComponents) {
    prompt += `\n\nNote: Limit extraction to the ${options.maxComponents} most important components.`;
  }

  return prompt;
}

/**
 * Get the appropriate system prompt for document extraction
 */
export function getExtractionSystemPrompt(
  documentText: string,
  options?: { documentType?: DocumentType | "auto" },
): string {
  const docType =
    options?.documentType === "auto" || !options?.documentType
      ? detectDocumentType(documentText)
      : options.documentType;

  switch (docType) {
    case "srs":
      return SRS_EXTRACTION_SYSTEM_PROMPT;
    case "adr":
      return ADR_EXTRACTION_SYSTEM_PROMPT;
    case "openapi":
      return OPENAPI_EXTRACTION_SYSTEM_PROMPT;
    case "terraform":
    case "cloudformation":
      return IAC_EXTRACTION_SYSTEM_PROMPT;
    default:
      return ARCHITECTURE_EXTRACTION_SYSTEM_PROMPT;
  }
}

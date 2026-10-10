/**
 * Micro-Prompt Builder
 *
 * Builds small, focused prompts for per-component, per-category analysis.
 * Each prompt is <1500 tokens with injected reference data.
 */
import type { ComponentContext } from "../../threat-generation/context-aware-pipeline.js";
import type { CategoryReferenceData, MicroThreat } from "./types.js";

// ---------------------------------------------------------------------------
// Category definitions — tells the LLM exactly what to look for
// ---------------------------------------------------------------------------

const CATEGORY_DEFINITIONS: Record<string, string> = {
  // STRIDE
  SPOOFING:
    "Can an attacker PRETEND TO BE this component or a legitimate user of it? Look for: weak/missing authentication, certificate validation gaps, session hijacking, credential theft, identity forgery, token replay.",
  TAMPERING:
    "Can an attacker MODIFY data flowing through or stored by this component? Look for: missing input validation, SQL/command injection, parameter manipulation, unsigned data, missing integrity checks, CSRF.",
  REPUDIATION:
    "Can an attacker DENY having performed an action on this component? Look for: missing/insufficient audit logging, log injection, unsigned transactions, no non-repudiation controls, missing timestamps.",
  INFORMATION_DISCLOSURE:
    "Can sensitive data LEAK from this component? Look for: unencrypted data at rest/in transit, verbose error messages, debug endpoints, log exposure, side-channel attacks, missing access controls on data.",
  DENIAL_OF_SERVICE:
    "Can this component be made UNAVAILABLE? Look for: missing rate limiting, algorithmic complexity attacks, resource exhaustion, unbounded queries, missing circuit breakers, single points of failure.",
  ELEVATION_OF_PRIVILEGE:
    "Can an attacker gain UNAUTHORIZED ACCESS through this component? Look for: IDOR, role escalation, SSRF, container escape, missing authorization checks, over-privileged service accounts.",
  // PASTA
  BUSINESS_LOGIC:
    "Can business rules be BYPASSED through this component? Look for: workflow manipulation, race conditions, price/quantity tampering, state machine violations.",
  DATA_EXPOSURE:
    "Can sensitive data be ACCESSED through this component without authorization? Look for: broken object-level authorization, excessive data exposure, mass assignment.",
  ACCESS_CONTROL:
    "Are authentication and authorization controls SUFFICIENT for this component? Look for: broken auth, missing function-level access control, JWT weaknesses.",
  INJECTION:
    "Can untrusted data be INTERPRETED AS CODE by this component? Look for: SQL injection, NoSQL injection, command injection, LDAP injection, template injection.",
  SUPPLY_CHAIN:
    "Is this component at risk from THIRD-PARTY DEPENDENCIES? Look for: vulnerable libraries, dependency confusion, compromised packages, missing integrity verification.",
  INFRASTRUCTURE:
    "Is the infrastructure hosting this component SECURE? Look for: misconfigured cloud services, exposed management ports, missing network segmentation, insecure defaults.",
  INSIDER_THREAT:
    "Could a malicious or negligent INSIDER exploit this component? Look for: excessive permissions, missing separation of duties, unmonitored admin access.",
  AVAILABILITY:
    "Can this component's AVAILABILITY be disrupted? Look for: single points of failure, missing failover, resource exhaustion, cascading failures.",
  // Kill Chain
  RECONNAISSANCE:
    "What information can an attacker DISCOVER about this component? Look for: exposed version info, directory listing, API schema leakage, error messages revealing internals.",
  DELIVERY:
    "How could an attacker DELIVER a payload to this component? Look for: file upload, email attachment processing, webhook intake, API input.",
  EXPLOITATION:
    "What VULNERABILITIES in this component could be exploited? Look for: known CVEs, unpatched software, injection points, deserialization flaws.",
  INSTALLATION:
    "How could an attacker establish PERSISTENCE via this component? Look for: writable configs, cron/scheduled tasks, startup scripts, account creation.",
  COMMAND_AND_CONTROL:
    "How could a compromised component COMMUNICATE with an attacker? Look for: outbound network access, DNS tunneling, covert channels, webhook callbacks.",
  ACTIONS_ON_OBJECTIVES:
    "What could an attacker ACHIEVE by compromising this component? Look for: data exfiltration routes, lateral movement to other components, sabotage potential.",
  // MITRE ATT&CK Tactics
  INITIAL_ACCESS:
    "How could an attacker GAIN INITIAL ACCESS to this component? Look for: exposed services, public-facing APIs, phishing vectors, supply chain entry points, valid account abuse.",
  EXECUTION:
    "How could an attacker EXECUTE CODE on this component? Look for: command injection, script execution, API abuse, serverless invocation, container exec.",
  PERSISTENCE:
    "How could an attacker MAINTAIN ACCESS to this component? Look for: account creation, scheduled tasks, modified configs, implanted backdoors, webhook callbacks.",
  PRIVILEGE_ESCALATION:
    "How could an attacker ESCALATE PRIVILEGES via this component? Look for: misconfigured IAM, container escape, SSRF to metadata, role assumption, token theft.",
  DEFENSE_EVASION:
    "How could an attacker AVOID DETECTION on this component? Look for: log tampering, disabling monitoring, obfuscation, traffic blending, credential rotation.",
  CREDENTIAL_ACCESS:
    "How could an attacker STEAL CREDENTIALS from this component? Look for: credential stores, token endpoints, brute force vectors, memory dumps, config files.",
  DISCOVERY:
    "What could an attacker DISCOVER about the environment from this component? Look for: API enumeration, error messages, metadata endpoints, network scanning.",
  LATERAL_MOVEMENT:
    "How could an attacker MOVE LATERALLY from this component to others? Look for: shared credentials, trust relationships, network access, service mesh abuse.",
  COLLECTION:
    "How could an attacker COLLECT TARGET DATA from this component? Look for: database queries, file access, API bulk exports, cache dumps.",
  EXFILTRATION:
    "How could an attacker EXFILTRATE DATA from this component? Look for: outbound channels, DNS tunneling, webhook abuse, cloud storage uploads, email.",
  IMPACT:
    "How could an attacker cause DAMAGE via this component? Look for: data destruction, service disruption, resource hijacking, ransomware, data manipulation.",
};

// ---------------------------------------------------------------------------
// System prompt (same for all micro-calls)
// ---------------------------------------------------------------------------

const ARRAY_OUTPUT_RULE =
  "Return ONLY a JSON array. No markdown, no explanation, no code fences.";
const OBJECT_OUTPUT_RULE =
  'Return ONLY one JSON object of the form {"threats":[...],"gaps":[...]}. No markdown, no explanation, no code fences, no text outside the object.';

const buildSystemPrompt = (
  OUTPUT_RULE: string,
) => `You are a security architect analyzing ONE component for ONE specific threat category. You have reference data showing known threats, CWEs, and compliance requirements for this component type.

Rules:
- Return every distinct threat the evidence supports — do not pad and do not stop at a fixed number. If this category genuinely doesn't apply, return no threats (an empty list).
- Abstraction level: one threat per distinct control gap. Do NOT emit variants that a single mitigation would close together (e.g. one threat per endpoint or parameter for the same missing control) — merge them into one threat and name the affected surfaces in its description.
- Every threat MUST be specific to THIS component and its connections. No generic threats.
- Cite evidence: CWE IDs, OWASP references, compliance clauses from the reference data.
- Consider existing controls — don't flag what's already mitigated.
- Do NOT include mitigations — those are generated in a separate analysis pass.
- ${OUTPUT_RULE}

Citation discipline — each threat's "description" field MUST embed at least one inline citation tag using the exact reference ids from the reference data above. Valid tag forms:
  [ref:CWE-89]            cites a CWE from the provided list
  [ref:A03:2021]          cites an OWASP Top-10 entry
  [component:NODE_ID]     cites the component under analysis
  Not found: <claim>      prefix if no evidence supports the claim
Use EXACT ids. NEVER invent a CWE number that isn't in the reference data.`;

const SYSTEM_PROMPT = buildSystemPrompt(ARRAY_OUTPUT_RULE);

// The first-pass category call carries its output schema and GAPS rules
// here rather than at the end of the user message, so the system message is
// byte-identical for every component and category and the server can reuse
// its KV cache. Only the variable context goes in the user message.
const CATEGORY_SYSTEM_PROMPT = `${buildSystemPrompt(OBJECT_OUTPUT_RULE)}

Output format — ONE JSON object; "category" inside each threat is exactly the category named on the "## Category:" line of the request:
{"threats":[{"name":"Specific title","description":"Why this applies to THIS component","category":"<the category under analysis>","severity":"CRITICAL|HIGH|MEDIUM|LOW","cweIds":["CWE-287"],"owaspIds":["A07:2021"],"evidence":{"compliance":"clause","attackPath":"steps"},"confidence":0.7}],"gaps":["specific input you lacked to fully analyze this","another concrete gap"]}

IMPORTANT: cweIds and owaspIds must be arrays. Do NOT include mitigations — those come in a separate pass.

"gaps" must name CONCRETE missing inputs that, if provided, would let you add a real threat — e.g. "encryption-at-rest posture for the database", "rate limit on the /search endpoint", "whether the admin role is gated by MFA". Do NOT write vague gaps like "more context" or "additional detail". If you had everything you needed, use "gaps": []. The gaps list drives the follow-up pass; honest gaps produce better second-pass threats than no gaps.`;

const CONTROL_CATEGORIES = [
  "IAM",
  "ENCRYPTION",
  "ACCESS_CONTROL",
  "NETWORK",
  "LOGGING",
  "INPUT_VALIDATION",
  "SECRETS",
  "BACKUP",
  "MONITORING",
  "SUPPLY_CHAIN",
];

// Every static mitigation instruction lives here (see
// CATEGORY_SYSTEM_PROMPT); the user message holds only the component, a
// numbered batch of threats and the available requirements.
const MITIGATION_SYSTEM_PROMPT = `You are a security controls architect generating mitigations for SPECIFIC threats on a SPECIFIC component. For each numbered threat you analyze what controls from DIFFERENT categories would reduce that threat's risk. Treat every threat independently.

Mitigation count — match each threat, do NOT anchor on a number. Before writing anything for a threat, enumerate silently:
  1. each distinct attack surface implied by the threat
  2. each compromise path the threat description spells out
  3. each missing control the threat relies on to succeed
  4. each trust boundary or data layer the threat crosses
- Produce ONE mitigation per distinct surface / path / missing-control / boundary you identified.
- Do NOT anchor on 3 or 4 — that is habit, not assessment. A narrow threat with one concrete root cause may need ONE strong mitigation. A broad threat crossing multiple layers may need SIX or more.
- Never pad to hit a count. Never truncate when more layers are genuinely warranted.
- When a title would naturally read "X and Y" where X and Y are independently testable, prefer two entries so each gets its own testCriteria.
- STAY WITHIN SCOPE: each mitigation must address a surface/path/missing-control EXPLICITLY present in that threat's description. Do not introduce mitigations for adjacent risks the threat does not mention. If the threat description does not mention it, it is not in scope.

Rules:
- Within one threat, each mitigation must come from a DIFFERENT control category.
- Categories: ${CONTROL_CATEGORIES.join(", ")}
- Each mitigation is a HIGH-LEVEL testable control, NOT an implementation recipe.
- "Implement IAM controls for service authentication" NOT "Configure OAuth2 with PKCE using RS256"
- Every mitigation MUST have testCriteria: "Confirm that [testable condition]" or "Verify that [observable behavior]"
- A verification team must be able to independently test each mitigation.
- Effectiveness: 0.05-0.85 max. No single control eliminates a threat.

Requirements: when a mitigation satisfies a LISTED requirement, cite it in description with [req:REQID] using the EXACT reqId shown; set suggestedRequirement to null. When NO listed requirement applies (gap, or no imports), omit the tag and PROPOSE a one-sentence generalized requirement in suggestedRequirement.text using imperative voice (MUST/SHALL) plus category (security|functional|compliance|privacy|performance). Never invent reqIds in [req:...] tags.

Return ONLY a JSON array with one entry per numbered threat, "threat" set to that threat's number. No markdown, no explanation, no code fences. Each mitigation carries an optional suggestedRequirement (null when description has a [req:...] tag):
[{"threat":1,"mitigations":[{"description":"High-level control","controlCategory":"IAM","testCriteria":"Confirm that [testable condition]","effectiveness":0.35-0.85,"suggestedRequirement":{"text":"One-sentence policy-grade requirement in imperative voice","category":"security"}}]}]`;

// ---------------------------------------------------------------------------
// Build the focused prompt
// ---------------------------------------------------------------------------

/**
 * Refutation block: the threats the Verifier confidently refuted for this
 * (component, category) on a prior pass. Rendered into the category prompt as a
 * "previously refuted — do not re-propose" section so the re-run does not
 * regenerate them. Empty/undefined → no block (the first-pass prompt is
 * unchanged on the non-loop path).
 */
function buildRefutedBlock(
  refuted?: Array<{ name: string; reason?: string }>,
): string {
  if (!refuted || refuted.length === 0) return "";
  const lines = refuted
    .map((r) => `- ${r.name}${r.reason ? ` — ${r.reason}` : ""}`)
    .join("\n");
  return `## Previously refuted — DO NOT re-propose
A prior pass proposed these threats for this component and category; an adversarial review REFUTED each one for the reason given. Do NOT propose them again or trivial rewordings of them. Only return GENUINELY NEW threats this review missed.
${lines}`;
}

/**
 * Budget for the reference block, in characters.
 *
 * Was an implicit 3000 for the WHOLE prompt, which the component header and
 * connection list alone can approach — so on any component with real reference
 * data the guard fired and kept `refSections.slice(0, 2)`: threat templates and
 * rule-based seeds. Those are the two the system prompt never asks anyone to
 * cite. CWE ids, OWASP entries, compliance clauses and sequence flows — the
 * things it MANDATES citing, by exact id, while forbidding invention — were
 * dropped first, every time.
 *
 * 12000 chars is roughly 3k tokens of references against a 45k-token ceiling,
 * so the guard is now a genuine runaway stop rather than a routine amputation.
 */
const REF_BUDGET_CHARS = 12_000;

/**
 * Render reference sections, dropping by explicit priority when over budget
 * instead of by array position. Lower `drop` survives longer; mandated
 * citations (CWE, OWASP) are drop:1 and go last. Never returns an empty block
 * while any section fits.
 */
function renderRefSections(
  sections: Array<{ text: string; drop: number }>,
): string {
  const joined = sections.map((s) => s.text).join("\n\n");
  if (joined.length <= REF_BUDGET_CHARS) return joined;

  // Stable sort by priority, then fill the budget in that order.
  const byPriority = [...sections].sort((a, b) => a.drop - b.drop);
  const kept: typeof sections = [];
  let used = 0;
  for (const s of byPriority) {
    const cost = s.text.length + 2; // separator
    if (used + cost > REF_BUDGET_CHARS && kept.length > 0) continue;
    kept.push(s);
    used += cost;
  }
  // Restore the original section order for a stable, readable prompt.
  return sections
    .filter((s) => kept.includes(s))
    .map((s) => s.text)
    .join("\n\n");
}

/**
 * The component header and connection list (shared by the
 * single-category and the chunked prompt).
 */
function renderComponentHeader(component: ComponentContext): string {
  // A trust-boundary crossing is the single most threat-relevant fact about an
  // edge, and the per-edge data classification says what is at stake when it is
  // crossed. Both must reach the prompt.
  const edgeSuffix = (c: {
    dataClassifications?: string[];
    peerTrustZone?: string;
    crossesBoundary?: boolean;
  }): string => {
    const parts: string[] = [];
    if (c.peerTrustZone) parts.push(`peer_zone=${c.peerTrustZone}`);
    if (c.crossesBoundary) parts.push("CROSSES TRUST BOUNDARY");
    if (c.dataClassifications?.length)
      parts.push(`data=${c.dataClassifications.join("/")}`);
    return parts.length ? ` ${parts.join(" ")}` : "";
  };

  const connections = [
    ...component.inbound.map(
      (c) =>
        `  IN: ${c.from} → this [${c.protocol || "?"}] encrypted=${c.encrypted ?? "?"} auth=${c.auth || "none"}${edgeSuffix(c)}`,
    ),
    ...component.outbound.map(
      (c) =>
        `  OUT: this → ${c.to} [${c.protocol || "?"}] encrypted=${c.encrypted ?? "?"} auth=${c.auth || "none"}${edgeSuffix(c)}`,
    ),
  ].join("\n");

  const techLine = component.technologyVersion
    ? `Technology: ${component.technologyVersion}`
    : "";
  const accessLine = component.accessPattern
    ? `Access: ${component.accessPattern}`
    : "";
  const zoneLine = component.trustZone
    ? `Trust Zone: ${component.trustZone}`
    : "";

  return `## Component: ${component.name} (${component.type})
${component.description || "No description"}
${techLine}
Data Classification: ${component.dataClassification} | Data Handled: ${component.dataTypes.join(", ") || "unspecified"}
${accessLine}
${zoneLine}
Controls: ${component.existingControls.join(", ") || "none documented"}

## Connections
${connections || "No connections"}`;
}

/**
 * The reference sections for one category, with their drop priorities
 * (shared by the single-category and the chunked prompt).
 */
function buildRefSections(
  refs: CategoryReferenceData,
  sequenceFlows?: Array<{
    from: string;
    to: string;
    label: string;
    protocol?: string;
    authentication?: string;
  }>,
): Array<{ text: string; drop: number }> {
  // Reference data sections (only include what exists).
  //
  // Each carries a DROP PRIORITY for the size guard below: lower survives
  // longer. The system prompt MANDATES citing CWE and OWASP ids and forbids
  // inventing them, so those two sections are the last things that may be
  // dropped — a prompt that demands a citation while withholding the id it
  // must cite is asking to be answered with a hallucination.
  const refSections: Array<{ text: string; drop: number }> = [];

  if (refs.threatTemplates.length > 0) {
    const examples = refs.threatTemplates
      .slice(0, 4)
      .map(
        (t) =>
          `- ${t.name}: ${t.description.slice(0, 120)} [${t.cweIds.join(",")}]`,
      )
      .join("\n");
    refSections.push({
      text: `## Known Threats for This Component Type + Category\n${examples}`,
      drop: 4,
    });
  }

  if (refs.ruleBasedSeeds.length > 0) {
    const seeds = refs.ruleBasedSeeds
      .slice(0, 3)
      .map((t) => `- ${t.name} (${t.severity})`)
      .join("\n");
    refSections.push({
      text: `## Rule-Based Findings (already identified)\n${seeds}`,
      drop: 5,
    });
  }

  if (refs.cwes.length > 0) {
    const cwes = refs.cwes
      .slice(0, 4)
      .map((c) => `- ${c.id}: ${c.name}`)
      .join("\n");
    refSections.push({ text: `## Relevant CWE Weaknesses\n${cwes}`, drop: 1 });
  }

  if (refs.owaspEntries.length > 0) {
    const owasp = refs.owaspEntries
      .map((o) => `- ${o.id} ${o.name}: ${o.relevance}`)
      .join("\n");
    refSections.push({ text: `## OWASP References\n${owasp}`, drop: 1 });
  }

  if (refs.complianceReqs.length > 0) {
    const compliance = refs.complianceReqs
      .slice(0, 3)
      .map((c) => `- [${c.framework}] ${c.clause}: ${c.requirement}`)
      .join("\n");
    refSections.push({
      text: `## Compliance Requirements\n${compliance}`,
      drop: 2,
    });
  }

  // Add sequence flow context if available for this component
  if (sequenceFlows && sequenceFlows.length > 0) {
    const flowLines = sequenceFlows
      .slice(0, 5)
      .map(
        (f) =>
          `- ${f.from} → ${f.to}: ${f.label} [${f.protocol || "?"}] auth=${f.authentication || "none"}`,
      )
      .join("\n");
    refSections.push({
      text: `## Sequence Flow Steps Involving This Component\n${flowLines}`,
      drop: 3,
    });
  }

  return refSections;
}

export function buildCategoryPrompt(
  component: ComponentContext,
  category: string,
  refs: CategoryReferenceData,
  sequenceFlows?: Array<{
    from: string;
    to: string;
    label: string;
    protocol?: string;
    authentication?: string;
  }>,
  refutedThreats?: Array<{ name: string; reason?: string }>,
): { system: string; user: string } {
  const refSections = buildRefSections(refs, sequenceFlows);
  const definition = CATEGORY_DEFINITIONS[category] || category;
  const refutedBlock = buildRefutedBlock(refutedThreats);

  const user = `${renderComponentHeader(component)}

## Category: ${category}
${definition}

${renderRefSections(refSections)}
${refutedBlock ? `\n${refutedBlock}\n` : ""}
## Task
Analyze this component for ${category} threats. Reference the SPECIFIC technology (${component.technologyVersion || component.type}) and data types (${component.dataTypes.join(", ") || "unspecified"}) in your findings.`;

  return { system: CATEGORY_SYSTEM_PROMPT, user };
}

// The chunked first pass — one call analyzes a fixed group of
// categories for one component. Same rules and citation discipline as the
// single-category prompt; the output is an object with one REQUIRED key per
// category listed in the request, so a skipped category is detectable
// (missing key) instead of looking like "no threats".
const CATEGORY_CHUNK_SYSTEM_PROMPT = `You are a security architect analyzing ONE component for SEVERAL specific threat categories. You have reference data showing known threats, CWEs, and compliance requirements for this component type, given separately for each category.

Rules (apply to EACH category independently):
- Return every distinct threat the evidence supports for each category — do not pad and do not stop at a fixed number. If a category genuinely doesn't apply, return an empty "threats" array for it.
- Abstraction level: one threat per distinct control gap. Do NOT emit variants that a single mitigation would close together (e.g. one threat per endpoint or parameter for the same missing control) — merge them into one threat and name the affected surfaces in its description.
- Every threat MUST be specific to THIS component and its connections. No generic threats.
- Cite evidence: CWE IDs, OWASP references, compliance clauses from that category's reference data.
- Consider existing controls — don't flag what's already mitigated.
- Do NOT include mitigations — those are generated in a separate analysis pass.
- Return ONLY the JSON object. No markdown, no explanation, no code fences.

Citation discipline — each threat's "description" field MUST embed at least one inline citation tag using the exact reference ids from the reference data. Valid tag forms:
  [ref:CWE-89]            cites a CWE from the provided list
  [ref:A03:2021]          cites an OWASP Top-10 entry
  [component:NODE_ID]     cites the component under analysis
  Not found: <claim>      prefix if no evidence supports the claim
Use EXACT ids. NEVER invent a CWE number that isn't in the reference data.

Output format — ONE JSON object. Its keys are EXACTLY the category names listed under "## Categories" in the request, every one of them present. Each value is an object with the threats for that category and the concrete gaps you had for it:
{"<CATEGORY>":{"threats":[{"name":"Specific title","description":"Why this applies to THIS component","category":"<CATEGORY>","severity":"CRITICAL|HIGH|MEDIUM|LOW","cweIds":["CWE-287"],"owaspIds":["A07:2021"],"evidence":{"compliance":"clause","attackPath":"steps"},"confidence":0.7}],"gaps":["specific input you lacked"]}}

IMPORTANT: cweIds and owaspIds must be arrays. "gaps" name CONCRETE missing inputs that would let you add a real threat (e.g. "rate limit on the /search endpoint"); use [] if you had everything. Never omit a listed category.`;

/**
 * First-pass prompt for a chunk of categories on one component. Each
 * category carries its own definition, reference sections (same drop
 * priorities and budget as the single-category prompt) and refuted block.
 */
export function buildCategoryChunkPrompt(
  component: ComponentContext,
  categories: Array<{
    category: string;
    refs: CategoryReferenceData;
    refutedThreats?: Array<{ name: string; reason?: string }>;
  }>,
  sequenceFlows?: Array<{
    from: string;
    to: string;
    label: string;
    protocol?: string;
    authentication?: string;
  }>,
): { system: string; user: string } {
  const sections = categories.map(({ category, refs, refutedThreats }) => {
    const definition = CATEGORY_DEFINITIONS[category] || category;
    const refutedBlock = buildRefutedBlock(refutedThreats);
    return `### Category: ${category}
${definition}

${renderRefSections(buildRefSections(refs, sequenceFlows))}${refutedBlock ? `\n\n${refutedBlock}` : ""}`;
  });

  const names = categories.map((c) => c.category).join(", ");
  const user = `${renderComponentHeader(component)}

## Categories: ${names}

${sections.join("\n\n")}

## Task
Analyze this component for each category above: ${names}. Reference the SPECIFIC technology (${component.technologyVersion || component.type}) and data types (${component.dataTypes.join(", ") || "unspecified"}) in your findings. Return one key per category.`;

  return { system: CATEGORY_CHUNK_SYSTEM_PROMPT, user };
}

/**
 * Build a minimal prompt for retry after a 400 error (context too large).
 * Strips all reference data, keeps only component + category + task.
 */
export function buildMinimalPrompt(
  component: ComponentContext,
  category: string,
): { system: string; user: string } {
  const definition = CATEGORY_DEFINITIONS[category] || category;
  const user = `## Component: ${component.name} (${component.type})
${(component.description || "").slice(0, 200)}
Technology: ${component.technologyVersion || "unknown"}
Data: ${component.dataTypes.slice(0, 3).join(", ") || "unspecified"}

## Category: ${category}
${definition}

Return the distinct threats you find as a JSON array. No mitigations, no markdown.
[{"name":"title","description":"why","category":"${category}","severity":"HIGH","cweIds":["CWE-XXX"],"confidence":0.7}]`;

  return { system: SYSTEM_PROMPT, user };
}

// ---------------------------------------------------------------------------
// Confidence loop follow-up prompt
// ---------------------------------------------------------------------------

/**
 * Build a citation-loop follow-up prompt. Fires when the first-pass
 * threats had poor citation coverage (too few or format-invalid tags).
 * Asks the LLM to re-cite the SAME threats with proper grammar — NOT to
 * generate new threats.
 */
export function buildCitationLoopPrompt(
  component: ComponentContext,
  category: string,
  existingThreats: MicroThreat[],
  refs: CategoryReferenceData,
): { system: string; user: string } {
  const threatList = existingThreats
    .map((t, i) => `${i + 1}. ${t.name}\n   Description: ${t.description}`)
    .join("\n\n");

  // Remind the LLM of the valid reference ids from the injected data
  const cwes = refs.cwes
    .slice(0, 6)
    .map((c) => c.id)
    .join(", ");
  const owasps = refs.owaspEntries
    .slice(0, 3)
    .map((o) => o.id)
    .join(", ");

  const user = `## Component: ${component.name} (${component.type})
## Category: ${category}

## Threats from your previous response
${threatList}

## Problem
Your earlier threats did not carry proper inline citation tags. Re-emit
the SAME threats (same names, same descriptions) but with citation tags
embedded in the description field.

Valid tag forms:
  [ref:CWE-XX]          — cite one of: ${cwes || "the CWEs in the reference data"}
  [ref:A03:2021]        — cite one of: ${owasps || "the OWASP Top-10 entries"}
  [component:${component.id}]   — cite this component (the one under analysis)
  Not found: <claim>    — prefix when no source grounds the claim

Do NOT invent CWE numbers or OWASP ids. If a threat genuinely has no
grounding, use the "Not found:" prefix rather than a fake citation.

Return the same number of threats as a JSON array — same names, same
severities, descriptions now with tags.`;

  return { system: SYSTEM_PROMPT, user };
}

export function buildConfidenceLoopPrompt(
  component: ComponentContext,
  category: string,
  existingThreats: MicroThreat[],
  refs: CategoryReferenceData,
  gaps?: string[],
): { system: string; user: string } {
  const existing = existingThreats
    .map((t) => `- ${t.name} (${t.severity})`)
    .join("\n");

  // Show unused reference templates the LLM didn't pick up
  const usedNames = new Set(existingThreats.map((t) => t.name.toLowerCase()));
  const unusedTemplates = refs.threatTemplates
    .filter((t) => !usedNames.has(t.name.toLowerCase()))
    .slice(0, 3);
  const unusedSection =
    unusedTemplates.length > 0
      ? `\n## Unused Reference Threats (consider these)\n${unusedTemplates.map((t) => `- ${t.name}: ${t.description.slice(0, 100)}`).join("\n")}`
      : "";

  // Feed the LLM its own self-identified gaps back in. These drive the
  // second pass toward concrete missing areas, not another re-scan.
  const gapsSection =
    gaps && gaps.length > 0
      ? `\n## Gaps You Identified on First Pass\n${gaps
          .slice(0, 8)
          .map((g) => `- ${g}`)
          .join(
            "\n",
          )}\n\nFor each gap above that IS addressable from the component description, connections, and reference data, produce one new threat. If a gap cannot be addressed without additional input, skip it — do not manufacture a threat to fill the slot.`
      : "";

  const definition = CATEGORY_DEFINITIONS[category] || category;

  const user = `## Component: ${component.name} (${component.type})
Category: ${category} — ${definition}

## Already Found
${existing || "None"}
${unusedSection}${gapsSection}

## Task
Review your previous findings. Did you miss any ${category} threats for this specific component? Consider the unused reference threats${gaps && gaps.length > 0 ? " and the gaps you identified" : ""} above. Return ONLY NEW, distinct threats (not variants of one already found) as a JSON array. If nothing was missed, return [].`;

  return { system: SYSTEM_PROMPT, user };
}

// ---------------------------------------------------------------------------
// Gap extraction from LLM output
// ---------------------------------------------------------------------------

/**
 * Extract the `GAPS: [...]` list emitted after the JSON threats array.
 * Returns an empty array if no GAPS line found or the list is malformed.
 * Tolerates surrounding prose, multi-line JSON, and trailing commentary.
 */
export function extractGaps(raw: string): string[] {
  // Match `GAPS:` followed by a JSON array, allowing newlines inside.
  const match = raw.match(/GAPS\s*:\s*(\[[\s\S]*?\])/i);
  if (!match) return [];
  try {
    const parsed = JSON.parse(match[1]);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((g): g is string => typeof g === "string")
      .map((g) => g.trim())
      .filter((g) => g.length > 0);
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Mitigation prompt builder (separate pass, batched per component)
// ---------------------------------------------------------------------------

/**
 * Build a prompt that generates mitigations for a batch of threats on one
 * component . Threats are numbered from 1; the reply is keyed by that
 * number. Runs AFTER dedup and the confidence floor as a separate pass.
 */
export function buildMitigationBatchPrompt(
  component: ComponentContext,
  threats: Array<{
    name: string;
    description: string;
    category: string;
    cweIds: string[];
  }>,
  requirements?: Array<{
    reqId: string;
    text: string;
    category?: string | null;
  }>,
): { system: string; user: string } {
  const reqBlock =
    !requirements || requirements.length === 0
      ? "No imported requirements available. Do NOT emit [req:...] tags."
      : requirements
          .slice(0, 40)
          .map(
            (r) =>
              `- [req:${r.reqId}] (${r.category || "requirement"}) ${r.text.slice(0, 140)}`,
          )
          .join("\n");

  const threatBlock = threats
    .map(
      (t, i) => `### Threat ${i + 1}
Name: ${t.name}
Category: ${t.category}
CWEs: ${t.cweIds.join(", ") || "none"}
Description: ${t.description.slice(0, 300)}`,
    )
    .join("\n\n");

  const user = `## Component: ${component.name} (${component.type})
Technology: ${component.technologyVersion || "unknown"}
Data: ${component.dataClassification} | ${component.dataTypes.join(", ") || "unspecified"}
Controls already in place: ${component.existingControls.join(", ") || "none"}

## Available Requirements
${reqBlock}

## Threats to Mitigate
${threatBlock}

## Task
Generate mitigations for each of the ${threats.length} threat(s) above.`;

  return { system: MITIGATION_SYSTEM_PROMPT, user };
}

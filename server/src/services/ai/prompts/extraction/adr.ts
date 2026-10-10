/**
 * ADR (Architecture Decision Record) Extraction Prompts
 *
 * For extracting architecture from ADRs in MADR, Nygard, or custom formats.
 */

export const ADR_EXTRACTION_SYSTEM_PROMPT = `You are a security architect analyzing Architecture Decision Records (ADRs) to extract threat-relevant information. ADRs document significant architectural decisions and their rationale.

## Your Expertise
- Understanding ADR formats (MADR, Nygard, custom)
- Extracting security implications from technology choices
- Identifying attack surface changes from decisions
- Mapping decisions to affected components

## ADR Section Analysis

### From Context/Problem Statement
- Identify the system scope affected
- Extract existing constraints and assumptions
- Note security-relevant drivers

### From Decision
- Map technology choices to component types
- Identify new dependencies (external services)
- Note authentication/authorization changes
- Identify data handling changes

### From Consequences
- Extract security trade-offs mentioned
- Identify accepted risks
- Note compliance implications

### Security Implications to Extract
- New attack surfaces introduced
- Dependencies added (supply chain risk)
- Authentication mechanism changes
- Data flow modifications
- Encryption requirements
- Access control changes`;

export const ADR_EXTRACTION_USER_PROMPT = `Extract architectural and security-relevant information from this Architecture Decision Record. Follow these steps:

**Step 1 — Find all components**: Identify technologies/services chosen and existing components affected by this decision
**Step 2 — Assign trust zones**: Place components in boundaries based on their exposure (PUBLIC, INTERNAL, CONFIDENTIAL, RESTRICTED)
**Step 3 — Map data flows**: Identify new integrations or data paths introduced by this decision
**Step 4 — Identify sequences**: If the ADR describes a flow or interaction pattern, extract it as a sequence

## ADR Document
{{documentText}}

Return as JSON only (no other text):
\`\`\`json
{
  "components": [
    {
      "id": "unique-slug-id",
      "name": "Component name",
      "type": "webServer|api|apiGateway|database|cache|queue|storage|authService|externalService|client|actor|service|loadBalancer|cdn|firewall",
      "description": "What this component does",
      "technology": "Specific technology chosen",
      "dataHandled": ["data types"],
      "confidence": 0.0,
      "sourceText": "Quote from ADR",
      "derivedFrom": "ADR section (Context|Decision|Consequences)"
    }
  ],
  "dataFlows": [
    {
      "id": "unique-flow-id",
      "sourceId": "component-id",
      "targetId": "component-id",
      "label": "Data/request description",
      "protocol": "HTTPS|gRPC|WebSocket|TCP|SQL|etc",
      "dataTypes": ["data types"],
      "encrypted": true,
      "confidence": 0.0
    }
  ],
  "boundaries": [
    {
      "id": "unique-boundary-id",
      "name": "Boundary name",
      "type": "trust|network|vpc|organization",
      "trustLevel": "PUBLIC|INTERNAL|CONFIDENTIAL|RESTRICTED",
      "componentIds": ["component-ids"],
      "description": "Why these components share a trust level",
      "confidence": 0.0
    }
  ],
  "sequences": [
    {
      "id": "seq-unique-id",
      "name": "Sequence name",
      "description": "What this sequence achieves",
      "steps": [
        {
          "from": "source-component-id",
          "to": "target-component-id",
          "message": "Request or data description",
          "notes": "Optional detail"
        }
      ]
    }
  ],
  "requirements": [
    {
      "id": "req-1",
      "reqId": "ADR-SEC-1",
      "text": "Security requirement or constraint stated in this ADR",
      "docId": "ADR",
      "category": "security"
    }
  ],
  "technologies": ["tech list"],
  "dataTypes": ["pii", "phi", "pci", "credentials", "internal", "public"],
  "confidence": 0.0,
  "warnings": ["Security trade-offs accepted, risks identified, or ambiguities"]
}
\`\`\`

Rules:
- Return ONLY the JSON object, no other text
- Use descriptive kebab-case IDs (not UUIDs)
- Every component must appear in exactly one boundary
- All sourceId/targetId in dataFlows and sequence steps must be valid component IDs
- Put security implications and accepted risks in warnings
- requirements: only security-relevant constraints from the ADR`;

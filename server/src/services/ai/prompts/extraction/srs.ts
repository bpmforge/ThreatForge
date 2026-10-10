/**
 * SRS (Software Requirements Specification) Extraction Prompts
 *
 * For extracting architecture from IEEE 830 and similar requirement docs.
 */

export const SRS_EXTRACTION_SYSTEM_PROMPT = `You are an expert software architect and security analyst who specializes in extracting system architecture from Software Requirements Specification (SRS) documents. You understand IEEE 830 format, functional requirements, non-functional requirements, and use case analysis.

## Your Expertise
- Interpreting SRS documents (IEEE 830, Agile user stories, etc.)
- Deriving system architecture from requirements
- Identifying actors and their interactions
- Mapping functional requirements to system components
- Extracting security requirements from NFRs
- Understanding use case flows and data interactions

## SRS Section Interpretation

### From Functional Requirements (FR)
- "The system shall..." → Implies a component that provides this capability
- Data processing requirements → Database or service components
- User interaction requirements → Web/client interfaces
- Integration requirements → External service connections
- Authentication requirements → Auth service components

### From Non-Functional Requirements (NFR)
- Security NFRs → Trust boundaries, encryption requirements
- Performance NFRs → Caching, load balancers
- Availability NFRs → Redundancy, failover components
- Scalability NFRs → Queues, distributed components
- Compliance NFRs → Audit logging, data classification

### From Use Cases / User Stories
- Actors → Actor components (user types, external systems)
- Use case steps → Data flows between components
- Preconditions → Trust boundaries and access controls
- Extensions/Alternatives → Error handling flows

### From External Interface Requirements
- User interfaces → Web server, client components
- Hardware interfaces → IoT, embedded system connections
- Software interfaces → External APIs, third-party services
- Communication interfaces → Protocols, network requirements

## Component Type Mapping for SRS
- User roles/actors → actor
- "Web interface", "portal", "dashboard" → webServer
- "API", "backend service", "endpoint" → api
- "Database", "data store", "repository" → database
- "File storage", "document store", "S3" → storage
- "Login", "SSO", "authentication" → authService
- "Third-party", "external API", "integration" → externalService
- "Mobile app", "desktop app", "browser" → client
- "Message queue", "event bus", "async" → queue
- "Cache", "session store" → cache`;

export const SRS_EXTRACTION_USER_PROMPT = `Extract system architecture from this Software Requirements Specification. Follow these steps in order:

**Step 1 — Find all components**: Identify every actor, system, and service implied by functional requirements and use cases
**Step 2 — Assign trust zones**: Place each component in a boundary (PUBLIC = user-facing, INTERNAL = backend services, CONFIDENTIAL = auth/data stores, RESTRICTED = PII/PHI/PCI data stores)
**Step 3 — Map data flows**: Derive flows from use case steps, interface requirements, and system interactions
**Step 4 — Identify sequences**: Extract 2-4 key use case flows as named sequences with ordered steps

## SRS Document
{{documentText}}

Return as JSON only (no other text):
\`\`\`json
{
  "components": [
    {
      "id": "unique-slug-id",
      "name": "Human readable name",
      "type": "webServer|api|apiGateway|database|cache|queue|storage|authService|externalService|client|actor|service|loadBalancer|cdn|firewall",
      "description": "What this component does (reference requirement if applicable)",
      "technology": "Technology if specified",
      "dataHandled": ["data types"],
      "confidence": 0.0,
      "sourceText": "Requirement text that implies this component",
      "derivedFrom": "FR-1 or NFR-2 or UC-3"
    }
  ],
  "dataFlows": [
    {
      "id": "unique-flow-id",
      "sourceId": "component-id",
      "targetId": "component-id",
      "label": "What data/requests flow",
      "protocol": "HTTPS|gRPC|WebSocket|TCP|SQL|etc",
      "dataTypes": ["data types"],
      "encrypted": true,
      "confidence": 0.0,
      "derivedFrom": "UC-1 Step 3"
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
      "confidence": 0.0,
      "derivedFrom": "Security NFR reference"
    }
  ],
  "sequences": [
    {
      "id": "seq-unique-id",
      "name": "Sequence name (e.g., 'User Login Flow')",
      "description": "What this sequence achieves",
      "steps": [
        {
          "from": "source-component-id",
          "to": "target-component-id",
          "message": "POST /login with credentials",
          "notes": "Optional step detail"
        }
      ]
    }
  ],
  "requirements": [
    {
      "id": "req-1",
      "reqId": "NFR-SEC-1",
      "text": "The system shall use TLS 1.3 for all external communications",
      "docId": "SRS",
      "category": "security"
    }
  ],
  "technologies": ["tech list"],
  "dataTypes": ["pii", "phi", "pci", "credentials", "internal", "public"],
  "confidence": 0.0,
  "warnings": ["Ambiguities or missing information"]
}
\`\`\`

Rules:
- Return ONLY the JSON object, no other text
- Use descriptive kebab-case IDs (not UUIDs)
- Every component must appear in exactly one boundary
- All sourceId/targetId in dataFlows and sequence steps must be valid component IDs
- requirements: extract ONLY security-relevant NFRs (auth, encryption, access control, audit, compliance)
- Use the document's own requirement IDs (e.g. "FR-12", "SEC-3") when present
- Include warnings for missing sections (e.g. "No security NFRs found")`;

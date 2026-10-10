/**
 * General Architecture Extraction Prompts
 *
 * For extracting architecture from generic technical documentation.
 */

export const ARCHITECTURE_EXTRACTION_SYSTEM_PROMPT = `You are an expert software architect and systems analyst who extracts architectural information from technical documentation. You are precise, thorough, and follow structured output formats exactly.

## Your Expertise
- Reading and interpreting technical documents
- Identifying system components from descriptions
- Understanding data flows and integrations
- Recognizing trust boundaries and security zones
- Mapping technologies to component types

## Component Type Mapping
Map descriptions to these types:
- webServer: Web applications, frontend servers, static hosting
- api: REST APIs, GraphQL, backend services
- apiGateway: API gateways, load balancers with routing
- database: SQL, NoSQL, data warehouses
- cache: Redis, Memcached, CDN caches
- queue: Message queues, event buses, Kafka
- storage: Object storage, file systems, blob storage
- authService: Identity providers, auth servers, SSO
- externalService: Third-party APIs, SaaS integrations
- client: Mobile apps, desktop apps, browsers
- actor: Users, admins, external systems
- service: Microservices, workers, background jobs
- loadBalancer: Load balancers, reverse proxies
- cdn: Content delivery networks
- firewall: WAF, network firewalls, security groups

## Data Classification
Identify sensitive data:
- pii: Personal Identifiable Information (names, emails, addresses)
- phi: Protected Health Information (medical records)
- pci: Payment Card Industry data (credit cards)
- credentials: Passwords, API keys, tokens
- internal: Business data, non-public information
- public: Public data, no sensitivity

## Trust Boundary Types
- trust: Security trust boundary (authenticated vs unauthenticated)
- network: Network segmentation (DMZ, internal, external)
- vpc: Cloud VPC or network boundary
- organization: Organizational boundary (internal vs partner vs public)

## Output Requirements
- Generate unique IDs for all components (use descriptive slugs like "user-api", "postgres-db")
- Set confidence scores based on how explicit the information is in the document
- Include warnings for ambiguous or missing information
- Ensure all component IDs referenced in flows exist in components array`;

export const ARCHITECTURE_EXTRACTION_USER_PROMPT = `Extract architectural information from this document. Follow these steps in order:

**Step 1 — Find all components**: Identify every system component mentioned or implied (services, databases, queues, clients, external systems, etc.)
**Step 2 — Assign trust zones**: Place each component in a trust boundary based on its exposure level (PUBLIC, INTERNAL, CONFIDENTIAL, RESTRICTED)
**Step 3 — Map data flows**: For every pair of components that communicate, define a data flow with direction, protocol, and data types
**Step 4 — Identify sequences**: Find named interaction sequences (e.g., "user login", "data ingestion", "alert notification") and break them into ordered steps

## Document
{{documentText}}

Return as JSON matching this exact schema:
\`\`\`json
{
  "components": [
    {
      "id": "unique-slug-id",
      "name": "Human readable name",
      "type": "webServer|api|apiGateway|database|cache|queue|storage|authService|externalService|client|actor|service|loadBalancer|cdn|firewall",
      "description": "What this component does",
      "technology": "Specific technology if mentioned (e.g., 'PostgreSQL', 'Node.js')",
      "dataHandled": ["Types of data this component handles"],
      "confidence": 0.0,
      "sourceText": "Quote from document that mentions this component"
    }
  ],
  "dataFlows": [
    {
      "id": "unique-flow-id",
      "sourceId": "component-id",
      "targetId": "component-id",
      "label": "What data/requests flow",
      "protocol": "HTTP|HTTPS|gRPC|WebSocket|TCP|SQL|etc",
      "dataTypes": ["What data is transferred"],
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
      "componentIds": ["ids of components inside this boundary"],
      "description": "Why these components share a trust level",
      "confidence": 0.0
    }
  ],
  "sequences": [
    {
      "id": "seq-unique-id",
      "name": "Sequence name (e.g., 'Telemetry Ingestion')",
      "description": "What this sequence achieves",
      "steps": [
        {
          "from": "source-component-id",
          "to": "target-component-id",
          "message": "HTTP POST /ingest with sensor payload",
          "notes": "Optional details about this step"
        }
      ]
    }
  ],
  "technologies": ["List of all technologies mentioned"],
  "dataTypes": ["pii", "phi", "pci", "credentials", "internal", "public"],
  "confidence": 0.0,
  "warnings": ["Any ambiguities or missing information"]
}
\`\`\`

Rules:
- Return ONLY the JSON object, no other text, no markdown outside the JSON
- Use descriptive kebab-case IDs (not UUIDs)
- Every component must appear in exactly one boundary
- All sourceId/targetId in dataFlows and sequence steps must be valid component IDs
- Set confidence lower when information is implied vs explicit
- Sequences: extract 2-5 key interaction sequences; each with 3-8 ordered steps`;

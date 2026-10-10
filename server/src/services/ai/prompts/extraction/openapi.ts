/**
 * OpenAPI/Swagger Extraction Prompts
 *
 * For extracting architecture from API specifications.
 */

export const OPENAPI_EXTRACTION_SYSTEM_PROMPT = `You are a security architect analyzing OpenAPI/Swagger specifications to extract threat model components. API specifications reveal attack surfaces, authentication mechanisms, and data handling.

## Your Expertise
- OpenAPI 3.x and Swagger 2.0 formats
- API security patterns (OAuth2, API keys, JWT)
- OWASP API Security Top 10
- Data sensitivity classification

## OpenAPI Section Analysis

### From Paths/Endpoints
- Each path group = potential API component
- HTTP methods indicate operations (CRUD)
- Path parameters reveal data handling
- Request/response schemas show data types

### From Security Schemes
- Authentication methods in use
- Authorization flows (OAuth2 scopes)
- API key locations (header, query, cookie)

### From Components/Schemas
- Data models and their sensitivity
- Required vs optional fields
- Enum values (business logic exposure)
- Relationships between entities

### Security Patterns to Extract
- Authentication mechanisms → authService component
- External integrations → externalService components
- Database operations implied → database component
- File uploads → storage component
- Sensitive data fields → data classification`;

export const OPENAPI_EXTRACTION_USER_PROMPT = `Extract architecture from this OpenAPI/Swagger specification for threat modeling. Follow these steps:

**Step 1 — Find all components**: Identify the API itself, auth services, data stores, clients, and external integrations implied by the spec
**Step 2 — Assign trust zones**: Public API surface (PUBLIC), internal backends (INTERNAL), auth/secret stores (CONFIDENTIAL), PII/PHI data (RESTRICTED)
**Step 3 — Map data flows**: Create flows for client→API, API→auth, API→database, and any external service calls
**Step 4 — Identify sequences**: Extract 2-3 key request flows (e.g., authenticated request, file upload, webhook delivery)

## API Specification
{{documentText}}

Return as JSON only (no other text):
\`\`\`json
{
  "components": [
    {
      "id": "unique-slug-id",
      "name": "Component name",
      "type": "api|apiGateway|authService|database|storage|cache|queue|externalService|client|actor",
      "description": "Component purpose",
      "technology": "Inferred technology",
      "dataHandled": ["data types"],
      "confidence": 0.0,
      "sourceText": "Relevant API path or schema reference",
      "endpoints": ["GET /users", "POST /auth/token"]
    }
  ],
  "dataFlows": [
    {
      "id": "unique-flow-id",
      "sourceId": "component-id",
      "targetId": "component-id",
      "label": "Operation description",
      "protocol": "HTTPS|WebSocket|gRPC",
      "dataTypes": ["data types"],
      "encrypted": true,
      "confidence": 0.0,
      "httpMethod": "GET|POST|PUT|DELETE|PATCH"
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
      "name": "Sequence name (e.g., 'Authenticated API Request')",
      "description": "What this sequence achieves",
      "steps": [
        {
          "from": "source-component-id",
          "to": "target-component-id",
          "message": "POST /auth/token with client_credentials",
          "notes": "Optional detail"
        }
      ]
    }
  ],
  "requirements": [
    {
      "id": "req-1",
      "reqId": "API-SEC-1",
      "text": "All endpoints require Bearer token authentication",
      "docId": "OpenAPI",
      "category": "security"
    }
  ],
  "technologies": ["tech list"],
  "dataTypes": ["pii", "phi", "pci", "credentials", "internal", "public"],
  "confidence": 0.0,
  "warnings": ["Security concerns, missing auth, exposed sensitive data, etc."]
}
\`\`\`

Rules:
- Return ONLY the JSON object, no other text
- Use descriptive kebab-case IDs (not UUIDs)
- Every component must appear in exactly one boundary
- All sourceId/targetId in dataFlows and sequence steps must be valid component IDs
- requirements: extract auth schemes, rate limiting, data validation requirements from the spec
- Flag unauthenticated endpoints, missing TLS, or PII in query parameters as warnings`;

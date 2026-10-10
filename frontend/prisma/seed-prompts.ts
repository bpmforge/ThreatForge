/**
 * Seed data for built-in AI Prompt Templates and Document Type Configurations
 *
 * Run with: npx tsx prisma/seed-prompts.ts
 */
import { getPrisma } from '../src/lib/prisma';
import type { PromptCategory, PromptOutputFormat } from '@prisma/client';

// =============================================================================
// Built-in Prompt Templates
// =============================================================================

interface PromptTemplateData {
  id: string;
  name: string;
  description: string;
  category: PromptCategory;
  systemPrompt: string;
  userPromptTemplate: string;
  variables: string;
  outputFormat: PromptOutputFormat;
  outputSchema?: string;
  temperature: number;
  maxTokens: number;
  requiresVision: boolean;
  tags: string;
  isBuiltIn: boolean;
}

const BUILTIN_PROMPTS: PromptTemplateData[] = [
  // ─────────────────────────────────────────────────────────────────────────────
  // THREAT ANALYSIS
  // ─────────────────────────────────────────────────────────────────────────────
  {
    id: 'builtin-threat-analysis',
    name: 'Threat Analysis',
    description: 'Analyze a threat model and identify security threats using STRIDE methodology',
    category: 'THREAT_IDENTIFICATION',
    systemPrompt: `You are a senior security architect with 15+ years of experience in threat modeling, penetration testing, and secure system design. You specialize in the STRIDE methodology and have deep knowledge of OWASP, NIST, and CWE frameworks.

## Your Expertise
- Application security architecture
- Network security and segmentation
- Cloud security (AWS, Azure, GCP)
- API security and authentication patterns
- Data protection and encryption
- Compliance frameworks (SOC2, HIPAA, PCI-DSS)

## STRIDE Categories (use these exact values)
- SPOOFING: Pretending to be someone/something else. Attacks on authentication.
- TAMPERING: Unauthorized modification of data, code, or configuration.
- REPUDIATION: Denying actions without proof. Lack of audit trails.
- INFORMATION_DISCLOSURE: Unauthorized access to sensitive data.
- DENIAL_OF_SERVICE: Making systems unavailable or degraded.
- ELEVATION_OF_PRIVILEGE: Gaining unauthorized access or capabilities.

## Analysis Approach
When analyzing a system:
1. First, understand the data flows and trust boundaries
2. Identify high-value assets (PII, credentials, financial data)
3. Consider the attack surface of each component
4. Think about both external attackers and malicious insiders
5. Consider the specific technology stack vulnerabilities
6. Prioritize threats by likelihood and impact

## Output Requirements
- Be specific to the architecture provided, not generic
- Include the target component when applicable
- Provide actionable mitigation hints
- Rate confidence based on how much context you have
- Use severity ratings: CRITICAL, HIGH, MEDIUM, LOW, INFO`,
    userPromptTemplate: `Analyze this threat model and identify the most significant security threats.

## System: {{systemName}}

## Components
{{components}}

## Data Flows
{{connections}}

## Trust Boundaries
{{boundaries}}

## Task
Identify 3-5 high-priority threats for this architecture. For each threat:
1. Consider the specific components and their interactions
2. Think about how an attacker would exploit this
3. Consider both the likelihood and impact

Return your analysis as a JSON array with this exact structure:
\`\`\`json
[
  {
    "title": "Brief, specific threat title (not generic)",
    "description": "Detailed description of the threat",
    "category": "SPOOFING|TAMPERING|REPUDIATION|INFORMATION_DISCLOSURE|DENIAL_OF_SERVICE|ELEVATION_OF_PRIVILEGE",
    "severity": "CRITICAL|HIGH|MEDIUM|LOW|INFO",
    "targetComponentId": "component-id if applicable, or null",
    "attackVector": "How an attacker would exploit this",
    "prerequisites": "What conditions must exist for this attack",
    "mitigation": "Recommended mitigation approach",
    "confidence": 0.0-1.0,
    "references": ["CWE-XXX", "OWASP reference if applicable"]
  }
]
\`\`\`

Only return the JSON array, no other text.`,
    variables: JSON.stringify([
      { name: 'systemName', displayName: 'System Name', type: 'text', required: true },
      { name: 'components', displayName: 'Components', type: 'json', required: true },
      { name: 'connections', displayName: 'Data Flows', type: 'json', required: true },
      { name: 'boundaries', displayName: 'Trust Boundaries', type: 'json', required: false },
    ]),
    outputFormat: 'JSON',
    temperature: 0.3,
    maxTokens: 3000,
    requiresVision: false,
    tags: JSON.stringify(['threat-modeling', 'stride', 'security']),
    isBuiltIn: true,
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // MITIGATION SUGGESTIONS
  // ─────────────────────────────────────────────────────────────────────────────
  {
    id: 'builtin-mitigation-suggestions',
    name: 'Mitigation Suggestions',
    description: 'Suggest specific mitigations for a security threat',
    category: 'MITIGATION',
    systemPrompt: `You are a security engineer specializing in defensive security controls and secure architecture patterns.

## Mitigation Principles
1. Defense in Depth: Multiple layers of security
2. Least Privilege: Minimum necessary access
3. Secure Defaults: Secure out of the box
4. Fail Secure: Deny by default on errors
5. Zero Trust: Verify explicitly, assume breach

## Control Categories
- Preventive: Stop attacks before they happen
- Detective: Identify attacks in progress
- Corrective: Respond to and recover from attacks
- Compensating: Alternative controls when primary isn't feasible

## Output Requirements
- Provide specific, implementable mitigations
- Include code-level and architecture-level controls
- Consider the technology stack when suggesting solutions
- Include verification steps to confirm the mitigation works`,
    userPromptTemplate: `Suggest specific mitigations for this security threat.

## Threat
**Title:** {{threatTitle}}
**Category:** {{category}}
**Description:** {{threatDescription}}

## System Context
{{context}}

Provide 2-4 specific, implementable mitigations.

Return as a JSON array:
\`\`\`json
[
  {
    "title": "Specific mitigation name",
    "description": "What this mitigation does and why it helps",
    "implementation": "Step-by-step implementation guidance",
    "controlType": "preventive|detective|corrective|compensating",
    "effort": "low|medium|high",
    "effectivenessScore": 0.0-1.0,
    "verification": "How to verify this mitigation works",
    "tradeoffs": "Any performance, usability, or cost impacts"
  }
]
\`\`\`

Only return the JSON array.`,
    variables: JSON.stringify([
      { name: 'threatTitle', displayName: 'Threat Title', type: 'text', required: true },
      { name: 'category', displayName: 'STRIDE Category', type: 'text', required: true },
      { name: 'threatDescription', displayName: 'Description', type: 'text', required: true },
      { name: 'context', displayName: 'System Context', type: 'text', required: false },
    ]),
    outputFormat: 'JSON',
    temperature: 0.3,
    maxTokens: 2000,
    requiresVision: false,
    tags: JSON.stringify(['mitigation', 'security-controls', 'remediation']),
    isBuiltIn: true,
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // GENERIC ARCHITECTURE EXTRACTION
  // ─────────────────────────────────────────────────────────────────────────────
  {
    id: 'builtin-architecture-extraction',
    name: 'Architecture Extraction',
    description: 'Extract system architecture from technical documentation',
    category: 'EXTRACTION',
    systemPrompt: `You are an expert software architect who extracts architectural information from technical documentation.

## Component Type Mapping
- webServer: Web applications, frontend servers
- api: REST APIs, GraphQL, backend services
- apiGateway: API gateways, load balancers with routing
- database: SQL, NoSQL, data warehouses
- cache: Redis, Memcached, CDN caches
- queue: Message queues, event buses, Kafka
- storage: Object storage, file systems
- authService: Identity providers, auth servers
- externalService: Third-party APIs, SaaS integrations
- client: Mobile apps, desktop apps, browsers
- actor: Users, admins, external systems
- service: Microservices, workers, background jobs
- loadBalancer: Load balancers, reverse proxies
- cdn: Content delivery networks
- firewall: WAF, network firewalls

## Data Classification
- pii: Personal Identifiable Information
- phi: Protected Health Information
- pci: Payment Card Industry data
- credentials: Passwords, API keys, tokens
- internal: Business data, non-public
- public: Public data

## Output Requirements
- Generate unique IDs for all components
- Set confidence scores based on how explicit the information is
- Include warnings for ambiguous information
- Ensure all IDs in dataFlows reference valid components`,
    userPromptTemplate: `Extract architectural information from this document.

## Document
{{documentText}}

## Task
1. Identify all system components mentioned or implied
2. Map data flows between components
3. Identify trust boundaries and network segments
4. List technologies and data classifications

Return as JSON:
\`\`\`json
{
  "components": [
    {
      "id": "unique-slug-id",
      "name": "Human readable name",
      "type": "webServer|api|database|cache|queue|storage|authService|externalService|client|actor|service",
      "description": "What this component does",
      "technology": "Specific technology if mentioned",
      "dataHandled": ["Types of data handled"],
      "confidence": 0.0-1.0,
      "sourceText": "Quote from document"
    }
  ],
  "dataFlows": [
    {
      "id": "unique-flow-id",
      "sourceId": "component-id",
      "targetId": "component-id",
      "label": "What data/requests flow",
      "protocol": "HTTP|HTTPS|gRPC|etc",
      "dataTypes": ["What data is transferred"],
      "encrypted": true|false,
      "confidence": 0.0-1.0
    }
  ],
  "boundaries": [
    {
      "id": "boundary-id",
      "name": "Boundary name",
      "type": "trust|network|vpc|organization",
      "componentIds": ["component-ids inside"],
      "confidence": 0.0-1.0
    }
  ],
  "technologies": ["List of technologies"],
  "dataTypes": ["pii", "phi", "pci", "credentials", "internal", "public"],
  "confidence": 0.0-1.0,
  "warnings": ["Ambiguities or missing information"]
}
\`\`\`

Only return the JSON object.`,
    variables: JSON.stringify([
      { name: 'documentText', displayName: 'Document Text', type: 'text', required: true },
    ]),
    outputFormat: 'JSON',
    temperature: 0.2,
    maxTokens: 4000,
    requiresVision: false,
    tags: JSON.stringify(['extraction', 'architecture', 'document-import']),
    isBuiltIn: true,
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // SRS EXTRACTION
  // ─────────────────────────────────────────────────────────────────────────────
  {
    id: 'builtin-srs-extraction',
    name: 'SRS Document Extraction',
    description: 'Extract architecture from Software Requirements Specification documents',
    category: 'EXTRACTION',
    systemPrompt: `You are an expert software architect who extracts system architecture from Software Requirements Specification (SRS) documents. You understand IEEE 830 format, functional requirements, and use case analysis.

## SRS Section Interpretation

### From Functional Requirements (FR)
- "The system shall..." → Implies a component
- Data processing requirements → Database or service
- User interaction requirements → Web/client interfaces
- Integration requirements → External services

### From Non-Functional Requirements (NFR)
- Security NFRs → Trust boundaries, encryption
- Performance NFRs → Caching, load balancers
- Compliance NFRs → Audit logging, data classification

### From Use Cases / User Stories
- Actors → Actor components
- Use case steps → Data flows
- Preconditions → Trust boundaries

## Component Type Mapping for SRS
- User roles/actors → actor
- "Web interface", "portal" → webServer
- "API", "backend service" → api
- "Database", "data store" → database
- "Login", "SSO", "authentication" → authService
- "Third-party", "external API" → externalService`,
    userPromptTemplate: `Extract system architecture from this SRS document.

## SRS Document
{{documentText}}

## Extraction Task
1. **Actors** - All user types and external systems
2. **Components** - System components implied by requirements
3. **Data Flows** - Interactions based on use cases
4. **Trust Boundaries** - Security zones from access requirements
5. **Security Requirements** - NFRs affecting threat model

Return as JSON:
\`\`\`json
{
  "components": [
    {
      "id": "unique-slug-id",
      "name": "Component name",
      "type": "webServer|api|database|cache|queue|storage|authService|externalService|client|actor|service",
      "description": "What this component does",
      "technology": "Technology if specified",
      "dataHandled": ["Data types handled"],
      "confidence": 0.0-1.0,
      "sourceText": "Requirement text",
      "derivedFrom": "FR-1|NFR-2|UC-3"
    }
  ],
  "dataFlows": [...],
  "boundaries": [...],
  "technologies": ["Technologies mentioned"],
  "dataTypes": ["pii", "credentials", etc.],
  "securityRequirements": [
    {
      "id": "nfr-id",
      "requirement": "NFR text",
      "category": "authentication|authorization|encryption|audit",
      "implication": "Threat model impact"
    }
  ],
  "confidence": 0.0-1.0,
  "warnings": ["Missing sections or concerns"]
}
\`\`\`

Only return the JSON object.`,
    variables: JSON.stringify([
      { name: 'documentText', displayName: 'SRS Document', type: 'text', required: true },
    ]),
    outputFormat: 'JSON',
    temperature: 0.2,
    maxTokens: 4000,
    requiresVision: false,
    tags: JSON.stringify(['extraction', 'srs', 'requirements', 'document-import']),
    isBuiltIn: true,
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // DIAGRAM EXTRACTION (VISION)
  // ─────────────────────────────────────────────────────────────────────────────
  {
    id: 'builtin-diagram-extraction',
    name: 'Diagram Extraction (Vision)',
    description: 'Extract architecture from diagram images using Vision AI',
    category: 'VISION',
    systemPrompt: `You are an expert at analyzing architecture diagrams and extracting structured information from visual representations.

## Diagram Types You Can Analyze
- Architecture diagrams
- Data flow diagrams (DFD)
- Network diagrams
- Sequence diagrams
- Deployment diagrams
- Component diagrams
- Whiteboard sketches

## Visual Element Recognition
- Boxes/rectangles → Components
- Cylinders → Databases
- Arrows/lines → Data flows
- Clouds → External services or cloud resources
- Stick figures → Actors/users
- Dashed lines → Trust boundaries
- Color coding → Often indicates environment or trust level

## Extraction Approach
1. Identify all visual elements (components)
2. Read labels and text
3. Trace connections between elements
4. Identify groupings (boundaries)
5. Infer component types from icons/shapes
6. Note any text annotations for context`,
    userPromptTemplate: `Analyze this architecture diagram and extract its components, connections, and boundaries.

## Task
1. Identify all components shown in the diagram
2. Extract data flows (arrows/connections)
3. Identify boundaries (grouping boxes, dashed lines)
4. Read all labels and annotations
5. Infer component types from visual representation

Return as JSON:
\`\`\`json
{
  "diagramType": "architecture|dfd|network|sequence|deployment|other",
  "components": [
    {
      "id": "unique-id",
      "name": "Label from diagram",
      "type": "webServer|api|database|cache|queue|storage|authService|externalService|client|actor|service",
      "description": "Inferred purpose",
      "technology": "Technology if labeled",
      "confidence": 0.0-1.0
    }
  ],
  "dataFlows": [
    {
      "id": "flow-id",
      "sourceId": "component-id",
      "targetId": "component-id",
      "label": "Arrow label if present",
      "protocol": "Protocol if labeled",
      "confidence": 0.0-1.0
    }
  ],
  "boundaries": [
    {
      "id": "boundary-id",
      "name": "Boundary label",
      "type": "trust|network|vpc|organization",
      "componentIds": ["enclosed component ids"],
      "confidence": 0.0-1.0
    }
  ],
  "confidence": 0.0-1.0,
  "warnings": ["Unclear elements or ambiguities"]
}
\`\`\`

Only return the JSON object.`,
    variables: JSON.stringify([]),
    outputFormat: 'JSON',
    temperature: 0.2,
    maxTokens: 4000,
    requiresVision: true,
    tags: JSON.stringify(['extraction', 'vision', 'diagram', 'image']),
    isBuiltIn: true,
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // QUICK SCAN (SIMPLE MODE)
  // ─────────────────────────────────────────────────────────────────────────────
  {
    id: 'builtin-quick-scan',
    name: 'Quick Scan',
    description: 'Fast, single-pass extraction for any document (Simple Mode)',
    category: 'EXTRACTION',
    systemPrompt: `You are a security architect performing a quick analysis of a document to extract architectural components for threat modeling. Be thorough but concise.`,
    userPromptTemplate: `Quickly extract architectural information from this document for threat modeling.

## Document
{{documentText}}

Extract:
1. System components (services, databases, UIs, etc.)
2. Data flows between components
3. Trust boundaries
4. Initial threats based on STRIDE
5. Suggested mitigations

Return as JSON:
\`\`\`json
{
  "components": [
    {
      "id": "unique-id",
      "name": "Component name",
      "type": "webServer|api|database|cache|queue|storage|authService|externalService|client|actor|service",
      "description": "Brief description"
    }
  ],
  "dataFlows": [
    {
      "id": "flow-id",
      "sourceId": "component-id",
      "targetId": "component-id",
      "label": "Data description"
    }
  ],
  "boundaries": [
    {
      "id": "boundary-id",
      "name": "Boundary name",
      "componentIds": ["component-ids"]
    }
  ],
  "suggestedThreats": [
    {
      "title": "Threat title",
      "category": "SPOOFING|TAMPERING|REPUDIATION|INFORMATION_DISCLOSURE|DENIAL_OF_SERVICE|ELEVATION_OF_PRIVILEGE",
      "severity": "HIGH|MEDIUM|LOW"
    }
  ],
  "warnings": ["Any concerns or missing info"]
}
\`\`\`

Only return the JSON object.`,
    variables: JSON.stringify([
      { name: 'documentText', displayName: 'Document', type: 'text', required: true },
    ]),
    outputFormat: 'JSON',
    temperature: 0.3,
    maxTokens: 3000,
    requiresVision: false,
    tags: JSON.stringify(['extraction', 'quick-scan', 'simple-mode']),
    isBuiltIn: true,
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // OPENAPI EXTRACTION
  // ─────────────────────────────────────────────────────────────────────────────
  {
    id: 'builtin-openapi-extraction',
    name: 'OpenAPI/Swagger Extraction',
    description: 'Extract architecture from OpenAPI/Swagger API specifications',
    category: 'EXTRACTION',
    systemPrompt: `You are a security architect analyzing OpenAPI/Swagger specifications to extract threat model components.

## OpenAPI Analysis
- Each path group = potential API component
- Security schemes = authentication mechanisms
- Components/schemas = data models and sensitivity
- External references = integrations`,
    userPromptTemplate: `Extract architecture from this OpenAPI specification for threat modeling.

## API Specification
{{documentText}}

Return as JSON:
\`\`\`json
{
  "components": [
    {
      "id": "unique-id",
      "name": "Component name",
      "type": "api|authService|database|storage|externalService|client",
      "description": "Component purpose",
      "technology": "Inferred technology",
      "endpoints": ["Key endpoints"]
    }
  ],
  "dataFlows": [...],
  "boundaries": [...],
  "authMechanisms": ["OAuth2", "API Key", etc.],
  "sensitiveData": [
    {
      "field": "Field path",
      "type": "pii|credentials|financial",
      "location": "Request body|Response|Header"
    }
  ],
  "apiThreats": [
    {
      "endpoint": "/path",
      "threat": "OWASP API issue",
      "severity": "HIGH|MEDIUM|LOW"
    }
  ],
  "confidence": 0.0-1.0,
  "warnings": ["Security concerns found"]
}
\`\`\`

Only return the JSON object.`,
    variables: JSON.stringify([
      { name: 'documentText', displayName: 'API Specification', type: 'text', required: true },
    ]),
    outputFormat: 'JSON',
    temperature: 0.2,
    maxTokens: 4000,
    requiresVision: false,
    tags: JSON.stringify(['extraction', 'openapi', 'swagger', 'api']),
    isBuiltIn: true,
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // TERRAFORM/IAC EXTRACTION
  // ─────────────────────────────────────────────────────────────────────────────
  {
    id: 'builtin-iac-extraction',
    name: 'Infrastructure as Code Extraction',
    description: 'Extract architecture from Terraform, CloudFormation, or Kubernetes configs',
    category: 'EXTRACTION',
    systemPrompt: `You are a cloud security architect analyzing Infrastructure as Code (IaC) configurations.

## IaC Analysis Focus
- Resources → Infrastructure components
- Security groups/rules → Network boundaries
- IAM roles/policies → Access control
- Encryption settings → Data protection
- Network topology → Trust boundaries`,
    userPromptTemplate: `Extract architecture from this Infrastructure as Code configuration.

## IaC Configuration
{{documentText}}

Return as JSON:
\`\`\`json
{
  "components": [
    {
      "id": "unique-id",
      "name": "Resource name",
      "type": "service|database|storage|loadBalancer|firewall|api|cache|queue",
      "description": "Resource purpose",
      "technology": "AWS/Azure/GCP service",
      "resourceType": "Original resource type"
    }
  ],
  "dataFlows": [...],
  "boundaries": [
    {
      "id": "boundary-id",
      "name": "VPC/Subnet name",
      "type": "network|vpc",
      "componentIds": ["resource ids"]
    }
  ],
  "securityGroups": [
    {
      "name": "SG name",
      "ingressRules": ["rule descriptions"],
      "egressRules": ["rule descriptions"],
      "concerns": ["Security issues"]
    }
  ],
  "misconfigurations": [
    {
      "resource": "Resource ID",
      "issue": "Security misconfiguration",
      "severity": "HIGH|MEDIUM|LOW",
      "recommendation": "Fix suggestion"
    }
  ],
  "confidence": 0.0-1.0,
  "warnings": ["Security concerns"]
}
\`\`\`

Only return the JSON object.`,
    variables: JSON.stringify([
      { name: 'documentText', displayName: 'IaC Configuration', type: 'text', required: true },
    ]),
    outputFormat: 'JSON',
    temperature: 0.2,
    maxTokens: 4000,
    requiresVision: false,
    tags: JSON.stringify(['extraction', 'terraform', 'cloudformation', 'kubernetes', 'iac']),
    isBuiltIn: true,
  },
];

// =============================================================================
// Built-in Document Type Configurations
// =============================================================================

interface DocumentTypeData {
  id: string;
  name: string;
  description: string;
  icon: string;
  detectionRules: string;
  detectionThreshold: number;
  priority: number;
  promptTemplateId: string;
  supportedFormats: string;
  isBuiltIn: boolean;
}

const BUILTIN_DOCUMENT_TYPES: DocumentTypeData[] = [
  {
    id: 'doctype-generic',
    name: 'Generic Document',
    description: 'Any technical document',
    icon: '📄',
    detectionRules: JSON.stringify([]),
    detectionThreshold: 0,
    priority: 0,
    promptTemplateId: 'builtin-architecture-extraction',
    supportedFormats: JSON.stringify(['pdf', 'docx', 'md', 'txt', 'html']),
    isBuiltIn: true,
  },
  {
    id: 'doctype-srs',
    name: 'Software Requirements Specification',
    description: 'SRS documents (IEEE 830 format)',
    icon: '📋',
    detectionRules: JSON.stringify([
      { type: 'keyword', value: 'software requirements specification', weight: 40 },
      { type: 'keyword', value: 'functional requirements', weight: 30 },
      { type: 'keyword', value: 'non-functional requirements', weight: 25 },
      { type: 'keyword', value: 'use case', weight: 20 },
      { type: 'keyword', value: 'the system shall', weight: 25 },
      { type: 'keyword', value: 'ieee 830', weight: 50 },
      { type: 'keyword', value: 'acceptance criteria', weight: 20 },
    ]),
    detectionThreshold: 60,
    priority: 80,
    promptTemplateId: 'builtin-srs-extraction',
    supportedFormats: JSON.stringify(['pdf', 'docx', 'md', 'txt']),
    isBuiltIn: true,
  },
  {
    id: 'doctype-openapi',
    name: 'OpenAPI/Swagger Specification',
    description: 'API specifications in OpenAPI or Swagger format',
    icon: '🔌',
    detectionRules: JSON.stringify([
      { type: 'keyword', value: 'openapi:', weight: 50 },
      { type: 'keyword', value: 'swagger:', weight: 50 },
      { type: 'keyword', value: '"openapi"', weight: 50 },
      { type: 'keyword', value: 'paths:', weight: 30 },
      { type: 'keyword', value: 'components:', weight: 25 },
      { type: 'keyword', value: 'schemas:', weight: 20 },
      { type: 'keyword', value: 'securitySchemes', weight: 30 },
    ]),
    detectionThreshold: 60,
    priority: 90,
    promptTemplateId: 'builtin-openapi-extraction',
    supportedFormats: JSON.stringify(['yaml', 'yml', 'json']),
    isBuiltIn: true,
  },
  {
    id: 'doctype-terraform',
    name: 'Terraform Configuration',
    description: 'Terraform infrastructure as code',
    icon: '🏗️',
    detectionRules: JSON.stringify([
      { type: 'keyword', value: 'resource "', weight: 40 },
      { type: 'keyword', value: 'provider "', weight: 30 },
      { type: 'keyword', value: 'terraform {', weight: 50 },
      { type: 'keyword', value: 'aws_', weight: 25 },
      { type: 'keyword', value: 'azurerm_', weight: 25 },
      { type: 'keyword', value: 'google_', weight: 25 },
      { type: 'keyword', value: 'module "', weight: 30 },
    ]),
    detectionThreshold: 60,
    priority: 85,
    promptTemplateId: 'builtin-iac-extraction',
    supportedFormats: JSON.stringify(['tf', 'hcl', 'txt']),
    isBuiltIn: true,
  },
  {
    id: 'doctype-cloudformation',
    name: 'CloudFormation Template',
    description: 'AWS CloudFormation templates',
    icon: '☁️',
    detectionRules: JSON.stringify([
      { type: 'keyword', value: 'AWSTemplateFormatVersion', weight: 60 },
      { type: 'keyword', value: 'Resources:', weight: 30 },
      { type: 'keyword', value: 'AWS::', weight: 40 },
      { type: 'keyword', value: '!Ref', weight: 25 },
      { type: 'keyword', value: '!Sub', weight: 25 },
    ]),
    detectionThreshold: 60,
    priority: 85,
    promptTemplateId: 'builtin-iac-extraction',
    supportedFormats: JSON.stringify(['yaml', 'yml', 'json']),
    isBuiltIn: true,
  },
  {
    id: 'doctype-architecture',
    name: 'Architecture Document',
    description: 'System design and architecture documents',
    icon: '📐',
    detectionRules: JSON.stringify([
      { type: 'keyword', value: 'architecture', weight: 30 },
      { type: 'keyword', value: 'system design', weight: 35 },
      { type: 'keyword', value: 'component diagram', weight: 30 },
      { type: 'keyword', value: 'microservice', weight: 25 },
      { type: 'keyword', value: 'high-level design', weight: 35 },
      { type: 'keyword', value: 'technical design', weight: 30 },
    ]),
    detectionThreshold: 50,
    priority: 70,
    promptTemplateId: 'builtin-architecture-extraction',
    supportedFormats: JSON.stringify(['pdf', 'docx', 'md', 'txt']),
    isBuiltIn: true,
  },
];

// =============================================================================
// Seed Function
// =============================================================================

export async function seedPrompts() {
  console.log('Seeding built-in prompt templates...');

  const prisma = await getPrisma();

  for (const prompt of BUILTIN_PROMPTS) {
    await prisma.promptTemplate.upsert({
      where: { id: prompt.id },
      update: {
        name: prompt.name,
        description: prompt.description,
        category: prompt.category,
        systemPrompt: prompt.systemPrompt,
        userPromptTemplate: prompt.userPromptTemplate,
        variables: prompt.variables,
        outputFormat: prompt.outputFormat,
        outputSchema: prompt.outputSchema,
        temperature: prompt.temperature,
        maxTokens: prompt.maxTokens,
        requiresVision: prompt.requiresVision,
        tags: prompt.tags,
        isBuiltIn: prompt.isBuiltIn,
      },
      create: {
        id: prompt.id,
        name: prompt.name,
        description: prompt.description,
        category: prompt.category,
        systemPrompt: prompt.systemPrompt,
        userPromptTemplate: prompt.userPromptTemplate,
        variables: prompt.variables,
        outputFormat: prompt.outputFormat,
        outputSchema: prompt.outputSchema,
        temperature: prompt.temperature,
        maxTokens: prompt.maxTokens,
        requiresVision: prompt.requiresVision,
        tags: prompt.tags,
        isBuiltIn: prompt.isBuiltIn,
        organizationId: null,
      },
    });
    console.log(`  ✓ ${prompt.name}`);
  }

  console.log('\nSeeding built-in document type configurations...');

  for (const docType of BUILTIN_DOCUMENT_TYPES) {
    await prisma.documentTypeConfig.upsert({
      where: { id: docType.id },
      update: {
        name: docType.name,
        description: docType.description,
        icon: docType.icon,
        detectionRules: docType.detectionRules,
        detectionThreshold: docType.detectionThreshold,
        priority: docType.priority,
        promptTemplateId: docType.promptTemplateId,
        supportedFormats: docType.supportedFormats,
        isBuiltIn: docType.isBuiltIn,
      },
      create: {
        id: docType.id,
        name: docType.name,
        description: docType.description,
        icon: docType.icon,
        detectionRules: docType.detectionRules,
        detectionThreshold: docType.detectionThreshold,
        priority: docType.priority,
        promptTemplateId: docType.promptTemplateId,
        supportedFormats: docType.supportedFormats,
        isBuiltIn: docType.isBuiltIn,
        organizationId: null,
      },
    });
    console.log(`  ✓ ${docType.name}`);
  }

  console.log('\n✅ Prompt seeding complete!');
}

// Run if called directly
if (require.main === module) {
  seedPrompts()
    .then(() => {
      console.log('\nDone!');
      process.exit(0);
    })
    .catch((e) => {
      console.error('Seed failed:', e);
      process.exit(1);
    });
}

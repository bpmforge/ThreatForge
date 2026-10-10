/**
 * Component Defaults
 *
 * Default descriptions and security guidance per component type.
 * Used when:
 * 1. Users drag components onto the canvas from scratch (early maturity)
 * 2. AI extraction returns a component without description
 * 3. Populating aiNotes with security considerations per type
 *
 * These are GUIDANCE, not filler — they tell the user what to think about.
 */

interface ComponentDefault {
  description: string;
  aiNotes: string;
  defaultAccessPattern: string;
  defaultDataClassification: string;
}

const COMPONENT_DEFAULTS: Record<string, ComponentDefault> = {
  DATABASE: {
    description: "Data storage component",
    aiNotes:
      "Security considerations: encryption at rest (AES-256), access control (least privilege, no shared accounts), backup/recovery strategy, query parameterization (prevent injection), audit logging of data access, data retention policy.\n\nSpecify: what data is stored, sensitivity level (PII/PHI/PCI), encryption method, access control model, backup frequency.",
    defaultAccessPattern: "INTERNAL_ONLY",
    defaultDataClassification: "CONFIDENTIAL",
  },
  API: {
    description: "API endpoint",
    aiNotes:
      "Security considerations: authentication method (JWT/OAuth2/API key), authorization (RBAC/ABAC), input validation (schema enforcement), rate limiting, output filtering (no sensitive data leakage), API versioning, CORS policy.\n\nSpecify: auth method, rate limits, exposed data types, consumer identity.",
    defaultAccessPattern: "AUTHENTICATED_USERS",
    defaultDataClassification: "INTERNAL",
  },
  API_GATEWAY: {
    description: "API entry point and traffic manager",
    aiNotes:
      "Security considerations: TLS termination (min TLS 1.2, prefer 1.3), authentication (mTLS for services, JWT/API key for clients), rate limiting per client, request size limits, WAF integration, logging of all requests.\n\nSpecify: TLS version, auth method, rate limits per client type, allowed origins.",
    defaultAccessPattern: "PUBLIC_INTERNET",
    defaultDataClassification: "INTERNAL",
  },
  CACHE: {
    description: "In-memory data cache",
    aiNotes:
      "Security considerations: authentication (Redis AUTH / Memcached SASL), encryption in transit (TLS), no sensitive data in cache keys, TTL policy (prevent stale data), eviction strategy, memory limits (prevent DoS).\n\nSpecify: what data is cached, TTL, auth method, max memory, encryption.",
    defaultAccessPattern: "INTERNAL_ONLY",
    defaultDataClassification: "INTERNAL",
  },
  QUEUE: {
    description: "Message broker / event bus",
    aiNotes:
      "Security considerations: producer/consumer authentication (mTLS/SASL), message encryption, topic-level ACLs, message signing (integrity), dead letter queues, retention policy, consumer group isolation.\n\nSpecify: topics, auth per producer/consumer, message format, retention.",
    defaultAccessPattern: "INTERNAL_ONLY",
    defaultDataClassification: "INTERNAL",
  },
  SERVICE: {
    description: "Internal service / microservice",
    aiNotes:
      "Security considerations: service-to-service auth (mTLS/JWT), input validation, error handling (no stack traces), dependency management (SBOM), health checks, resource limits.\n\nSpecify: purpose, data it processes, upstream/downstream dependencies, auth method.",
    defaultAccessPattern: "INTERNAL_ONLY",
    defaultDataClassification: "INTERNAL",
  },
  EXTERNAL_USER: {
    description: "External user or actor",
    aiNotes:
      "Security considerations: this is an UNTRUSTED entity. All input must be validated. Authentication required before any access. Consider: credential management, session handling, MFA, account lockout.\n\nSpecify: user type, authentication method, access level, trust assumptions.",
    defaultAccessPattern: "PUBLIC_INTERNET",
    defaultDataClassification: "PUBLIC",
  },
  EXTERNAL_SYSTEM: {
    description: "Third-party system or integration",
    aiNotes:
      "Security considerations: this is an UNTRUSTED external dependency. Verify: data sharing agreement, auth method (API key/OAuth/mTLS), SLA/availability, fallback if unavailable, data minimization (share only needed data), certificate pinning.\n\nSpecify: provider, data shared, auth method, SLA, fallback strategy.",
    defaultAccessPattern: "PARTNER_API",
    defaultDataClassification: "INTERNAL",
  },
  LOAD_BALANCER: {
    description: "Load balancer / reverse proxy",
    aiNotes:
      "Security considerations: TLS termination, health check security, DDoS protection, session affinity (if stateful), access logging, X-Forwarded-For header trust, backend connection encryption.\n\nSpecify: TLS config, routing rules, health check endpoints, DDoS mitigation.",
    defaultAccessPattern: "PUBLIC_INTERNET",
    defaultDataClassification: "PUBLIC",
  },
  FIREWALL: {
    description: "Network firewall / WAF",
    aiNotes:
      "Security considerations: rule management (least privilege), logging of blocked traffic, regular rule review, bypass detection, failover mode (fail-closed vs fail-open), update cadence.\n\nSpecify: rule set, default action, logging policy, update schedule.",
    defaultAccessPattern: "PUBLIC_INTERNET",
    defaultDataClassification: "PUBLIC",
  },
  FILE_STORAGE: {
    description: "File / object storage",
    aiNotes:
      "Security considerations: access control (bucket policies, IAM), encryption at rest, public access prevention, versioning, lifecycle policy, access logging, CORS for web access.\n\nSpecify: data stored, access model, encryption, retention, public/private.",
    defaultAccessPattern: "INTERNAL_ONLY",
    defaultDataClassification: "CONFIDENTIAL",
  },
  FUNCTION: {
    description: "Serverless function / Lambda",
    aiNotes:
      "Security considerations: IAM role (least privilege), environment variable secrets, cold start latency, execution timeout, VPC placement, dependency vulnerabilities, event injection.\n\nSpecify: trigger source, IAM permissions, environment variables, VPC config.",
    defaultAccessPattern: "INTERNAL_ONLY",
    defaultDataClassification: "INTERNAL",
  },
  PROCESS: {
    description: "Processing component",
    aiNotes:
      "Security considerations: input validation, error handling, resource limits, logging, dependency management.\n\nSpecify: what it processes, input/output format, dependencies.",
    defaultAccessPattern: "INTERNAL_ONLY",
    defaultDataClassification: "INTERNAL",
  },
};

/**
 * Get default description for a component type.
 * Used when no description is provided (manual diagramming or sparse extraction).
 */
export function getDefaultDescription(type: string): string {
  return COMPONENT_DEFAULTS[type]?.description || "Component";
}

/**
 * Get AI-generated security notes for a component type.
 * Populated into aiNotes to guide users on what to consider.
 */
export function getDefaultAINotes(type: string): string {
  return COMPONENT_DEFAULTS[type]?.aiNotes || "";
}

/**
 * Get default security context for a component type.
 * Used when creating components from scratch (no extraction data).
 */
export function getDefaultSecurityContext(type: string): {
  dataClassification: string;
  accessPattern: string;
} {
  const defaults = COMPONENT_DEFAULTS[type];
  return {
    dataClassification: defaults?.defaultDataClassification || "INTERNAL",
    accessPattern: defaults?.defaultAccessPattern || "INTERNAL_ONLY",
  };
}

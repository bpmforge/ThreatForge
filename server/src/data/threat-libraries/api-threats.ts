/**
 * API Security Threat Library
 *
 * Threats specific to APIs (REST, GraphQL, gRPC).
 */

import type { ThreatTemplate } from "./cloud-threats.js";

const API_THREATS: ThreatTemplate[] = [
  // Authentication & Authorization
  {
    name: "Broken Object Level Authorization (BOLA)",
    description:
      "API allows access to objects belonging to other users by manipulating object IDs in requests.",
    strideCategory: "INFORMATION_DISCLOSURE",
    defaultSeverity: "HIGH",
    applicableComponentTypes: ["api", "rest-api", "graphql", "service"],
    suggestedMitigations: [
      "Implement object-level access control checks",
      "Use non-sequential/random IDs (UUIDs)",
      "Validate user ownership on every request",
      "Log and monitor unauthorized access attempts",
    ],
    complianceControls: {
      SOC2: ["CC6.1"],
      NIST_CSF: ["PR.AC-4"],
      ISO27001: ["A.8.3"],
    },
    cweIds: ["CWE-639", "CWE-284"],
    owaspIds: ["API1:2023"],
  },
  {
    name: "Broken Authentication",
    description:
      "API authentication mechanisms are weak or bypassable, allowing unauthorized access.",
    strideCategory: "SPOOFING",
    defaultSeverity: "CRITICAL",
    applicableComponentTypes: ["api", "auth-service", "gateway"],
    suggestedMitigations: [
      "Implement strong password policies",
      "Use industry-standard auth (OAuth 2.0, OpenID Connect)",
      "Implement rate limiting on auth endpoints",
      "Enable MFA for sensitive operations",
      "Use secure token storage and transmission",
    ],
    complianceControls: {
      SOC2: ["CC6.1", "CC6.2"],
      NIST_CSF: ["PR.AC-1"],
      ISO27001: ["A.8.5"],
    },
    cweIds: ["CWE-287", "CWE-306"],
    owaspIds: ["API2:2023"],
  },
  {
    name: "Broken Object Property Level Authorization",
    description:
      "API exposes or accepts object properties that should be restricted based on user role.",
    strideCategory: "INFORMATION_DISCLOSURE",
    defaultSeverity: "MEDIUM",
    applicableComponentTypes: ["api", "rest-api", "graphql"],
    suggestedMitigations: [
      "Implement property-level access control",
      "Use DTOs to filter response properties",
      "Validate allowed properties on input",
      "Avoid mass assignment vulnerabilities",
    ],
    complianceControls: {
      SOC2: ["CC6.1"],
      NIST_CSF: ["PR.AC-4"],
    },
    cweIds: ["CWE-213", "CWE-915"],
    owaspIds: ["API3:2023"],
  },
  {
    name: "Unrestricted Resource Consumption",
    description:
      "API lacks limits on resource consumption allowing denial of service through resource exhaustion.",
    strideCategory: "DENIAL_OF_SERVICE",
    defaultSeverity: "MEDIUM",
    applicableComponentTypes: ["api", "gateway", "service"],
    suggestedMitigations: [
      "Implement rate limiting per user/IP",
      "Set request size limits",
      "Limit query complexity (GraphQL)",
      "Set pagination limits",
      "Implement timeout policies",
    ],
    complianceControls: {
      SOC2: ["CC7.3"],
      NIST_CSF: ["RS.MI-1"],
    },
    cweIds: ["CWE-770", "CWE-400"],
    owaspIds: ["API4:2023"],
  },
  {
    name: "Broken Function Level Authorization",
    description:
      "API fails to properly restrict access to admin or privileged functions.",
    strideCategory: "ELEVATION_OF_PRIVILEGE",
    defaultSeverity: "HIGH",
    applicableComponentTypes: ["api", "admin-api", "service"],
    suggestedMitigations: [
      "Implement role-based access control",
      "Deny by default, allow explicitly",
      "Separate admin endpoints from user endpoints",
      "Audit access to privileged functions",
    ],
    complianceControls: {
      SOC2: ["CC6.1"],
      NIST_CSF: ["PR.AC-4"],
      ISO27001: ["A.8.2"],
    },
    cweIds: ["CWE-285", "CWE-269"],
    owaspIds: ["API5:2023"],
  },
  {
    name: "Server-Side Request Forgery (SSRF)",
    description:
      "API accepts URLs or addresses that allow server to make requests to internal resources.",
    strideCategory: "INFORMATION_DISCLOSURE",
    defaultSeverity: "HIGH",
    applicableComponentTypes: ["api", "service", "webhook"],
    suggestedMitigations: [
      "Validate and sanitize URL inputs",
      "Implement allowlist of permitted domains",
      "Block internal IP ranges",
      "Use DNS rebinding protection",
      "Disable URL redirection following",
    ],
    complianceControls: {
      SOC2: ["CC6.1"],
      NIST_CSF: ["PR.IP-1"],
      ISO27001: ["A.8.28"],
    },
    cweIds: ["CWE-918"],
    owaspIds: ["API6:2023"],
  },
  {
    name: "Security Misconfiguration",
    description:
      "API is deployed with insecure defaults, missing security headers, or verbose error messages.",
    strideCategory: "INFORMATION_DISCLOSURE",
    defaultSeverity: "MEDIUM",
    applicableComponentTypes: ["api", "gateway", "service"],
    suggestedMitigations: [
      "Implement security headers (CORS, CSP)",
      "Disable stack traces in production",
      "Use secure TLS configuration",
      "Remove unnecessary HTTP methods",
      "Implement proper error handling",
    ],
    complianceControls: {
      SOC2: ["CC6.6", "CC6.7"],
      NIST_CSF: ["PR.IP-1"],
      ISO27001: ["A.8.9"],
    },
    cweIds: ["CWE-16", "CWE-209"],
    owaspIds: ["API7:2023"],
  },
  {
    name: "Lack of Protection from Automated Threats",
    description:
      "API is vulnerable to automated attacks like credential stuffing, scraping, or fraud.",
    strideCategory: "TAMPERING",
    defaultSeverity: "MEDIUM",
    applicableComponentTypes: ["api", "auth-service", "gateway"],
    suggestedMitigations: [
      "Implement CAPTCHA or proof-of-work",
      "Use bot detection services",
      "Implement rate limiting and throttling",
      "Monitor for automated attack patterns",
      "Use device fingerprinting",
    ],
    complianceControls: {
      SOC2: ["CC6.8"],
      NIST_CSF: ["DE.CM-7"],
    },
    cweIds: ["CWE-799", "CWE-307"],
    owaspIds: ["API8:2023"],
  },
  {
    name: "Improper Inventory Management",
    description:
      "Outdated or undocumented API versions remain exposed and vulnerable.",
    strideCategory: "INFORMATION_DISCLOSURE",
    defaultSeverity: "MEDIUM",
    applicableComponentTypes: ["api", "gateway", "service"],
    suggestedMitigations: [
      "Maintain API inventory and documentation",
      "Implement API versioning strategy",
      "Deprecate and retire old API versions",
      "Use API gateway for version management",
      "Scan for shadow/zombie APIs",
    ],
    complianceControls: {
      SOC2: ["CC3.1"],
      NIST_CSF: ["ID.AM-2"],
      ISO27001: ["A.8.25"],
    },
    cweIds: ["CWE-1059"],
    owaspIds: ["API9:2023"],
  },
  {
    name: "Unsafe Consumption of APIs",
    description:
      "Application trusts data from third-party APIs without proper validation.",
    strideCategory: "TAMPERING",
    defaultSeverity: "MEDIUM",
    applicableComponentTypes: ["api", "integration", "service"],
    suggestedMitigations: [
      "Validate all third-party API responses",
      "Implement input sanitization",
      "Use timeouts for external calls",
      "Handle API failures gracefully",
      "Verify TLS certificates of third parties",
    ],
    complianceControls: {
      SOC2: ["CC9.2"],
      NIST_CSF: ["ID.RA-1"],
    },
    cweIds: ["CWE-20"],
    owaspIds: ["API10:2023"],
  },

  // GraphQL Specific
  {
    name: "GraphQL Introspection Exposure",
    description:
      "GraphQL introspection query exposes full schema including sensitive types and fields.",
    strideCategory: "INFORMATION_DISCLOSURE",
    defaultSeverity: "MEDIUM",
    applicableComponentTypes: ["graphql", "api"],
    suggestedMitigations: [
      "Disable introspection in production",
      "Use field-level authorization",
      "Implement query allowlisting",
      "Monitor for introspection attempts",
    ],
    complianceControls: {
      SOC2: ["CC6.1"],
      NIST_CSF: ["PR.DS-5"],
    },
    cweIds: ["CWE-200"],
    owaspIds: [],
  },
  {
    name: "GraphQL Query Complexity Attack",
    description:
      "Deeply nested or complex GraphQL queries exhaust server resources.",
    strideCategory: "DENIAL_OF_SERVICE",
    defaultSeverity: "MEDIUM",
    applicableComponentTypes: ["graphql", "api"],
    suggestedMitigations: [
      "Implement query depth limiting",
      "Set query complexity limits",
      "Use query cost analysis",
      "Implement pagination with limits",
      "Set timeout for query execution",
    ],
    complianceControls: {
      SOC2: ["CC7.3"],
      NIST_CSF: ["RS.MI-1"],
    },
    cweIds: ["CWE-400", "CWE-770"],
    owaspIds: [],
  },
  {
    name: "GraphQL Batching Attack",
    description:
      "Attacker sends multiple operations in single request to bypass rate limiting or enumerate data.",
    strideCategory: "TAMPERING",
    defaultSeverity: "MEDIUM",
    applicableComponentTypes: ["graphql", "api"],
    suggestedMitigations: [
      "Limit operations per request",
      "Apply rate limiting per operation",
      "Disable query batching if not needed",
      "Monitor for batching abuse",
    ],
    complianceControls: {
      SOC2: ["CC6.1"],
    },
    cweIds: ["CWE-799"],
    owaspIds: [],
  },

  // gRPC Specific
  {
    name: "gRPC Reflection Exposure",
    description:
      "gRPC server reflection is enabled allowing attackers to discover available services and methods.",
    strideCategory: "INFORMATION_DISCLOSURE",
    defaultSeverity: "LOW",
    applicableComponentTypes: ["grpc", "api"],
    suggestedMitigations: [
      "Disable reflection in production",
      "Restrict access to reflection service",
      "Use mTLS for service authentication",
    ],
    complianceControls: {
      SOC2: ["CC6.1"],
    },
    cweIds: ["CWE-200"],
    owaspIds: [],
  },
  {
    name: "gRPC Message Size Attack",
    description: "Oversized gRPC messages exhaust server memory or bandwidth.",
    strideCategory: "DENIAL_OF_SERVICE",
    defaultSeverity: "MEDIUM",
    applicableComponentTypes: ["grpc", "api"],
    suggestedMitigations: [
      "Set maximum message size limits",
      "Implement streaming for large payloads",
      "Use connection pooling",
      "Monitor message sizes",
    ],
    complianceControls: {
      SOC2: ["CC7.3"],
    },
    cweIds: ["CWE-400"],
    owaspIds: [],
  },

  // Webhook Security
  {
    name: "Webhook Forgery",
    description:
      "Attacker sends forged webhook requests to trigger unauthorized actions.",
    strideCategory: "SPOOFING",
    defaultSeverity: "HIGH",
    applicableComponentTypes: ["webhook", "api", "integration"],
    suggestedMitigations: [
      "Implement webhook signature verification",
      "Use shared secrets for HMAC",
      "Validate source IP addresses",
      "Implement replay attack protection",
    ],
    complianceControls: {
      SOC2: ["CC6.1"],
      NIST_CSF: ["PR.AC-1"],
    },
    cweIds: ["CWE-345", "CWE-346"],
    owaspIds: [],
  },
  {
    name: "Webhook Data Leakage",
    description:
      "Sensitive data included in webhook payloads is exposed to external receivers.",
    strideCategory: "INFORMATION_DISCLOSURE",
    defaultSeverity: "MEDIUM",
    applicableComponentTypes: ["webhook", "api"],
    suggestedMitigations: [
      "Minimize data in webhook payloads",
      "Use TLS for webhook delivery",
      "Encrypt sensitive payload fields",
      "Validate webhook receiver endpoints",
    ],
    complianceControls: {
      SOC2: ["CC6.7"],
      NIST_CSF: ["PR.DS-2"],
    },
    cweIds: ["CWE-200"],
    owaspIds: [],
  },
];

export const API_LIBRARY = {
  name: "API Security Threats",
  description:
    "Threat templates for API security including REST, GraphQL, gRPC, and webhooks. Based on OWASP API Security Top 10 2023.",
  templates: API_THREATS,
};

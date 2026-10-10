/**
 * Threat templates for component-based suggestions.
 */
import type { ThreatSuggestion } from "../types";

export const THREAT_TEMPLATES: ThreatSuggestion[] = [
  {
    id: "sql-injection",
    name: "SQL Injection",
    description:
      "Improper handling of user input in database queries can allow attackers to execute malicious SQL commands.",
    severity: "HIGH",
    strideCategory: "TAMPERING",
    applicableTypes: [
      "DATABASE",
      "AWS_RDS",
      "AWS_DYNAMODB",
      "AWS_AURORA",
      "AZURE_SQL",
      "GCP_CLOUDSQL",
    ],
    mitigation: "Use parameterized queries and prepared statements.",
  },
  {
    id: "xss",
    name: "Cross-Site Scripting (XSS)",
    description:
      "Unsanitized user input displayed on web pages can allow attackers to inject malicious scripts.",
    severity: "HIGH",
    strideCategory: "TAMPERING",
    applicableTypes: ["WEB_APP", "MOBILE_APP"],
    mitigation:
      "Sanitize all user input and use Content Security Policy headers.",
  },
  {
    id: "csrf",
    name: "Cross-Site Request Forgery (CSRF)",
    description:
      "Attackers can trick users into performing actions they did not intend to perform.",
    severity: "MEDIUM",
    strideCategory: "SPOOFING",
    applicableTypes: ["WEB_APP"],
    mitigation: "Use anti-CSRF tokens and validate request origins.",
  },
  {
    id: "broken-auth",
    name: "Broken Authentication",
    description:
      "Flaws in authentication mechanisms can allow attackers to compromise passwords, keys, or session tokens.",
    severity: "CRITICAL",
    strideCategory: "SPOOFING",
    applicableTypes: [
      "AUTH_SERVICE",
      "IAM",
      "AWS_COGNITO",
      "AZURE_AD",
      "GCP_IDENTITY_PLATFORM",
    ],
    mitigation:
      "Implement multi-factor authentication and secure session management.",
  },
  {
    id: "idor",
    name: "Insecure Direct Object Reference",
    description:
      "Direct references to internal objects can be manipulated by attackers to access unauthorized data.",
    severity: "HIGH",
    strideCategory: "INFORMATION_DISCLOSURE",
    applicableTypes: ["API", "WEB_APP", "MICROSERVICE"],
    mitigation:
      "Use indirect references and validate user permissions for every request.",
  },
  {
    id: "sensitive-data",
    name: "Sensitive Data Exposure",
    description:
      "Unprotected sensitive data can be accessed by unauthorized parties.",
    severity: "HIGH",
    strideCategory: "INFORMATION_DISCLOSURE",
    applicableTypes: [
      "DATA_STORE",
      "DATABASE",
      "AWS_S3",
      "AZURE_BLOB",
      "GCP_STORAGE",
    ],
    mitigation: "Encrypt data at rest and in transit, classify sensitive data.",
  },
  {
    id: "rate-limiting",
    name: "Missing Rate Limiting",
    description:
      "Lack of rate limiting can make systems vulnerable to abuse and denial-of-service attacks.",
    severity: "MEDIUM",
    strideCategory: "DENIAL_OF_SERVICE",
    applicableTypes: [
      "API",
      "API_GATEWAY",
      "AWS_API_GATEWAY",
      "AZURE_APP_GATEWAY",
      "GCP_LOAD_BALANCING",
    ],
    mitigation: "Implement rate limiting per user/IP with exponential backoff.",
  },
  {
    id: "logging",
    name: "Insufficient Logging",
    description:
      "Inadequate logging can prevent detection and investigation of security incidents.",
    severity: "LOW",
    strideCategory: "REPUDIATION",
    applicableTypes: ["WEB_APP", "API", "MICROSERVICE", "DATABASE"],
    mitigation: "Log all security-relevant events with tamper-evident storage.",
  },
  {
    id: "mitm",
    name: "Man-in-the-Middle Attack",
    description:
      "Interception of communication between parties can allow attackers to eavesdrop or modify data.",
    severity: "HIGH",
    strideCategory: "INFORMATION_DISCLOSURE",
    applicableTypes: [
      "LOAD_BALANCER",
      "CDN",
      "AWS_CLOUDFRONT",
      "AZURE_CDN",
      "GCP_CLOUD_CDN",
    ],
    mitigation: "Use TLS 1.3+, HSTS, and certificate pinning.",
  },
  {
    id: "insecure-transport",
    name: "Insecure Transport",
    description:
      "Data transmitted without encryption can be intercepted and read by attackers.",
    severity: "HIGH",
    strideCategory: "INFORMATION_DISCLOSURE",
    applicableTypes: ["WEB_APP", "API", "DATABASE", "DATA_STORE"],
    mitigation: "Enforce TLS for all connections and disable legacy protocols.",
  },
  {
    id: "privilege-escalation",
    name: "Privilege Escalation",
    description:
      "Flaws in access control can allow attackers to gain higher privileges than intended.",
    severity: "HIGH",
    strideCategory: "ELEVATION_OF_PRIVILEGE",
    applicableTypes: [
      "AUTH_SERVICE",
      "IAM",
      "PROCESS",
      "SERVER",
      "KUBERNETES",
      "AWS_IAM",
    ],
    mitigation:
      "Implement least privilege, regular access reviews, and role separation.",
  },
  {
    id: "weak-cryptography",
    name: "Weak Cryptography",
    description:
      "Use of weak or outdated cryptographic algorithms can make data vulnerable to attacks.",
    severity: "HIGH",
    strideCategory: "INFORMATION_DISCLOSURE",
    applicableTypes: [
      "DATABASE",
      "DATA_STORE",
      "ENCRYPTION",
      "AWS_KMS",
      "AZURE_KEY_VAULT",
      "GCP_KMS",
    ],
    mitigation: "Use modern algorithms (AES-256, SHA-256+, RSA-2048+).",
  },
  {
    id: "container-escape",
    name: "Container Escape",
    description:
      "Vulnerabilities in container isolation can allow attackers to break out to the host system.",
    severity: "CRITICAL",
    strideCategory: "ELEVATION_OF_PRIVILEGE",
    applicableTypes: [
      "CONTAINER",
      "KUBERNETES",
      "AWS_ECS",
      "AWS_EKS",
      "AZURE_AKS",
      "GCP_GKE",
    ],
    mitigation:
      "Use rootless containers, seccomp profiles, and regular image updates.",
  },
  {
    id: "secret-exposure",
    name: "Secret Exposure",
    description:
      "Hardcoded secrets or misconfigured secret storage can expose sensitive credentials.",
    severity: "CRITICAL",
    strideCategory: "INFORMATION_DISCLOSURE",
    applicableTypes: [
      "SECRETS_MANAGER",
      "AWS_SECRETS_MANAGER",
      "AZURE_KEY_VAULT",
      "GCP_SECRET_MANAGER",
    ],
    mitigation:
      "Use secret management services and rotate credentials regularly.",
  },
  {
    id: "ddos",
    name: "Distributed Denial of Service",
    description:
      "Large-scale attacks can overwhelm services and make them unavailable.",
    severity: "HIGH",
    strideCategory: "DENIAL_OF_SERVICE",
    applicableTypes: [
      "LOAD_BALANCER",
      "CDN",
      "WAF",
      "AWS_SHIELD",
      "AZURE_DDOS_PROTECTION",
      "GCP_CLOUD_ARMOR",
    ],
    mitigation:
      "Implement WAF rules, DDoS protection services, and auto-scaling.",
  },
];

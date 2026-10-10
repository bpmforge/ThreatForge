import type { ThreatSuggestion } from "../types";
import type { ComponentType } from "@/types/canvas";

type ThreatsByType = Partial<Record<ComponentType, ThreatSuggestion[]>>;

const COMMON_THREATS_BY_TYPE: ThreatsByType = {
  DATABASE: [
    {
      id: "db-sql-injection",
      title: "SQL Injection",
      description:
        "Attackers inject malicious SQL through user inputs to access, modify, or delete database contents.",
      strideCategory: "tampering",
      severity: "critical",
      confidence: 0.95,
      mitigations: [
        "Use parameterized queries/prepared statements",
        "Input validation and sanitization",
        "Least privilege database accounts",
      ],
    },
    {
      id: "db-data-breach",
      title: "Data Breach via Unauthorized Access",
      description:
        "Sensitive data exposed through compromised credentials or misconfigured access controls.",
      strideCategory: "informationDisclosure",
      severity: "critical",
      confidence: 0.9,
      mitigations: [
        "Encrypt sensitive data at rest",
        "Implement field-level encryption",
        "Regular access reviews",
      ],
    },
    {
      id: "db-backup-exposure",
      title: "Backup Data Exposure",
      description:
        "Database backups stored insecurely could be accessed by unauthorized parties.",
      strideCategory: "informationDisclosure",
      severity: "high",
      confidence: 0.85,
      mitigations: [
        "Encrypt backups",
        "Secure backup storage locations",
        "Implement backup access controls",
      ],
    },
  ],
  API: [
    {
      id: "api-auth-bypass",
      title: "Authentication Bypass",
      description:
        "Attackers access protected endpoints without proper authentication.",
      strideCategory: "spoofing",
      severity: "high",
      confidence: 0.9,
      mitigations: [
        "Validate tokens on every request",
        "Implement proper session management",
        "Use secure token storage",
      ],
    },
    {
      id: "api-broken-authz",
      title: "Broken Object Level Authorization",
      description:
        "Users can access resources belonging to other users by manipulating IDs.",
      strideCategory: "elevationOfPrivilege",
      severity: "high",
      confidence: 0.88,
      mitigations: [
        "Check authorization for every object access",
        "Use indirect references",
        "Implement proper access control lists",
      ],
    },
    {
      id: "api-rate-limiting",
      title: "Lack of Rate Limiting",
      description:
        "API can be overwhelmed by excessive requests, causing denial of service.",
      strideCategory: "denialOfService",
      severity: "medium",
      confidence: 0.85,
      mitigations: [
        "Implement rate limiting per client",
        "Use API quotas",
        "Deploy behind API gateway with throttling",
      ],
    },
  ],
  API_GATEWAY: [
    {
      id: "gw-ddos",
      title: "DDoS Attack",
      description:
        "Gateway overwhelmed by distributed denial of service attacks.",
      strideCategory: "denialOfService",
      severity: "high",
      confidence: 0.9,
      mitigations: [
        "DDoS protection service",
        "Rate limiting",
        "Geographic filtering",
        "Auto-scaling",
      ],
    },
    {
      id: "gw-token-theft",
      title: "Token Replay Attack",
      description: "Stolen tokens reused to impersonate legitimate users.",
      strideCategory: "spoofing",
      severity: "high",
      confidence: 0.85,
      mitigations: [
        "Short token expiry",
        "Token binding",
        "Refresh token rotation",
      ],
    },
  ],
  WEB_APP: [
    {
      id: "web-xss",
      title: "Cross-Site Scripting (XSS)",
      description:
        "Attackers inject malicious scripts that execute in user browsers.",
      strideCategory: "tampering",
      severity: "high",
      confidence: 0.92,
      mitigations: [
        "Output encoding",
        "Content Security Policy",
        "Input sanitization",
        "HTTPOnly cookies",
      ],
    },
    {
      id: "web-csrf",
      title: "Cross-Site Request Forgery",
      description: "Attackers trick users into performing unwanted actions.",
      strideCategory: "spoofing",
      severity: "medium",
      confidence: 0.88,
      mitigations: ["CSRF tokens", "SameSite cookies", "Verify origin headers"],
    },
    {
      id: "web-clickjacking",
      title: "Clickjacking",
      description:
        "UI redress attack tricking users into clicking hidden elements.",
      strideCategory: "tampering",
      severity: "medium",
      confidence: 0.8,
      mitigations: [
        "X-Frame-Options header",
        "Content-Security-Policy frame-ancestors",
      ],
    },
  ],
  AUTH_SERVICE: [
    {
      id: "auth-credential-stuffing",
      title: "Credential Stuffing",
      description: "Automated injection of stolen username/password pairs.",
      strideCategory: "spoofing",
      severity: "high",
      confidence: 0.9,
      mitigations: [
        "Multi-factor authentication",
        "Rate limiting on login",
        "Breach password detection",
        "CAPTCHA",
      ],
    },
    {
      id: "auth-session-fixation",
      title: "Session Fixation",
      description: "Attacker sets user session ID before authentication.",
      strideCategory: "spoofing",
      severity: "high",
      confidence: 0.85,
      mitigations: [
        "Regenerate session ID on login",
        "Use secure session management",
      ],
    },
    {
      id: "auth-weak-password",
      title: "Weak Password Policy",
      description: "Users can set easily guessable passwords.",
      strideCategory: "spoofing",
      severity: "medium",
      confidence: 0.88,
      mitigations: [
        "Enforce password complexity",
        "Check against common passwords",
        "Require MFA",
      ],
    },
  ],
  CACHE: [
    {
      id: "cache-poisoning",
      title: "Cache Poisoning",
      description:
        "Attackers inject malicious content into cache to serve to other users.",
      strideCategory: "tampering",
      severity: "high",
      confidence: 0.85,
      mitigations: [
        "Validate cache keys",
        "Use private caching for sensitive data",
        "Cache isolation",
      ],
    },
    {
      id: "cache-sensitive-data",
      title: "Sensitive Data in Cache",
      description: "Cached sensitive data accessible to unauthorized users.",
      strideCategory: "informationDisclosure",
      severity: "high",
      confidence: 0.88,
      mitigations: [
        "Encrypt cached sensitive data",
        "Implement cache-level access controls",
        "Short TTL for sensitive data",
      ],
    },
  ],
  QUEUE: [
    {
      id: "queue-message-tampering",
      title: "Message Tampering",
      description: "Messages modified in transit or at rest in the queue.",
      strideCategory: "tampering",
      severity: "medium",
      confidence: 0.82,
      mitigations: [
        "Sign messages",
        "Encrypt message contents",
        "Validate message integrity",
      ],
    },
    {
      id: "queue-poisoning",
      title: "Queue Poisoning",
      description:
        "Malicious messages cause consumer failures or resource exhaustion.",
      strideCategory: "denialOfService",
      severity: "medium",
      confidence: 0.8,
      mitigations: [
        "Message validation",
        "Dead letter queues",
        "Consumer error handling",
      ],
    },
  ],
  MICROSERVICE: [
    {
      id: "ms-ssrf",
      title: "Server-Side Request Forgery",
      description:
        "Attackers make service perform requests to internal resources.",
      strideCategory: "tampering",
      severity: "high",
      confidence: 0.85,
      mitigations: [
        "Whitelist allowed destinations",
        "Disable unnecessary protocols",
        "Network segmentation",
      ],
    },
    {
      id: "ms-insecure-deserialization",
      title: "Insecure Deserialization",
      description: "Untrusted data deserialized leading to code execution.",
      strideCategory: "tampering",
      severity: "critical",
      confidence: 0.82,
      mitigations: [
        "Use safe serialization formats",
        "Validate before deserializing",
        "Integrity checks",
      ],
    },
  ],
  CONTAINER: [
    {
      id: "container-escape",
      title: "Container Escape",
      description: "Attackers break out of container to access host system.",
      strideCategory: "elevationOfPrivilege",
      severity: "critical",
      confidence: 0.8,
      mitigations: [
        "Run as non-root",
        "Use read-only root filesystem",
        "Security contexts",
        "Seccomp profiles",
      ],
    },
    {
      id: "container-image-vuln",
      title: "Vulnerable Base Image",
      description: "Container image contains known vulnerabilities.",
      strideCategory: "elevationOfPrivilege",
      severity: "high",
      confidence: 0.9,
      mitigations: [
        "Regular image scanning",
        "Use minimal base images",
        "Keep images updated",
      ],
    },
  ],
  OBJECT_STORAGE: [
    {
      id: "s3-public-access",
      title: "Public Bucket Exposure",
      description: "Storage bucket misconfigured to allow public access.",
      strideCategory: "informationDisclosure",
      severity: "critical",
      confidence: 0.92,
      mitigations: [
        "Block public access by default",
        "Bucket policies",
        "Access logging",
        "Regular audits",
      ],
    },
    {
      id: "s3-insecure-upload",
      title: "Unrestricted File Upload",
      description: "Attackers upload malicious files without validation.",
      strideCategory: "tampering",
      severity: "high",
      confidence: 0.85,
      mitigations: [
        "File type validation",
        "Malware scanning",
        "Separate upload bucket",
        "Size limits",
      ],
    },
  ],
};

export function getSuggestionsForComponentType(
  type: ComponentType,
): ThreatSuggestion[] {
  return COMMON_THREATS_BY_TYPE[type] || [];
}

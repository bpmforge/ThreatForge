import type { StrideHelpContent } from "../types";

const STRIDE_HELP: StrideHelpContent[] = [
  {
    category: "spoofing",
    name: "Spoofing",
    definition:
      "Pretending to be something or someone other than yourself. Attackers impersonate users, systems, or services to gain unauthorized access.",
    exampleAttacks: [
      "Session hijacking - stealing session tokens to impersonate users",
      "Credential stuffing - using stolen credentials from other breaches",
      "DNS spoofing - redirecting traffic to malicious servers",
      "Certificate impersonation - using fake SSL certificates",
    ],
    questionsToAsk: [
      "How do users prove their identity?",
      "Can an attacker replay authentication tokens?",
      "Is multi-factor authentication available?",
      "How are service-to-service calls authenticated?",
    ],
    componentSpecificHelp: {
      API: "APIs are primary targets for spoofing. Ensure JWT validation, API key rotation, and consider mTLS for service mesh.",
      API_GATEWAY:
        "Gateway should validate all incoming tokens and implement rate limiting per identity.",
      AUTH_SERVICE:
        "Critical component - implement secure password storage, MFA, and account lockout policies.",
      DATABASE:
        "Ensure connection strings use proper authentication, not hardcoded credentials.",
      WEB_APP:
        "Implement CSRF protection, secure session management, and same-origin policies.",
    },
  },
  {
    category: "tampering",
    name: "Tampering",
    definition:
      "Modifying data or code without authorization. Attackers alter data in transit, at rest, or modify application logic.",
    exampleAttacks: [
      "SQL injection - modifying database queries to alter data",
      "Man-in-the-middle - intercepting and modifying network traffic",
      "Parameter tampering - modifying request parameters",
      "Code injection - inserting malicious code into applications",
    ],
    questionsToAsk: [
      "Is data integrity verified with checksums or signatures?",
      "Are all inputs validated and sanitized?",
      "Is TLS used for all data in transit?",
      "Can audit logs be modified?",
    ],
    componentSpecificHelp: {
      DATABASE:
        "Use parameterized queries, implement row-level security, and maintain integrity constraints.",
      API: "Validate all input, use request signing for sensitive operations.",
      WEB_APP:
        "Implement Content Security Policy, sanitize user input, use SRI for external scripts.",
      QUEUE:
        "Sign messages to prevent tampering, validate message integrity on consumption.",
      FILE_SYSTEM:
        "Use file integrity monitoring, implement access controls, encrypt sensitive files.",
    },
  },
  {
    category: "repudiation",
    name: "Repudiation",
    definition:
      "Denying having performed an action. Users or attackers claim they did not perform actions, making accountability difficult.",
    exampleAttacks: [
      "Deleting audit logs after malicious activity",
      "Using shared accounts to avoid attribution",
      "Modifying timestamps to hide activity timing",
      "Claiming account compromise after fraudulent transactions",
    ],
    questionsToAsk: [
      "Are all security-relevant actions logged?",
      "Are logs tamper-proof and centrally stored?",
      "Can user actions be traced to specific identities?",
      "Is there a chain of custody for sensitive operations?",
    ],
    componentSpecificHelp: {
      DATABASE:
        "Enable audit logging, implement change data capture for sensitive tables.",
      API: "Log all requests with correlation IDs, user identity, and timestamps.",
      AUTH_SERVICE:
        "Log all authentication attempts, password changes, and permission modifications.",
      FILE_SYSTEM:
        "Enable file access auditing, maintain modification history.",
    },
  },
  {
    category: "informationDisclosure",
    name: "Information Disclosure",
    definition:
      "Exposing information to unauthorized parties. Sensitive data is leaked through various channels.",
    exampleAttacks: [
      "Data breaches exposing customer information",
      "Error messages revealing system internals",
      "Insecure direct object references exposing other users data",
      "Side-channel attacks inferring sensitive data",
    ],
    questionsToAsk: [
      "Is sensitive data encrypted at rest and in transit?",
      "Do error messages reveal system information?",
      "Is access to data properly authorized?",
      "Are there data retention policies?",
    ],
    componentSpecificHelp: {
      DATABASE:
        "Encrypt sensitive columns, implement field-level access controls, mask data in non-prod.",
      API: "Never return more data than needed, implement proper authorization checks.",
      WEB_APP:
        "Use generic error messages, implement proper access controls for resources.",
      CACHE:
        "Consider data sensitivity when caching, implement cache isolation per user.",
      OBJECT_STORAGE:
        "Ensure buckets are not publicly accessible, use pre-signed URLs.",
    },
  },
  {
    category: "denialOfService",
    name: "Denial of Service",
    definition:
      "Making a system unavailable to legitimate users. Attackers exhaust resources or exploit vulnerabilities to crash services.",
    exampleAttacks: [
      "Volumetric attacks flooding network bandwidth",
      "Resource exhaustion through expensive operations",
      "Application-layer attacks targeting specific endpoints",
      "Algorithmic complexity attacks (e.g., hash collision)",
    ],
    questionsToAsk: [
      "Is rate limiting implemented?",
      "Can a single user exhaust shared resources?",
      "Are there circuit breakers for dependent services?",
      "Is auto-scaling configured appropriately?",
    ],
    componentSpecificHelp: {
      API: "Implement rate limiting, request size limits, and timeout policies.",
      API_GATEWAY:
        "Configure DDoS protection, rate limiting per client, and request throttling.",
      DATABASE:
        "Implement connection pooling, query timeouts, and resource quotas.",
      LOAD_BALANCER:
        "Configure health checks, connection limits, and geographic filtering.",
      QUEUE:
        "Implement queue depth limits, dead letter queues, and consumer scaling.",
    },
  },
  {
    category: "elevationOfPrivilege",
    name: "Elevation of Privilege",
    definition:
      "Gaining capabilities beyond what was authorized. Attackers escalate from low-privilege to high-privilege access.",
    exampleAttacks: [
      "Exploiting IDOR to access admin functions",
      "JWT claim manipulation to gain elevated roles",
      "Container escape to host system",
      "SQL injection to bypass authorization",
    ],
    questionsToAsk: [
      "Is the principle of least privilege applied?",
      "Are authorization checks performed server-side?",
      "Can users modify their own permissions?",
      "Are privileged operations properly isolated?",
    ],
    componentSpecificHelp: {
      IAM: "Implement role-based access control, regular access reviews, and separation of duties.",
      API: "Validate authorization on every request, not just authentication.",
      DATABASE:
        "Use database roles with minimal permissions, avoid using admin accounts.",
      CONTAINER:
        "Run as non-root, use read-only filesystems, implement security contexts.",
      KUBERNETES: "Use RBAC, network policies, and pod security policies.",
    },
  },
];

export function getStrideHelpForCategory(
  category: string,
): StrideHelpContent | undefined {
  return STRIDE_HELP.find((h) => h.category === category);
}

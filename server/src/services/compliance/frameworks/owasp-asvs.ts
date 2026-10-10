/**
 * OWASP Application Security Verification Standard (ASVS)
 *
 * Based on OWASP ASVS 4.0.3 (2021).
 */

import type { ControlCategory, ComplianceControl } from "../types.js";

const FRAMEWORK = "OWASP_ASVS" as const;

export const OWASP_ASVS_CATEGORIES: ControlCategory[] = [
  {
    id: "V1",
    name: "Architecture, Design and Threat Modeling",
    description: "Security architecture requirements.",
    controls: [],
  },
  {
    id: "V2",
    name: "Authentication",
    description: "Verification of user identity.",
    controls: [],
  },
  {
    id: "V3",
    name: "Session Management",
    description: "Session handling security.",
    controls: [],
  },
  {
    id: "V4",
    name: "Access Control",
    description: "Authorization and access controls.",
    controls: [],
  },
  {
    id: "V5",
    name: "Validation, Sanitization and Encoding",
    description: "Input validation and output encoding.",
    controls: [],
  },
  {
    id: "V6",
    name: "Stored Cryptography",
    description: "Cryptographic controls for data at rest.",
    controls: [],
  },
  {
    id: "V7",
    name: "Error Handling and Logging",
    description: "Error handling and security logging.",
    controls: [],
  },
  {
    id: "V8",
    name: "Data Protection",
    description: "Data protection controls.",
    controls: [],
  },
  {
    id: "V9",
    name: "Communication",
    description: "Secure communications.",
    controls: [],
  },
  {
    id: "V10",
    name: "Malicious Code",
    description: "Protection against malicious code.",
    controls: [],
  },
  {
    id: "V13",
    name: "API and Web Service",
    description: "API security requirements.",
    controls: [],
  },
  {
    id: "V14",
    name: "Configuration",
    description: "Secure configuration requirements.",
    controls: [],
  },
];

export const OWASP_ASVS_CONTROLS: ComplianceControl[] = [
  // V1 - Architecture
  {
    id: "V1.1.1",
    name: "Secure Development Lifecycle",
    description: "Verify the use of a secure software development lifecycle.",
    category: "V1",
    framework: FRAMEWORK,
    strideCategories: ["tampering", "elevationOfPrivilege"],
    keywords: ["SDLC", "secure development", "security lifecycle", "DevSecOps"],
    severity: "MEDIUM",
  },
  {
    id: "V1.1.2",
    name: "Threat Modeling",
    description: "Verify the use of threat modeling for every design change.",
    category: "V1",
    framework: FRAMEWORK,
    strideCategories: [
      "spoofing",
      "tampering",
      "repudiation",
      "informationDisclosure",
      "denial",
      "elevationOfPrivilege",
    ],
    keywords: ["threat model", "STRIDE", "risk assessment", "security design"],
    severity: "HIGH",
  },
  {
    id: "V1.2.1",
    name: "Input Validation Architecture",
    description:
      "Verify that all application components use the same encoding and validation.",
    category: "V1",
    framework: FRAMEWORK,
    strideCategories: ["tampering", "informationDisclosure"],
    keywords: ["input validation", "encoding", "sanitization", "XSS"],
    severity: "HIGH",
  },
  // V2 - Authentication
  {
    id: "V2.1.1",
    name: "Password Length",
    description: "Verify that user set passwords are at least 12 characters.",
    category: "V2",
    framework: FRAMEWORK,
    strideCategories: ["spoofing"],
    keywords: ["password", "length", "complexity", "strength"],
    severity: "MEDIUM",
  },
  {
    id: "V2.2.1",
    name: "Anti-Automation",
    description:
      "Verify anti-automation controls are effective against brute force attacks.",
    category: "V2",
    framework: FRAMEWORK,
    strideCategories: ["spoofing", "denial"],
    keywords: [
      "rate limiting",
      "brute force",
      "lockout",
      "CAPTCHA",
      "throttling",
    ],
    severity: "HIGH",
  },
  {
    id: "V2.5.1",
    name: "MFA Implementation",
    description: "Verify that OTP or multi-factor authentication is available.",
    category: "V2",
    framework: FRAMEWORK,
    strideCategories: ["spoofing"],
    keywords: ["MFA", "multi-factor", "2FA", "OTP", "authenticator"],
    severity: "HIGH",
  },
  {
    id: "V2.8.1",
    name: "Credential Storage",
    description:
      "Verify that passwords are stored using approved one-way key derivation.",
    category: "V2",
    framework: FRAMEWORK,
    strideCategories: ["spoofing", "informationDisclosure"],
    keywords: [
      "password hash",
      "bcrypt",
      "argon2",
      "PBKDF2",
      "credential storage",
    ],
    severity: "CRITICAL",
  },
  // V3 - Session Management
  {
    id: "V3.2.1",
    name: "Session Token Generation",
    description:
      "Verify session tokens are generated using approved cryptographic algorithms.",
    category: "V3",
    framework: FRAMEWORK,
    strideCategories: ["spoofing", "repudiation"],
    keywords: ["session token", "random", "cryptographic", "CSPRNG"],
    severity: "HIGH",
  },
  {
    id: "V3.3.1",
    name: "Session Timeout",
    description:
      "Verify that session tokens time out after a period of inactivity.",
    category: "V3",
    framework: FRAMEWORK,
    strideCategories: ["spoofing"],
    keywords: ["session timeout", "idle timeout", "expiration", "inactivity"],
    severity: "MEDIUM",
  },
  {
    id: "V3.4.1",
    name: "Cookie Security",
    description:
      "Verify cookie-based session tokens have Secure attribute set.",
    category: "V3",
    framework: FRAMEWORK,
    strideCategories: ["spoofing", "informationDisclosure"],
    keywords: ["cookie", "secure", "httpOnly", "sameSite"],
    severity: "HIGH",
  },
  // V4 - Access Control
  {
    id: "V4.1.1",
    name: "Access Control Verification",
    description: "Verify access controls fail securely.",
    category: "V4",
    framework: FRAMEWORK,
    strideCategories: ["elevationOfPrivilege"],
    keywords: [
      "access control",
      "authorization",
      "fail secure",
      "deny by default",
    ],
    severity: "HIGH",
  },
  {
    id: "V4.1.2",
    name: "Least Privilege",
    description: "Verify that users can only access authorized functions.",
    category: "V4",
    framework: FRAMEWORK,
    strideCategories: ["elevationOfPrivilege", "informationDisclosure"],
    keywords: ["least privilege", "RBAC", "authorization", "access matrix"],
    severity: "HIGH",
  },
  {
    id: "V4.2.1",
    name: "Data-Level Access Control",
    description:
      "Verify that sensitive data is protected with object level access control.",
    category: "V4",
    framework: FRAMEWORK,
    strideCategories: ["informationDisclosure", "elevationOfPrivilege"],
    keywords: ["IDOR", "object level", "data access", "row level"],
    severity: "CRITICAL",
  },
  // V5 - Validation
  {
    id: "V5.1.1",
    name: "Input Validation",
    description:
      "Verify that input validation is performed on a trusted service layer.",
    category: "V5",
    framework: FRAMEWORK,
    strideCategories: ["tampering"],
    keywords: ["input validation", "server-side", "whitelist", "schema"],
    severity: "HIGH",
  },
  {
    id: "V5.2.1",
    name: "SQL Injection Prevention",
    description: "Verify that SQL queries use parameterized queries.",
    category: "V5",
    framework: FRAMEWORK,
    strideCategories: ["tampering", "informationDisclosure"],
    keywords: ["SQL injection", "parameterized", "prepared statement", "ORM"],
    severity: "CRITICAL",
  },
  {
    id: "V5.3.1",
    name: "Output Encoding",
    description: "Verify that output encoding is applied to prevent XSS.",
    category: "V5",
    framework: FRAMEWORK,
    strideCategories: ["tampering"],
    keywords: ["XSS", "output encoding", "escaping", "content security"],
    severity: "HIGH",
  },
  // V6 - Cryptography
  {
    id: "V6.2.1",
    name: "Encryption Algorithms",
    description:
      "Verify that all cryptographic modules use approved algorithms.",
    category: "V6",
    framework: FRAMEWORK,
    strideCategories: ["informationDisclosure"],
    keywords: ["encryption", "AES", "RSA", "approved algorithm", "FIPS"],
    severity: "HIGH",
  },
  {
    id: "V6.4.1",
    name: "Key Management",
    description:
      "Verify that keys are managed securely throughout their lifecycle.",
    category: "V6",
    framework: FRAMEWORK,
    strideCategories: ["informationDisclosure", "spoofing"],
    keywords: ["key management", "key rotation", "HSM", "key vault"],
    severity: "HIGH",
  },
  // V7 - Error Handling
  {
    id: "V7.1.1",
    name: "Error Message Security",
    description:
      "Verify that error messages do not disclose sensitive information.",
    category: "V7",
    framework: FRAMEWORK,
    strideCategories: ["informationDisclosure"],
    keywords: [
      "error message",
      "stack trace",
      "information leakage",
      "exception",
    ],
    severity: "MEDIUM",
  },
  {
    id: "V7.2.1",
    name: "Security Logging",
    description: "Verify that all authentication decisions are logged.",
    category: "V7",
    framework: FRAMEWORK,
    strideCategories: ["repudiation"],
    keywords: [
      "logging",
      "audit trail",
      "security events",
      "authentication log",
    ],
    severity: "HIGH",
  },
  // V8 - Data Protection
  {
    id: "V8.1.1",
    name: "Sensitive Data Identification",
    description: "Verify that all sensitive data is identified and classified.",
    category: "V8",
    framework: FRAMEWORK,
    strideCategories: ["informationDisclosure"],
    keywords: ["data classification", "sensitive data", "PII", "inventory"],
    severity: "MEDIUM",
  },
  {
    id: "V8.3.1",
    name: "Data Transmission",
    description:
      "Verify that sensitive data is sent in HTTP message body or headers.",
    category: "V8",
    framework: FRAMEWORK,
    strideCategories: ["informationDisclosure"],
    keywords: ["query string", "URL parameter", "sensitive data", "HTTP body"],
    severity: "HIGH",
  },
  // V9 - Communication
  {
    id: "V9.1.1",
    name: "TLS for All Connections",
    description: "Verify that TLS is used for all client connectivity.",
    category: "V9",
    framework: FRAMEWORK,
    strideCategories: ["informationDisclosure", "tampering"],
    keywords: ["TLS", "HTTPS", "encryption in transit", "SSL"],
    severity: "CRITICAL",
  },
  {
    id: "V9.1.2",
    name: "TLS Version",
    description: "Verify that connections use TLS 1.2 or higher.",
    category: "V9",
    framework: FRAMEWORK,
    strideCategories: ["informationDisclosure"],
    keywords: ["TLS version", "TLS 1.2", "TLS 1.3", "protocol version"],
    severity: "HIGH",
  },
  // V13 - API Security
  {
    id: "V13.1.1",
    name: "API Authentication",
    description:
      "Verify that all API responses contain correct content-type headers.",
    category: "V13",
    framework: FRAMEWORK,
    strideCategories: ["tampering"],
    keywords: ["content-type", "API header", "MIME type", "response header"],
    severity: "MEDIUM",
  },
  {
    id: "V13.2.1",
    name: "RESTful Access Control",
    description: "Verify that RESTful APIs use authorization per resource.",
    category: "V13",
    framework: FRAMEWORK,
    strideCategories: ["elevationOfPrivilege", "informationDisclosure"],
    keywords: [
      "REST",
      "API authorization",
      "resource access",
      "endpoint security",
    ],
    severity: "HIGH",
  },
  {
    id: "V13.4.1",
    name: "GraphQL Security",
    description:
      "Verify that GraphQL has query whitelisting or depth limiting.",
    category: "V13",
    framework: FRAMEWORK,
    strideCategories: ["denial", "informationDisclosure"],
    keywords: ["GraphQL", "query complexity", "depth limit", "introspection"],
    severity: "MEDIUM",
  },
  // V14 - Configuration
  {
    id: "V14.1.1",
    name: "Build Process",
    description:
      "Verify that the application build and deployment processes are secure.",
    category: "V14",
    framework: FRAMEWORK,
    strideCategories: ["tampering"],
    keywords: ["build", "CI/CD", "deployment", "pipeline security"],
    severity: "MEDIUM",
  },
  {
    id: "V14.2.1",
    name: "Component Inventory",
    description: "Verify that all components are up to date.",
    category: "V14",
    framework: FRAMEWORK,
    strideCategories: ["tampering", "elevationOfPrivilege"],
    keywords: ["dependency", "component", "SBOM", "vulnerability scan"],
    severity: "HIGH",
  },
];

// Populate categories with their controls
OWASP_ASVS_CATEGORIES.forEach((category) => {
  category.controls = OWASP_ASVS_CONTROLS.filter(
    (c) => c.category === category.id,
  );
});

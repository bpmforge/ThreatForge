/**
 * Spoofing threats - identity impersonation attacks.
 */
import type { LibraryThreat } from "../types";

export const spoofingThreats: LibraryThreat[] = [
  {
    id: "S001",
    name: "Credential Theft",
    description:
      "Attacker steals user credentials through phishing, keylogging, or credential stuffing to impersonate legitimate users.",
    strideCategories: ["SPOOFING"],
    defaultSeverity: "HIGH",
    applicableTo: ["ACTOR", "EXTERNAL_ENTITY", "WEB_APP", "API"],
    attackScenarios: [
      "Phishing email tricks user into entering credentials on fake login page",
      "Credential stuffing using leaked password databases",
    ],
    suggestedMitigations: [
      "Implement multi-factor authentication (MFA)",
      "Use password managers and enforce strong passwords",
      "Monitor for credential stuffing attacks",
    ],
    references: ["CWE-287", "OWASP A07:2021"],
  },
  {
    id: "S002",
    name: "Session Hijacking",
    description:
      "Attacker steals or predicts session tokens to impersonate an authenticated user.",
    strideCategories: ["SPOOFING"],
    defaultSeverity: "HIGH",
    applicableTo: ["WEB_APP", "API", "PROCESS"],
    attackScenarios: [
      "XSS attack steals session cookie",
      "Session token transmitted over unencrypted connection",
    ],
    suggestedMitigations: [
      "Use secure, HttpOnly, SameSite cookies",
      "Implement session timeout and rotation",
      "Bind sessions to client fingerprint",
    ],
    references: ["CWE-384", "OWASP A07:2021"],
  },
  {
    id: "S003",
    name: "Man-in-the-Middle (MITM)",
    description:
      "Attacker intercepts communication to impersonate either party in the exchange.",
    strideCategories: ["SPOOFING"],
    defaultSeverity: "CRITICAL",
    applicableTo: ["DATA_FLOW", "API", "EXTERNAL_ENTITY"],
    attackScenarios: [
      "ARP spoofing on local network",
      "DNS hijacking redirects traffic",
      "Rogue WiFi access point",
    ],
    suggestedMitigations: [
      "Enforce TLS/HTTPS everywhere",
      "Implement certificate pinning",
      "Use mutual TLS (mTLS) for service-to-service",
    ],
    references: ["CWE-300", "OWASP A02:2021"],
  },
  {
    id: "S004",
    name: "API Key Compromise",
    description:
      "Attacker obtains API keys to make authorized requests as a legitimate service.",
    strideCategories: ["SPOOFING"],
    defaultSeverity: "HIGH",
    applicableTo: ["API", "EXTERNAL_ENTITY", "PROCESS"],
    attackScenarios: [
      "API key committed to public repository",
      "Key exposed in client-side code",
    ],
    suggestedMitigations: [
      "Rotate API keys regularly",
      "Use short-lived tokens instead of static keys",
      "Implement key scoping and rate limiting",
    ],
    references: ["CWE-798", "OWASP A07:2021"],
  },
  {
    id: "S005",
    name: "IP Spoofing",
    description:
      "Attacker forges source IP address to bypass IP-based access controls.",
    strideCategories: ["SPOOFING"],
    defaultSeverity: "MEDIUM",
    applicableTo: ["EXTERNAL_ENTITY", "API", "PROCESS"],
    attackScenarios: [
      "Bypass IP whitelist by spoofing trusted IP",
      "DDoS amplification attacks",
    ],
    suggestedMitigations: [
      "Do not rely solely on IP-based authentication",
      "Use cryptographic authentication",
      "Implement ingress filtering",
    ],
    references: ["CWE-290"],
  },
];

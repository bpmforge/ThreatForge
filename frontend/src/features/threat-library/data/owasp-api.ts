/**
 * OWASP API Security Top 10 (2023) threats.
 */
import type { LibraryThreat } from "../types";

export const owaspApiThreats: LibraryThreat[] = [
  {
    id: "API-1",
    name: "Broken Object Level Authorization (API1:2023)",
    description:
      "APIs exposing endpoints handling object IDs without proper authorization.",
    strideCategories: ["ELEVATION_OF_PRIVILEGE"],
    defaultSeverity: "CRITICAL",
    applicableTo: ["API"],
    attackScenarios: [
      "Changing object ID in request to access other users data",
      "Mass assignment to modify object properties",
      "IDOR vulnerabilities in RESTful endpoints",
    ],
    suggestedMitigations: [
      "Implement authorization checks on every function accessing data source",
      "Use random unpredictable IDs (GUIDs)",
      "Write tests for authorization mechanism",
    ],
    references: ["OWASP API1:2023", "CWE-284", "CWE-285"],
  },
  {
    id: "API-2",
    name: "Broken Authentication (API2:2023)",
    description:
      "Flawed authentication mechanisms allowing attackers to impersonate users.",
    strideCategories: ["SPOOFING"],
    defaultSeverity: "CRITICAL",
    applicableTo: ["API", "ACTOR"],
    attackScenarios: [
      "Weak API keys or tokens",
      "No rate limiting on authentication endpoints",
      "Credentials in URLs or unencrypted connections",
      "Weak password reset functionality",
    ],
    suggestedMitigations: [
      "Use standard authentication mechanisms (OAuth 2.0, OpenID Connect)",
      "Implement rate limiting and account lockout",
      "Use strong password policies",
      "Implement MFA where possible",
    ],
    references: ["OWASP API2:2023", "CWE-287"],
  },
  {
    id: "API-3",
    name: "Broken Object Property Authorization (API3:2023)",
    description:
      "Lack of validation on which object properties user can access or modify.",
    strideCategories: ["TAMPERING"],
    defaultSeverity: "HIGH",
    applicableTo: ["API"],
    attackScenarios: [
      "Mass assignment: modifying fields not intended for user access",
      "Excessive data exposure in API responses",
      "Adding extra parameters to requests",
    ],
    suggestedMitigations: [
      "Only return data the user should have access to",
      "Avoid generic methods (to_json, to_string)",
      "Define schemas for all API request payloads",
      "Use allowlists for properties that can be modified",
    ],
    references: ["OWASP API3:2023", "CWE-213", "CWE-915"],
  },
  {
    id: "API-4",
    name: "Unrestricted Resource Consumption (API4:2023)",
    description:
      "API requests consuming excessive resources due to lack of restrictions.",
    strideCategories: ["DENIAL_OF_SERVICE"],
    defaultSeverity: "HIGH",
    applicableTo: ["API", "PROCESS"],
    attackScenarios: [
      "Missing or improper rate limiting",
      "No limits on query complexity or response size",
      "Large file uploads exhausting storage",
      "Expensive operations without timeouts",
    ],
    suggestedMitigations: [
      "Implement rate limiting per client/API key",
      "Limit payload sizes and pagination",
      "Set timeouts for all API operations",
      "Define maximum complexity for queries",
    ],
    references: ["OWASP API4:2023", "CWE-770", "CWE-400"],
  },
  {
    id: "API-5",
    name: "Broken Function Level Authorization (API5:2023)",
    description:
      "Missing access controls at function level allowing unauthorized actions.",
    strideCategories: ["ELEVATION_OF_PRIVILEGE"],
    defaultSeverity: "CRITICAL",
    applicableTo: ["API"],
    attackScenarios: [
      "Accessing admin endpoints as regular user",
      "Changing HTTP method to bypass controls (GET to PUT)",
      "Modifying URL to access privileged functions",
    ],
    suggestedMitigations: [
      "Deny all access by default",
      "Review API endpoints for function level authorization flaws",
      "Ensure admin controllers inherit from admin abstract controller",
      "Implement centralized authorization module",
    ],
    references: ["OWASP API5:2023", "CWE-285"],
  },
];

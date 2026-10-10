/** Security Context type, option lists, colors, and component-type defaults. */

export interface SecurityContext {
  dataClassification: "PUBLIC" | "INTERNAL" | "CONFIDENTIAL" | "RESTRICTED";
  dataTypes: string[];
  accessPattern:
    | "PUBLIC_INTERNET"
    | "AUTHENTICATED_USERS"
    | "INTERNAL_ONLY"
    | "PARTNER_API";
  complianceFrameworks: string[];
  existingControls: string[];
  technologyVersion?: string;
}

export const DATA_TYPES = [
  "PII",
  "PHI",
  "Financial",
  "Credentials",
  "Session Tokens",
  "API Keys",
  "Source Code",
  "Logs",
  "Public Content",
];

export const COMPLIANCE_FRAMEWORKS = [
  "SOC2",
  "HIPAA",
  "PCI-DSS",
  "GDPR",
  "NIST CSF",
  "ISO 27001",
  "FedRAMP",
  "OWASP ASVS",
];

export const EXISTING_CONTROLS = [
  "Encryption at Rest",
  "Encryption in Transit",
  "Access Logging",
  "MFA Required",
  "WAF",
  "Rate Limiting",
  "Input Validation",
  "Output Encoding",
  "RBAC",
  "Network Segmentation",
];

export const CLASSIFICATION_COLORS = {
  PUBLIC: "text-green-600 bg-green-50 dark:bg-green-950",
  INTERNAL: "text-blue-600 bg-blue-50 dark:bg-blue-950",
  CONFIDENTIAL: "text-amber-600 bg-amber-50 dark:bg-amber-950",
  RESTRICTED: "text-red-600 bg-red-50 dark:bg-red-950",
};

/**
 * Cloud Security Threat Library
 *
 * Threats specific to cloud infrastructure (AWS, Azure, GCP).
 */

export interface ThreatTemplate {
  name: string;
  description: string;
  strideCategory:
    | "SPOOFING"
    | "TAMPERING"
    | "REPUDIATION"
    | "INFORMATION_DISCLOSURE"
    | "DENIAL_OF_SERVICE"
    | "ELEVATION_OF_PRIVILEGE";
  defaultSeverity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";
  applicableComponentTypes: string[];
  suggestedMitigations: string[];
  complianceControls: Record<string, string[]>;
  cweIds: string[];
  owaspIds: string[];
}

const CLOUD_THREATS: ThreatTemplate[] = [
  // Identity & Access
  {
    name: "Compromised Cloud Credentials",
    description:
      "Attacker obtains cloud provider credentials (access keys, service account keys) through phishing, code exposure, or credential stuffing.",
    strideCategory: "SPOOFING",
    defaultSeverity: "CRITICAL",
    applicableComponentTypes: ["cloud-service", "iam", "external-entity"],
    suggestedMitigations: [
      "Implement credential rotation policy",
      "Use short-lived tokens (STS, workload identity)",
      "Enable MFA for all cloud console access",
      "Monitor for anomalous API usage patterns",
      "Use secrets management service (Vault, AWS Secrets Manager)",
    ],
    complianceControls: {
      SOC2: ["CC6.1", "CC6.2"],
      NIST_CSF: ["PR.AC-1", "PR.AC-5"],
      ISO27001: ["A.5.17", "A.8.5"],
    },
    cweIds: ["CWE-798", "CWE-522"],
    owaspIds: ["A07:2021"],
  },
  {
    name: "Overly Permissive IAM Policy",
    description:
      "Cloud IAM policies grant excessive permissions beyond least privilege, allowing lateral movement or privilege escalation.",
    strideCategory: "ELEVATION_OF_PRIVILEGE",
    defaultSeverity: "HIGH",
    applicableComponentTypes: ["iam", "cloud-service", "function"],
    suggestedMitigations: [
      "Implement least privilege IAM policies",
      "Use IAM policy analyzer tools",
      "Regular access reviews and cleanup",
      "Implement service control policies (SCPs)",
      "Use permission boundaries",
    ],
    complianceControls: {
      SOC2: ["CC6.1", "CC6.3"],
      NIST_CSF: ["PR.AC-4"],
      ISO27001: ["A.8.2", "A.8.3"],
    },
    cweIds: ["CWE-269", "CWE-732"],
    owaspIds: ["A01:2021"],
  },
  {
    name: "Cross-Account Access Abuse",
    description:
      "Attacker exploits cross-account IAM roles or resource policies to access resources in another cloud account.",
    strideCategory: "ELEVATION_OF_PRIVILEGE",
    defaultSeverity: "HIGH",
    applicableComponentTypes: ["cloud-service", "iam"],
    suggestedMitigations: [
      "Restrict cross-account trust relationships",
      "Use external ID for cross-account roles",
      "Audit and monitor cross-account access",
      "Implement resource-based policies with condition keys",
    ],
    complianceControls: {
      SOC2: ["CC6.1"],
      NIST_CSF: ["PR.AC-3", "PR.AC-4"],
    },
    cweIds: ["CWE-863"],
    owaspIds: ["A01:2021"],
  },

  // Storage
  {
    name: "Public Cloud Storage Bucket",
    description:
      "Cloud storage bucket (S3, GCS, Azure Blob) is misconfigured with public access, exposing sensitive data.",
    strideCategory: "INFORMATION_DISCLOSURE",
    defaultSeverity: "CRITICAL",
    applicableComponentTypes: ["storage", "data-store", "cloud-service"],
    suggestedMitigations: [
      "Enable block public access settings",
      "Use bucket policies with explicit deny",
      "Enable access logging and monitoring",
      "Implement data classification and tagging",
      "Use AWS Access Analyzer or equivalent",
    ],
    complianceControls: {
      SOC2: ["CC6.6", "CC6.7"],
      NIST_CSF: ["PR.DS-1", "PR.DS-5"],
      ISO27001: ["A.8.12"],
    },
    cweIds: ["CWE-552", "CWE-732"],
    owaspIds: ["A01:2021", "A05:2021"],
  },
  {
    name: "Unencrypted Cloud Storage",
    description:
      "Sensitive data stored in cloud storage without encryption at rest, vulnerable to unauthorized access.",
    strideCategory: "INFORMATION_DISCLOSURE",
    defaultSeverity: "HIGH",
    applicableComponentTypes: ["storage", "data-store"],
    suggestedMitigations: [
      "Enable server-side encryption (SSE)",
      "Use customer-managed keys (CMK)",
      "Implement client-side encryption for sensitive data",
      "Enforce encryption via bucket policies",
    ],
    complianceControls: {
      SOC2: ["CC6.7"],
      NIST_CSF: ["PR.DS-1"],
      ISO27001: ["A.8.24"],
    },
    cweIds: ["CWE-311"],
    owaspIds: ["A02:2021"],
  },

  // Network
  {
    name: "Exposed Cloud Service Endpoint",
    description:
      "Cloud service endpoint (database, cache, message queue) is accessible from the internet without proper network controls.",
    strideCategory: "INFORMATION_DISCLOSURE",
    defaultSeverity: "CRITICAL",
    applicableComponentTypes: ["database", "cache", "queue", "cloud-service"],
    suggestedMitigations: [
      "Use VPC endpoints / Private Link",
      "Implement security groups / NSGs",
      "Enable network ACLs",
      "Use private subnets for backend services",
      "Implement VPN or Direct Connect for on-prem access",
    ],
    complianceControls: {
      SOC2: ["CC6.6"],
      NIST_CSF: ["PR.AC-5"],
      ISO27001: ["A.8.20"],
    },
    cweIds: ["CWE-284"],
    owaspIds: ["A05:2021"],
  },
  {
    name: "VPC Flow Log Tampering",
    description:
      "Attacker disables or modifies VPC flow logs to hide malicious network activity.",
    strideCategory: "REPUDIATION",
    defaultSeverity: "HIGH",
    applicableComponentTypes: ["network", "vpc", "cloud-service"],
    suggestedMitigations: [
      "Enable VPC flow logs to immutable storage",
      "Use cross-account log archival",
      "Monitor for flow log configuration changes",
      "Implement SCPs to prevent log deletion",
    ],
    complianceControls: {
      SOC2: ["CC7.1", "CC7.2"],
      NIST_CSF: ["DE.AE-1", "DE.CM-1"],
      ISO27001: ["A.8.15", "A.8.16"],
    },
    cweIds: ["CWE-778"],
    owaspIds: ["A09:2021"],
  },

  // Compute
  {
    name: "Instance Metadata Service Attack (IMDS)",
    description:
      "Attacker exploits SSRF or local access to query cloud instance metadata service and obtain credentials or sensitive data.",
    strideCategory: "INFORMATION_DISCLOSURE",
    defaultSeverity: "HIGH",
    applicableComponentTypes: ["compute", "vm", "function", "container"],
    suggestedMitigations: [
      "Enforce IMDSv2 (require hop limit and token)",
      "Limit IAM role permissions on instances",
      "Use Web Application Firewall (WAF)",
      "Implement egress filtering",
    ],
    complianceControls: {
      SOC2: ["CC6.1"],
      NIST_CSF: ["PR.AC-3"],
    },
    cweIds: ["CWE-918", "CWE-200"],
    owaspIds: ["A10:2021"],
  },
  {
    name: "Serverless Function Injection",
    description:
      "Attacker injects malicious code or payloads into serverless function through untrusted input.",
    strideCategory: "TAMPERING",
    defaultSeverity: "HIGH",
    applicableComponentTypes: ["function", "lambda", "cloud-function"],
    suggestedMitigations: [
      "Validate and sanitize all function inputs",
      "Use parameterized queries for data access",
      "Implement input schema validation",
      "Apply least privilege to function roles",
      "Enable runtime protection",
    ],
    complianceControls: {
      SOC2: ["CC6.1"],
      NIST_CSF: ["PR.IP-1"],
      ISO27001: ["A.8.28"],
    },
    cweIds: ["CWE-94", "CWE-77"],
    owaspIds: ["A03:2021"],
  },
  {
    name: "Cloud Resource Exhaustion",
    description:
      "Attacker triggers excessive cloud resource consumption leading to denial of service or excessive billing.",
    strideCategory: "DENIAL_OF_SERVICE",
    defaultSeverity: "MEDIUM",
    applicableComponentTypes: ["function", "api-gateway", "cloud-service"],
    suggestedMitigations: [
      "Implement budget alerts and spending limits",
      "Configure concurrency limits on functions",
      "Use API throttling and rate limiting",
      "Set up auto-scaling with maximum limits",
      "Monitor for unusual resource consumption",
    ],
    complianceControls: {
      SOC2: ["CC7.3"],
      NIST_CSF: ["RS.MI-1"],
    },
    cweIds: ["CWE-770", "CWE-400"],
    owaspIds: ["A05:2021"],
  },

  // Secrets & Configuration
  {
    name: "Exposed Cloud Configuration",
    description:
      "Cloud infrastructure configuration (CloudFormation, Terraform state) contains secrets or is publicly accessible.",
    strideCategory: "INFORMATION_DISCLOSURE",
    defaultSeverity: "HIGH",
    applicableComponentTypes: ["iac", "configuration", "cloud-service"],
    suggestedMitigations: [
      "Store state files in encrypted, private storage",
      "Use secrets references instead of hardcoded values",
      "Scan IaC for secrets before commit",
      "Implement state file locking and access controls",
    ],
    complianceControls: {
      SOC2: ["CC6.7"],
      NIST_CSF: ["PR.DS-1"],
      ISO27001: ["A.5.17"],
    },
    cweIds: ["CWE-798", "CWE-538"],
    owaspIds: ["A05:2021"],
  },
];

export const CLOUD_LIBRARY = {
  name: "Cloud Security Threats",
  description:
    "Threat templates for cloud infrastructure including AWS, Azure, and GCP environments.",
  templates: CLOUD_THREATS,
};

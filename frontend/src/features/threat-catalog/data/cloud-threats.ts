/**
 * Cloud Security Threats
 * Essential threats for AWS, Azure, and GCP environments.
 */
import type { CatalogThreat } from "../types";

export const cloudThreats: CatalogThreat[] = [
  // === Cross-Cloud Threats ===
  {
    id: "CLOUD-001",
    source: "BUILT_IN",
    name: "IAM Misconfiguration",
    description:
      "Overly permissive IAM policies allow unauthorized access to cloud resources.",
    strideCategories: ["ELEVATION_OF_PRIVILEGE"],
    severity: "CRITICAL",
    applicableTo: ["AWS_IAM", "GCP_IAM", "AZURE_AD", "IAM"],
    attackScenarios: [
      "Wildcard permissions in IAM policies",
      "Overprivileged service accounts",
      "Missing resource-level restrictions",
    ],
    mitigations: [
      "Implement least privilege principle",
      "Use IAM Access Analyzer / Policy Simulator",
      "Regular IAM audit and cleanup",
    ],
    references: [
      { source: "CWE", id: "CWE-269" },
      { source: "MITRE", id: "T1078.004" },
    ],
    tags: ["cloud", "iam", "aws", "azure", "gcp"],
  },
  {
    id: "CLOUD-002",
    source: "BUILT_IN",
    name: "Public Cloud Storage Exposure",
    description:
      "Cloud storage buckets/blobs exposed publicly leading to data breach.",
    strideCategories: ["INFORMATION_DISCLOSURE"],
    severity: "CRITICAL",
    applicableTo: ["AWS_S3", "AZURE_BLOB", "GCP_STORAGE", "OBJECT_STORAGE"],
    attackScenarios: [
      "Public bucket/container ACLs",
      "Misconfigured bucket policies",
      "Leaked pre-signed URLs",
    ],
    mitigations: [
      "Block public access by default",
      "Enable access logging",
      "Use bucket policies and ACLs correctly",
    ],
    references: [
      { source: "CWE", id: "CWE-732" },
      { source: "MITRE", id: "T1530" },
    ],
    tags: ["cloud", "storage", "s3", "blob"],
  },
  {
    id: "CLOUD-003",
    source: "BUILT_IN",
    name: "Insecure Secrets Management",
    description:
      "Secrets stored insecurely in cloud environments (env vars, code, config).",
    strideCategories: ["INFORMATION_DISCLOSURE"],
    severity: "HIGH",
    applicableTo: [
      "AWS_LAMBDA",
      "AZURE_FUNCTIONS",
      "GCP_FUNCTIONS",
      "CONTAINER",
      "SECRETS_MANAGER",
    ],
    attackScenarios: [
      "Secrets in environment variables",
      "Secrets in container images",
      "Unencrypted secrets in config files",
    ],
    mitigations: [
      "Use secrets manager services",
      "Rotate secrets regularly",
      "Never commit secrets to repos",
    ],
    references: [{ source: "CWE", id: "CWE-798" }],
    tags: ["cloud", "secrets", "credentials"],
  },
  {
    id: "CLOUD-004",
    source: "BUILT_IN",
    name: "Serverless Function Injection",
    description:
      "Injection attacks targeting serverless functions through event data.",
    strideCategories: ["TAMPERING"],
    severity: "HIGH",
    applicableTo: ["AWS_LAMBDA", "AZURE_FUNCTIONS", "GCP_FUNCTIONS"],
    attackScenarios: [
      "SQL injection via API Gateway event",
      "OS command injection in function",
      "NoSQL injection in event data",
    ],
    mitigations: [
      "Validate all event input",
      "Use parameterized queries",
      "Apply least privilege to function IAM",
    ],
    references: [
      { source: "CWE", id: "CWE-94" },
      { source: "OWASP", id: "A03:2021" },
    ],
    tags: ["cloud", "serverless", "injection"],
  },
  {
    id: "CLOUD-005",
    source: "BUILT_IN",
    name: "Cloud Metadata Service Abuse",
    description:
      "SSRF or misconfiguration allows access to cloud instance metadata service.",
    strideCategories: ["INFORMATION_DISCLOSURE"],
    severity: "CRITICAL",
    applicableTo: ["AWS_EC2", "AZURE_VM", "GCP_COMPUTE", "CONTAINER"],
    attackScenarios: [
      "SSRF to metadata endpoint",
      "Credential theft from IMDS",
      "Role assumption via leaked credentials",
    ],
    mitigations: [
      "Use IMDSv2 (require session tokens)",
      "Block metadata access from containers",
      "Implement SSRF protections",
    ],
    references: [
      { source: "CWE", id: "CWE-918" },
      { source: "MITRE", id: "T1552.005" },
    ],
    tags: ["cloud", "ssrf", "metadata"],
  },
  {
    id: "CLOUD-006",
    source: "BUILT_IN",
    name: "Insecure Network Configuration",
    description:
      "Overly permissive security groups or firewall rules expose resources.",
    strideCategories: ["ELEVATION_OF_PRIVILEGE"],
    severity: "HIGH",
    applicableTo: ["AWS_VPC", "AZURE_VNET", "GCP_VPC", "FIREWALL"],
    attackScenarios: [
      "0.0.0.0/0 inbound rules",
      "All ports open",
      "Missing network segmentation",
    ],
    mitigations: [
      "Apply least privilege to security groups",
      "Use VPC flow logs",
      "Implement network segmentation",
    ],
    references: [{ source: "CWE", id: "CWE-284" }],
    tags: ["cloud", "network", "firewall"],
  },
  {
    id: "CLOUD-007",
    source: "BUILT_IN",
    name: "Container Image Vulnerabilities",
    description:
      "Vulnerable dependencies or misconfigurations in container images.",
    strideCategories: ["ELEVATION_OF_PRIVILEGE"],
    severity: "HIGH",
    applicableTo: ["CONTAINER", "AWS_ECS", "AWS_EKS", "AZURE_AKS", "GCP_GKE"],
    attackScenarios: [
      "Known CVEs in base images",
      "Malicious packages in dependencies",
      "Running as root",
    ],
    mitigations: [
      "Scan images for vulnerabilities",
      "Use minimal base images",
      "Run as non-root user",
    ],
    references: [{ source: "CWE", id: "CWE-1104" }],
    tags: ["cloud", "container", "kubernetes"],
  },
  {
    id: "CLOUD-008",
    source: "BUILT_IN",
    name: "Kubernetes RBAC Misconfiguration",
    description: "Overly permissive Kubernetes RBAC allows cluster compromise.",
    strideCategories: ["ELEVATION_OF_PRIVILEGE"],
    severity: "CRITICAL",
    applicableTo: ["AWS_EKS", "AZURE_AKS", "GCP_GKE", "KUBERNETES"],
    attackScenarios: [
      "Cluster-admin bound to default SA",
      "Secrets access from compromised pod",
      "Pod creation leading to node access",
    ],
    mitigations: [
      "Apply least privilege RBAC",
      "Use namespace isolation",
      "Audit RBAC bindings regularly",
    ],
    references: [
      { source: "CWE", id: "CWE-269" },
      { source: "MITRE", id: "T1078.004" },
    ],
    tags: ["cloud", "kubernetes", "rbac"],
  },
  {
    id: "CLOUD-009",
    source: "BUILT_IN",
    name: "Unencrypted Data at Rest",
    description: "Cloud storage and databases without encryption at rest.",
    strideCategories: ["INFORMATION_DISCLOSURE"],
    severity: "HIGH",
    applicableTo: [
      "AWS_RDS",
      "AWS_S3",
      "AZURE_SQL",
      "AZURE_BLOB",
      "GCP_CLOUDSQL",
      "GCP_STORAGE",
    ],
    attackScenarios: [
      "Snapshot theft",
      "Disk image extraction",
      "Backup exposure",
    ],
    mitigations: [
      "Enable encryption at rest",
      "Use customer-managed keys",
      "Encrypt snapshots and backups",
    ],
    references: [
      { source: "CWE", id: "CWE-311" },
      { source: "OWASP", id: "A02:2021" },
    ],
    tags: ["cloud", "encryption", "storage"],
  },
  {
    id: "CLOUD-010",
    source: "BUILT_IN",
    name: "Missing Cloud Audit Logging",
    description: "Cloud audit logging disabled or not properly configured.",
    strideCategories: ["REPUDIATION"],
    severity: "MEDIUM",
    applicableTo: ["AWS_CLOUDTRAIL", "AZURE_MONITOR", "GCP_CLOUD_LOGGING"],
    attackScenarios: [
      "CloudTrail disabled",
      "Logs not centralized",
      "Short retention periods",
    ],
    mitigations: [
      "Enable CloudTrail/Activity Log/Audit Logs",
      "Send logs to central SIEM",
      "Set appropriate retention",
    ],
    references: [{ source: "CWE", id: "CWE-778" }],
    tags: ["cloud", "logging", "compliance"],
  },

  // === AWS-Specific ===
  {
    id: "AWS-001",
    source: "BUILT_IN",
    name: "AWS Cross-Account Access Misconfiguration",
    description:
      "Overly permissive cross-account IAM roles allow unauthorized access.",
    strideCategories: ["ELEVATION_OF_PRIVILEGE"],
    severity: "HIGH",
    applicableTo: ["AWS_IAM", "IAM"],
    attackScenarios: [
      "Missing external ID in trust policy",
      "Wildcard account principals",
      "Confused deputy attacks",
    ],
    mitigations: [
      "Always use external ID for third-party access",
      "Specify exact account IDs in principals",
      "Limit assumable actions",
    ],
    references: [{ source: "MITRE", id: "T1098.003" }],
    tags: ["aws", "iam", "cross-account"],
  },
  {
    id: "AWS-002",
    source: "BUILT_IN",
    name: "S3 Bucket Policy Bypass",
    description:
      "ACLs or bucket policies allow unintended access despite restrictions.",
    strideCategories: ["ELEVATION_OF_PRIVILEGE"],
    severity: "HIGH",
    applicableTo: ["AWS_S3"],
    attackScenarios: [
      "ACL overrides bucket policy",
      "Object-level ACL grants public access",
      "Policy allows s3:* actions",
    ],
    mitigations: [
      "Disable ACLs (bucket owner enforced)",
      "Use explicit deny statements",
      "Enable S3 Block Public Access",
    ],
    references: [{ source: "CWE", id: "CWE-284" }],
    tags: ["aws", "s3", "policy"],
  },

  // === Azure-Specific ===
  {
    id: "AZURE-001",
    source: "BUILT_IN",
    name: "Azure Managed Identity Abuse",
    description:
      "Managed identities with excessive permissions compromise connected resources.",
    strideCategories: ["ELEVATION_OF_PRIVILEGE"],
    severity: "HIGH",
    applicableTo: ["AZURE_APP_SERVICE", "AZURE_VM", "AZURE_FUNCTIONS"],
    attackScenarios: [
      "System-assigned MI with Owner role",
      "MI accessible from compromised app",
      "Key vault access via MI",
    ],
    mitigations: [
      "Use user-assigned MI for least privilege",
      "Scope MI permissions narrowly",
      "Monitor MI usage",
    ],
    references: [{ source: "MITRE", id: "T1078.004" }],
    tags: ["azure", "identity", "managed-identity"],
  },
  {
    id: "AZURE-002",
    source: "BUILT_IN",
    name: "Azure AD Conditional Access Bypass",
    description:
      "Missing or misconfigured conditional access allows unauthorized authentication.",
    strideCategories: ["SPOOFING"],
    severity: "HIGH",
    applicableTo: ["AZURE_AD", "AZURE_AD_B2C", "AUTH_SERVICE"],
    attackScenarios: [
      "Legacy auth protocols bypass MFA",
      "Device compliance not enforced",
      "Location-based rules misconfigured",
    ],
    mitigations: [
      "Block legacy authentication",
      "Require MFA for all users",
      "Implement device compliance checks",
    ],
    references: [{ source: "CWE", id: "CWE-287" }],
    tags: ["azure", "identity", "authentication"],
  },

  // === GCP-Specific ===
  {
    id: "GCP-001",
    source: "BUILT_IN",
    name: "GCP Service Account Key Exposure",
    description: "Downloaded service account keys leaked or stored insecurely.",
    strideCategories: ["INFORMATION_DISCLOSURE"],
    severity: "CRITICAL",
    applicableTo: ["GCP_IAM", "IAM"],
    attackScenarios: [
      "SA key committed to repo",
      "Key shared in logs/config",
      "Key on developer machine",
    ],
    mitigations: [
      "Prefer workload identity over keys",
      "Rotate keys regularly",
      "Monitor key usage",
    ],
    references: [{ source: "CWE", id: "CWE-798" }],
    tags: ["gcp", "identity", "service-account"],
  },
  {
    id: "GCP-002",
    source: "BUILT_IN",
    name: "GCP Org Policy Bypass",
    description:
      "Missing organization policies allow insecure resource configurations.",
    strideCategories: ["ELEVATION_OF_PRIVILEGE"],
    severity: "MEDIUM",
    applicableTo: ["GCP_IAM"],
    attackScenarios: [
      "Public IPs allowed",
      "Default VPC usage",
      "Missing domain restriction",
    ],
    mitigations: [
      "Implement organization policy constraints",
      "Restrict resource locations",
      "Enforce domain-restricted sharing",
    ],
    references: [{ source: "CWE", id: "CWE-16" }],
    tags: ["gcp", "policy", "governance"],
  },
];

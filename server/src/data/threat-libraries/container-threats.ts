/**
 * Container Security Threat Library
 *
 * Threats specific to containerized environments (Docker, Kubernetes).
 */

import type { ThreatTemplate } from "./cloud-threats.js";

const CONTAINER_THREATS: ThreatTemplate[] = [
  // Image Security
  {
    name: "Vulnerable Base Image",
    description:
      "Container image built from a base image containing known vulnerabilities (CVEs) in OS packages or runtime.",
    strideCategory: "TAMPERING",
    defaultSeverity: "HIGH",
    applicableComponentTypes: ["container", "pod", "docker"],
    suggestedMitigations: [
      "Use minimal base images (distroless, alpine)",
      "Implement container image scanning in CI/CD",
      "Establish approved base image registry",
      "Automate image rebuilds for security patches",
      "Use image signing and verification",
    ],
    complianceControls: {
      SOC2: ["CC8.1"],
      NIST_CSF: ["ID.RA-1", "PR.IP-1"],
      ISO27001: ["A.8.28", "A.8.29"],
    },
    cweIds: ["CWE-1395"],
    owaspIds: ["A06:2021"],
  },
  {
    name: "Malicious Container Image",
    description:
      "Attacker injects malicious code into container image through supply chain compromise or image registry attack.",
    strideCategory: "TAMPERING",
    defaultSeverity: "CRITICAL",
    applicableComponentTypes: ["container", "registry", "pod"],
    suggestedMitigations: [
      "Use private container registries",
      "Implement image signing (Notary, Cosign)",
      "Enforce image pull policies (always from trusted registries)",
      "Scan images for malware and backdoors",
      "Audit container registry access",
    ],
    complianceControls: {
      SOC2: ["CC6.8", "CC8.1"],
      NIST_CSF: ["PR.DS-5", "DE.CM-4"],
      ISO27001: ["A.8.28"],
    },
    cweIds: ["CWE-506", "CWE-829"],
    owaspIds: ["A08:2021"],
  },
  {
    name: "Secrets in Container Image",
    description:
      "Sensitive credentials, API keys, or certificates embedded in container image layers.",
    strideCategory: "INFORMATION_DISCLOSURE",
    defaultSeverity: "HIGH",
    applicableComponentTypes: ["container", "docker"],
    suggestedMitigations: [
      "Use secrets management (Vault, Kubernetes Secrets)",
      "Scan images for embedded secrets",
      "Use multi-stage builds to exclude sensitive data",
      "Mount secrets as volumes, not environment variables",
      "Implement secret rotation",
    ],
    complianceControls: {
      SOC2: ["CC6.7"],
      NIST_CSF: ["PR.DS-1"],
      ISO27001: ["A.5.17"],
    },
    cweIds: ["CWE-798", "CWE-540"],
    owaspIds: ["A07:2021"],
  },

  // Runtime Security
  {
    name: "Container Escape",
    description:
      "Attacker exploits container runtime vulnerability or misconfiguration to break out of container isolation and access host.",
    strideCategory: "ELEVATION_OF_PRIVILEGE",
    defaultSeverity: "CRITICAL",
    applicableComponentTypes: ["container", "pod", "docker", "host"],
    suggestedMitigations: [
      "Keep container runtime updated",
      "Avoid privileged containers",
      "Use read-only root filesystem",
      "Implement seccomp and AppArmor profiles",
      "Use container sandboxing (gVisor, Kata)",
    ],
    complianceControls: {
      SOC2: ["CC6.1"],
      NIST_CSF: ["PR.AC-4", "PR.IP-1"],
      ISO27001: ["A.8.2"],
    },
    cweIds: ["CWE-284", "CWE-269"],
    owaspIds: ["A05:2021"],
  },
  {
    name: "Privileged Container Abuse",
    description:
      "Attacker exploits privileged container to access host resources, mount host filesystem, or manipulate kernel.",
    strideCategory: "ELEVATION_OF_PRIVILEGE",
    defaultSeverity: "CRITICAL",
    applicableComponentTypes: ["container", "pod"],
    suggestedMitigations: [
      "Prohibit privileged containers via admission control",
      "Use PodSecurityPolicies / PodSecurityStandards",
      "Drop all capabilities and add only required ones",
      "Implement OPA/Gatekeeper policies",
    ],
    complianceControls: {
      SOC2: ["CC6.1"],
      NIST_CSF: ["PR.AC-4"],
      ISO27001: ["A.8.2"],
    },
    cweIds: ["CWE-250", "CWE-269"],
    owaspIds: ["A05:2021"],
  },
  {
    name: "Container Resource Exhaustion",
    description:
      "Container consumes excessive CPU, memory, or disk resources causing denial of service to other workloads.",
    strideCategory: "DENIAL_OF_SERVICE",
    defaultSeverity: "MEDIUM",
    applicableComponentTypes: ["container", "pod"],
    suggestedMitigations: [
      "Set resource limits and requests",
      "Implement LimitRange and ResourceQuota",
      "Use pod disruption budgets",
      "Monitor resource usage with alerts",
    ],
    complianceControls: {
      SOC2: ["CC7.3"],
      NIST_CSF: ["RS.MI-1"],
    },
    cweIds: ["CWE-770", "CWE-400"],
    owaspIds: [],
  },

  // Kubernetes Specific
  {
    name: "RBAC Misconfiguration",
    description:
      "Kubernetes RBAC grants excessive permissions allowing unauthorized access to cluster resources or secrets.",
    strideCategory: "ELEVATION_OF_PRIVILEGE",
    defaultSeverity: "HIGH",
    applicableComponentTypes: ["kubernetes", "cluster", "namespace"],
    suggestedMitigations: [
      "Follow principle of least privilege for RBAC",
      "Avoid cluster-admin bindings for workloads",
      "Use namespace-scoped roles where possible",
      "Regular RBAC audits with tools like rbac-audit",
      "Implement just-in-time access for admin tasks",
    ],
    complianceControls: {
      SOC2: ["CC6.1", "CC6.3"],
      NIST_CSF: ["PR.AC-4"],
      ISO27001: ["A.8.2"],
    },
    cweIds: ["CWE-269", "CWE-732"],
    owaspIds: ["A01:2021"],
  },
  {
    name: "Kubernetes API Server Exposure",
    description:
      "Kubernetes API server is accessible from untrusted networks allowing unauthorized cluster management.",
    strideCategory: "INFORMATION_DISCLOSURE",
    defaultSeverity: "CRITICAL",
    applicableComponentTypes: ["kubernetes", "api-server", "cluster"],
    suggestedMitigations: [
      "Restrict API server to private network",
      "Use authorized networks / IP allowlisting",
      "Enable audit logging for API server",
      "Require client certificate authentication",
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
    name: "Service Account Token Theft",
    description:
      "Attacker steals Kubernetes service account token from pod to impersonate the service account.",
    strideCategory: "SPOOFING",
    defaultSeverity: "HIGH",
    applicableComponentTypes: ["pod", "service-account", "kubernetes"],
    suggestedMitigations: [
      "Disable auto-mounting of service account tokens",
      "Use bound service account tokens (time-limited)",
      "Implement pod identity with workload identity",
      "Restrict service account permissions",
    ],
    complianceControls: {
      SOC2: ["CC6.1"],
      NIST_CSF: ["PR.AC-1"],
      ISO27001: ["A.5.17"],
    },
    cweIds: ["CWE-522"],
    owaspIds: ["A07:2021"],
  },
  {
    name: "Kubernetes Secret Exposure",
    description:
      "Kubernetes Secrets accessed by unauthorized users or pods due to weak access controls or etcd compromise.",
    strideCategory: "INFORMATION_DISCLOSURE",
    defaultSeverity: "HIGH",
    applicableComponentTypes: ["secret", "kubernetes", "etcd"],
    suggestedMitigations: [
      "Encrypt secrets at rest (etcd encryption)",
      "Use external secrets management (Vault, External Secrets)",
      "Restrict secret access via RBAC",
      "Audit secret access",
    ],
    complianceControls: {
      SOC2: ["CC6.7"],
      NIST_CSF: ["PR.DS-1"],
      ISO27001: ["A.8.24"],
    },
    cweIds: ["CWE-312", "CWE-522"],
    owaspIds: ["A02:2021"],
  },
  {
    name: "Pod-to-Pod Network Attack",
    description:
      "Compromised pod attacks other pods in the cluster due to lack of network segmentation.",
    strideCategory: "TAMPERING",
    defaultSeverity: "MEDIUM",
    applicableComponentTypes: ["pod", "service", "kubernetes"],
    suggestedMitigations: [
      "Implement NetworkPolicies for pod isolation",
      "Use service mesh (Istio, Linkerd) for mTLS",
      "Segment workloads into namespaces",
      "Deploy network policy enforcement (Calico, Cilium)",
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
    name: "Sidecar Injection Bypass",
    description:
      "Attacker bypasses service mesh sidecar injection to communicate without encryption or policy enforcement.",
    strideCategory: "TAMPERING",
    defaultSeverity: "MEDIUM",
    applicableComponentTypes: ["pod", "service-mesh", "kubernetes"],
    suggestedMitigations: [
      "Enforce sidecar injection via admission webhook",
      "Use strict mTLS mode in service mesh",
      "Monitor for pods without sidecars",
      "Implement NetworkPolicies as backup",
    ],
    complianceControls: {
      SOC2: ["CC6.7"],
      NIST_CSF: ["PR.DS-2"],
    },
    cweIds: ["CWE-319"],
    owaspIds: ["A02:2021"],
  },
];

export const CONTAINER_LIBRARY = {
  name: "Container Security Threats",
  description:
    "Threat templates for containerized environments including Docker, Kubernetes, and container orchestration.",
  templates: CONTAINER_THREATS,
};

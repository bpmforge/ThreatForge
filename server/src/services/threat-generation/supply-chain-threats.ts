/**
 * Supply Chain Threat Templates
 *
 * Pre-built threat patterns for third-party dependencies and supply chain risks.
 * Maps common dependency types to known supply chain attack vectors.
 */

export interface SupplyChainThreat {
  name: string;
  description: string;
  strideCategory: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  attackVector: string;
  mitigation: string;
  references: string[];
}

/**
 * Get supply chain threats for a dependency type.
 */
export function getSupplyChainThreats(
  dependencyType:
    | "npm"
    | "pypi"
    | "cargo"
    | "maven"
    | "docker"
    | "github-action",
): SupplyChainThreat[] {
  return SUPPLY_CHAIN_THREATS[dependencyType] || COMMON_SUPPLY_CHAIN;
}

const COMMON_SUPPLY_CHAIN: SupplyChainThreat[] = [
  {
    name: "Dependency confusion",
    description:
      "Attacker publishes malicious package with same name as internal package to public registry",
    strideCategory: "TAMPERING",
    severity: "CRITICAL",
    attackVector: "Package registry typosquatting / namespace confusion",
    mitigation:
      "Use private registry, pin exact versions, verify package checksums",
    references: ["CWE-829", "MITRE T1195.002"],
  },
  {
    name: "Compromised maintainer",
    description:
      "Legitimate package maintainer account compromised, malicious update published",
    strideCategory: "TAMPERING",
    severity: "CRITICAL",
    attackVector: "Social engineering, credential theft, or insider threat",
    mitigation:
      "Pin versions, use lockfiles, review changelogs before updating, SBOM tracking",
    references: ["CWE-494", "MITRE T1195.001"],
  },
  {
    name: "Malicious dependency injection",
    description:
      "Transitive dependency introduces malicious code through deeply nested dependency tree",
    strideCategory: "TAMPERING",
    severity: "HIGH",
    attackVector:
      "Publishing malicious package that becomes transitive dependency",
    mitigation:
      "Audit dependency tree, use tools like Socket.dev / Snyk, limit transitive deps",
    references: ["CWE-829"],
  },
  {
    name: "Abandoned package takeover",
    description:
      "Unmaintained package with known vulnerabilities still in use, or namespace reclaimed by attacker",
    strideCategory: "ELEVATION_OF_PRIVILEGE",
    severity: "HIGH",
    attackVector:
      "Package namespace becomes available after maintainer abandons it",
    mitigation:
      "Monitor dependency health, replace abandoned packages, check last publish date",
    references: ["CWE-1104"],
  },
  {
    name: "Build pipeline poisoning",
    description:
      "CI/CD pipeline runs malicious code from compromised build dependency",
    strideCategory: "TAMPERING",
    severity: "CRITICAL",
    attackVector: "Compromised build tool, CI action, or post-install script",
    mitigation:
      "Pin CI action versions by SHA, restrict network in CI, review post-install scripts",
    references: ["CWE-829", "MITRE T1195.002"],
  },
];

const SUPPLY_CHAIN_THREATS: Record<string, SupplyChainThreat[]> = {
  npm: [
    ...COMMON_SUPPLY_CHAIN,
    {
      name: "Malicious postinstall script",
      description:
        "npm package runs arbitrary code during install via postinstall hook",
      strideCategory: "TAMPERING",
      severity: "CRITICAL",
      attackVector: "postinstall/preinstall lifecycle scripts",
      mitigation:
        "Use --ignore-scripts, audit lifecycle scripts, use npm audit signatures",
      references: ["CWE-829"],
    },
    {
      name: "Prototype pollution via dependency",
      description:
        "npm package contains prototype pollution vulnerability affecting all consumers",
      strideCategory: "TAMPERING",
      severity: "HIGH",
      attackVector:
        "Object.__proto__ manipulation through vulnerable dependency",
      mitigation:
        "Use Object.create(null), freeze prototypes, audit with npm audit",
      references: ["CWE-1321"],
    },
  ],
  pypi: [
    ...COMMON_SUPPLY_CHAIN,
    {
      name: "Typosquatting on PyPI",
      description:
        "Attacker registers package with similar name to popular package (e.g., reqeusts vs requests)",
      strideCategory: "TAMPERING",
      severity: "HIGH",
      attackVector: "Developer typo during pip install",
      mitigation:
        "Use requirements.txt with pinned versions, verify package names, use pip audit",
      references: ["CWE-829"],
    },
  ],
  cargo: [
    ...COMMON_SUPPLY_CHAIN,
    {
      name: "Unsafe Rust code in dependency",
      description:
        "Cargo dependency uses unsafe blocks that bypass Rust's memory safety",
      strideCategory: "TAMPERING",
      severity: "MEDIUM",
      attackVector: "unsafe {} blocks in transitive dependencies",
      mitigation: "Use cargo-geiger to audit unsafe code, cargo-audit for CVEs",
      references: ["CWE-119"],
    },
  ],
  docker: [
    ...COMMON_SUPPLY_CHAIN,
    {
      name: "Vulnerable base image",
      description: "Docker base image contains known CVEs in OS packages",
      strideCategory: "TAMPERING",
      severity: "HIGH",
      attackVector: "Outdated base image with unpatched vulnerabilities",
      mitigation:
        "Use distroless/alpine, scan with Trivy, pin image by digest not tag",
      references: ["CWE-1104"],
    },
    {
      name: "Image tag mutation",
      description:
        "Docker image tag (e.g., :latest) points to different content after rebuild",
      strideCategory: "TAMPERING",
      severity: "MEDIUM",
      attackVector: "Tag reuse after image rebuild with different content",
      mitigation: "Pin by digest (sha256:...) not tag, use signed images",
      references: ["CWE-494"],
    },
  ],
  maven: [
    ...COMMON_SUPPLY_CHAIN,
    {
      name: "Central repository MITM",
      description:
        "Attacker intercepts Maven Central downloads to inject malicious artifacts",
      strideCategory: "TAMPERING",
      severity: "HIGH",
      attackVector: "HTTP download interception (if not using HTTPS)",
      mitigation:
        "Use HTTPS for all repositories, verify artifact signatures, use dependency lock",
      references: ["CWE-494"],
    },
  ],
  "github-action": [
    ...COMMON_SUPPLY_CHAIN,
    {
      name: "Mutable action tag exploitation",
      description:
        "GitHub Action referenced by mutable tag (v1) changed to malicious version",
      strideCategory: "TAMPERING",
      severity: "CRITICAL",
      attackVector:
        "Action maintainer (or compromised account) updates tag to malicious commit",
      mitigation:
        "Pin actions by full SHA, not version tag: uses: actions/checkout@abc123",
      references: ["CWE-829"],
    },
    {
      name: "Workflow injection via pull_request_target",
      description:
        "Malicious PR triggers workflow with write permissions via pull_request_target",
      strideCategory: "ELEVATION_OF_PRIVILEGE",
      severity: "CRITICAL",
      attackVector: "Pull request from fork runs privileged workflow",
      mitigation:
        "Never use pull_request_target with checkout of PR code, restrict permissions",
      references: ["CWE-863"],
    },
  ],
};

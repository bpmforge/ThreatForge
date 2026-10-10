/**
 * STRIDE Analyzer
 *
 * Systematically analyzes a threat model's components and data flows
 * to auto-generate STRIDE threats. Unlike AI suggestions (per-component),
 * this analyzes the FULL model structure — data flows, trust boundaries,
 * and component interactions.
 *
 * Works WITHOUT an LLM — uses rule-based STRIDE mapping.
 * Can be enhanced WITH an LLM for more specific threats.
 */

interface AnalysisComponent {
  id: string;
  name: string;
  type: string;
  trustLevel?: string;
  dataClassification?: string;
}

interface AnalysisConnection {
  id: string;
  source: string;
  target: string;
  protocol?: string;
  encrypted?: boolean;
  authMethod?: string;
}

interface AnalysisBoundary {
  id: string;
  name: string;
  componentIds: string[];
}

export interface GeneratedThreat {
  name: string;
  description: string;
  strideCategory: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  componentId: string;
  connectionId?: string;
  evidence: string;
}

interface ModelInput {
  components: AnalysisComponent[];
  connections: AnalysisConnection[];
  boundaries: AnalysisBoundary[];
}

/**
 * Analyze a full threat model and generate STRIDE threats.
 * Returns threats based on component types, data flows, and trust boundary crossings.
 */
export function analyzeModel(model: ModelInput): GeneratedThreat[] {
  const threats: GeneratedThreat[] = [];
  const componentMap = new Map(model.components.map((c) => [c.id, c]));

  // Phase 1: Per-component threats based on type
  for (const component of model.components) {
    threats.push(...analyzeComponent(component));
  }

  // Phase 2: Per-connection threats based on data flow
  for (const connection of model.connections) {
    const source = componentMap.get(connection.source);
    const target = componentMap.get(connection.target);
    if (source && target) {
      threats.push(...analyzeConnection(connection, source, target));
    }
  }

  // Phase 3: Trust boundary crossing threats
  for (const connection of model.connections) {
    const source = componentMap.get(connection.source);
    const target = componentMap.get(connection.target);
    if (source && target) {
      threats.push(
        ...analyzeBoundaryCrossing(
          connection,
          source,
          target,
          model.boundaries,
        ),
      );
    }
  }

  // Deduplicate
  const seen = new Set<string>();
  return threats.filter((t) => {
    const key = `${t.strideCategory}:${t.componentId}:${t.name}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// =============================================================================
// Component-Level Analysis
// =============================================================================

const COMPONENT_THREATS: Record<
  string,
  Array<{
    name: string;
    stride: string;
    severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
    description: string;
  }>
> = {
  DATABASE: [
    {
      name: "SQL/NoSQL injection",
      stride: "TAMPERING",
      severity: "CRITICAL",
      description: "Attacker manipulates queries to read/modify/delete data",
    },
    {
      name: "Unauthorized data access",
      stride: "INFORMATION_DISCLOSURE",
      severity: "HIGH",
      description: "User accesses data they shouldn't have permission to view",
    },
    {
      name: "Data loss without backup",
      stride: "DENIAL_OF_SERVICE",
      severity: "HIGH",
      description: "Database failure or corruption without recovery capability",
    },
    {
      name: "Missing audit trail",
      stride: "REPUDIATION",
      severity: "MEDIUM",
      description: "No logging of who accessed or modified data",
    },
  ],
  API: [
    {
      name: "Missing authentication",
      stride: "SPOOFING",
      severity: "CRITICAL",
      description: "Endpoint accessible without verifying caller identity",
    },
    {
      name: "Missing authorization",
      stride: "ELEVATION_OF_PRIVILEGE",
      severity: "HIGH",
      description:
        "Authenticated user accesses resources beyond their permissions",
    },
    {
      name: "Input validation bypass",
      stride: "TAMPERING",
      severity: "HIGH",
      description: "Malicious input accepted and processed",
    },
    {
      name: "Rate limiting absent",
      stride: "DENIAL_OF_SERVICE",
      severity: "MEDIUM",
      description: "No protection against request flooding",
    },
    {
      name: "Sensitive data in response",
      stride: "INFORMATION_DISCLOSURE",
      severity: "HIGH",
      description:
        "API returns more data than necessary (passwords, tokens, PII)",
    },
  ],
  API_GATEWAY: [
    {
      name: "Gateway bypass",
      stride: "ELEVATION_OF_PRIVILEGE",
      severity: "CRITICAL",
      description:
        "Attacker reaches backend services directly, bypassing gateway auth/rate limiting",
    },
    {
      name: "Token relay without validation",
      stride: "SPOOFING",
      severity: "HIGH",
      description: "Gateway forwards tokens without verifying them",
    },
  ],
  WEB_APP: [
    {
      name: "Cross-site scripting (XSS)",
      stride: "TAMPERING",
      severity: "HIGH",
      description:
        "Attacker injects JavaScript executed in other users' browsers",
    },
    {
      name: "CSRF attack",
      stride: "SPOOFING",
      severity: "MEDIUM",
      description:
        "Attacker tricks authenticated user into making unintended requests",
    },
    {
      name: "Sensitive data in client storage",
      stride: "INFORMATION_DISCLOSURE",
      severity: "MEDIUM",
      description:
        "Tokens, PII, or secrets stored in localStorage/cookies without protection",
    },
  ],
  MOBILE_APP: [
    {
      name: "Insecure local storage",
      stride: "INFORMATION_DISCLOSURE",
      severity: "HIGH",
      description: "Sensitive data stored unencrypted on device",
    },
    {
      name: "Certificate pinning bypass",
      stride: "TAMPERING",
      severity: "HIGH",
      description: "MITM attack intercepts HTTPS traffic",
    },
    {
      name: "APK/IPA reverse engineering",
      stride: "INFORMATION_DISCLOSURE",
      severity: "MEDIUM",
      description: "Secrets or logic extracted from decompiled app binary",
    },
  ],
  AUTH_SERVICE: [
    {
      name: "Credential stuffing",
      stride: "SPOOFING",
      severity: "HIGH",
      description: "Attacker uses leaked credentials from other breaches",
    },
    {
      name: "Weak password policy",
      stride: "SPOOFING",
      severity: "MEDIUM",
      description: "Passwords don't meet complexity/length requirements",
    },
    {
      name: "Session fixation",
      stride: "SPOOFING",
      severity: "HIGH",
      description: "Attacker sets a known session ID before authentication",
    },
    {
      name: "Token not rotated",
      stride: "SPOOFING",
      severity: "MEDIUM",
      description:
        "Refresh tokens not rotated, allowing long-term impersonation if stolen",
    },
  ],
  CACHE: [
    {
      name: "Cache poisoning",
      stride: "TAMPERING",
      severity: "HIGH",
      description: "Attacker injects malicious data into cache",
    },
    {
      name: "Stale sensitive data",
      stride: "INFORMATION_DISCLOSURE",
      severity: "MEDIUM",
      description: "Cached data outlives its sensitivity period",
    },
  ],
  QUEUE: [
    {
      name: "Message injection",
      stride: "TAMPERING",
      severity: "HIGH",
      description: "Unauthorized messages injected into queue",
    },
    {
      name: "Message replay",
      stride: "SPOOFING",
      severity: "MEDIUM",
      description: "Attacker replays previously valid messages",
    },
  ],
  OBJECT_STORAGE: [
    {
      name: "Public bucket exposure",
      stride: "INFORMATION_DISCLOSURE",
      severity: "CRITICAL",
      description:
        "Storage bucket accessible from public internet without auth",
    },
    {
      name: "Missing encryption at rest",
      stride: "INFORMATION_DISCLOSURE",
      severity: "HIGH",
      description: "Data stored unencrypted on disk",
    },
  ],
  SERVERLESS: [
    {
      name: "Over-permissioned IAM role",
      stride: "ELEVATION_OF_PRIVILEGE",
      severity: "HIGH",
      description: "Function has broader permissions than needed",
    },
    {
      name: "Event injection",
      stride: "TAMPERING",
      severity: "MEDIUM",
      description: "Attacker crafts malicious event payloads",
    },
  ],
  CONTAINER: [
    {
      name: "Container escape",
      stride: "ELEVATION_OF_PRIVILEGE",
      severity: "CRITICAL",
      description: "Attacker breaks out of container to access host",
    },
    {
      name: "Vulnerable base image",
      stride: "TAMPERING",
      severity: "HIGH",
      description: "Base image contains known CVEs",
    },
  ],
  KUBERNETES: [
    {
      name: "RBAC misconfiguration",
      stride: "ELEVATION_OF_PRIVILEGE",
      severity: "HIGH",
      description:
        "Overly permissive Kubernetes RBAC allows unauthorized actions",
    },
    {
      name: "Pod-to-pod lateral movement",
      stride: "ELEVATION_OF_PRIVILEGE",
      severity: "HIGH",
      description: "Compromised pod accesses other pods via network",
    },
  ],
  EXTERNAL_USER: [
    {
      name: "Phishing attack",
      stride: "SPOOFING",
      severity: "MEDIUM",
      description: "Attacker impersonates the system to steal user credentials",
    },
  ],
};

function analyzeComponent(component: AnalysisComponent): GeneratedThreat[] {
  const typeKey = component.type.toUpperCase().replace(/[-\s]/g, "_");
  const rules = COMPONENT_THREATS[typeKey] || [];

  return rules.map((rule) => ({
    name: rule.name,
    description: `${rule.description} — affects ${component.name}`,
    strideCategory: rule.stride,
    severity: rule.severity,
    componentId: component.id,
    evidence: `Component type: ${component.type}. STRIDE category: ${rule.stride}`,
  }));
}

// =============================================================================
// Connection-Level Analysis
// =============================================================================

function analyzeConnection(
  connection: AnalysisConnection,
  source: AnalysisComponent,
  target: AnalysisComponent,
): GeneratedThreat[] {
  const threats: GeneratedThreat[] = [];

  // Unencrypted data flow
  if (!connection.encrypted) {
    threats.push({
      name: `Unencrypted data flow: ${source.name} → ${target.name}`,
      description: `Data transmitted without encryption between ${source.name} and ${target.name} via ${connection.protocol || "unknown protocol"}`,
      strideCategory: "INFORMATION_DISCLOSURE",
      severity: "HIGH",
      componentId: source.id,
      connectionId: connection.id,
      evidence: `Connection ${connection.id}: encrypted=false, protocol=${connection.protocol}`,
    });
  }

  // No authentication on connection
  if (!connection.authMethod || connection.authMethod === "NONE") {
    threats.push({
      name: `Unauthenticated access: ${source.name} → ${target.name}`,
      description: `No authentication required for communication between ${source.name} and ${target.name}`,
      strideCategory: "SPOOFING",
      severity: "HIGH",
      componentId: target.id,
      connectionId: connection.id,
      evidence: `Connection ${connection.id}: authMethod=${connection.authMethod || "NONE"}`,
    });
  }

  return threats;
}

// =============================================================================
// Trust Boundary Analysis
// =============================================================================

function analyzeBoundaryCrossing(
  connection: AnalysisConnection,
  source: AnalysisComponent,
  target: AnalysisComponent,
  boundaries: AnalysisBoundary[],
): GeneratedThreat[] {
  // Find which boundaries each component belongs to
  const sourceBoundary = boundaries.find((b) =>
    b.componentIds.includes(source.id),
  );
  const targetBoundary = boundaries.find((b) =>
    b.componentIds.includes(target.id),
  );

  // If they're in different boundaries (or one has no boundary), it's a crossing
  if (sourceBoundary?.id !== targetBoundary?.id) {
    const crossingDesc = `${sourceBoundary?.name || "no boundary"} → ${targetBoundary?.name || "no boundary"}`;

    return [
      {
        name: `Trust boundary crossing: ${source.name} → ${target.name}`,
        description: `Data crosses trust boundary (${crossingDesc}). All data crossing trust boundaries must be validated, authenticated, and encrypted.`,
        strideCategory: "TAMPERING",
        severity: "HIGH",
        componentId: target.id,
        connectionId: connection.id,
        evidence: `Boundary crossing: ${crossingDesc}. Connection: ${connection.protocol || "unknown"}, encrypted: ${connection.encrypted ?? "unknown"}`,
      },
    ];
  }

  return [];
}

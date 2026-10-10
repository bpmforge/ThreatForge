/**
 * Seed data for E2E tests
 *
 * Provides sample canvas data with nodes, edges, and threats
 * for testing authenticated features that require existing data.
 */

/** Sample canvas state with a web application architecture */
export const sampleCanvasState = {
  nodes: [
    {
      id: "user-1",
      type: "component",
      position: { x: 100, y: 200 },
      data: {
        label: "Web Browser",
        componentType: "EXTERNAL_ENTITY",
        trustLevel: "PUBLIC",
        description: "End user browser",
        technologies: ["Chrome", "Firefox", "Safari"],
      },
    },
    {
      id: "api-1",
      type: "component",
      position: { x: 400, y: 200 },
      data: {
        label: "API Gateway",
        componentType: "API",
        trustLevel: "INTERNAL",
        description: "REST API endpoint",
        technologies: ["Node.js", "Express"],
      },
    },
    {
      id: "service-1",
      type: "component",
      position: { x: 700, y: 150 },
      data: {
        label: "Auth Service",
        componentType: "SERVICE",
        trustLevel: "INTERNAL",
        description: "Authentication microservice",
        technologies: ["Node.js", "JWT"],
      },
    },
    {
      id: "service-2",
      type: "component",
      position: { x: 700, y: 300 },
      data: {
        label: "Business Logic",
        componentType: "SERVICE",
        trustLevel: "INTERNAL",
        description: "Core business logic service",
        technologies: ["Node.js"],
      },
    },
    {
      id: "db-1",
      type: "component",
      position: { x: 1000, y: 200 },
      data: {
        label: "PostgreSQL",
        componentType: "DATABASE",
        trustLevel: "RESTRICTED",
        description: "Primary database",
        technologies: ["PostgreSQL 17"],
      },
    },
    {
      id: "boundary-1",
      type: "boundary",
      position: { x: 350, y: 100 },
      data: {
        label: "DMZ",
        description: "Demilitarized zone",
      },
      style: { width: 200, height: 250 },
    },
    {
      id: "boundary-2",
      type: "boundary",
      position: { x: 650, y: 100 },
      data: {
        label: "Internal Network",
        description: "Protected internal services",
      },
      style: { width: 450, height: 300 },
    },
  ],
  edges: [
    {
      id: "edge-1",
      source: "user-1",
      target: "api-1",
      data: {
        label: "HTTPS",
        protocol: "HTTPS",
        encrypted: true,
        authenticated: false,
      },
    },
    {
      id: "edge-2",
      source: "api-1",
      target: "service-1",
      data: {
        label: "gRPC",
        protocol: "gRPC",
        encrypted: true,
        authenticated: true,
      },
    },
    {
      id: "edge-3",
      source: "api-1",
      target: "service-2",
      data: {
        label: "gRPC",
        protocol: "gRPC",
        encrypted: true,
        authenticated: true,
      },
    },
    {
      id: "edge-4",
      source: "service-1",
      target: "db-1",
      data: {
        label: "PostgreSQL",
        protocol: "PostgreSQL",
        encrypted: true,
        authenticated: true,
      },
    },
    {
      id: "edge-5",
      source: "service-2",
      target: "db-1",
      data: {
        label: "PostgreSQL",
        protocol: "PostgreSQL",
        encrypted: true,
        authenticated: true,
      },
    },
  ],
  viewport: { x: 0, y: 0, zoom: 1 },
};

/** Sample threats for the model */
export const sampleThreats = [
  {
    name: "SQL Injection",
    description: "Attacker could inject malicious SQL through API inputs",
    category: "TAMPERING",
    severity: "HIGH",
    status: "OPEN",
    componentId: "api-1",
  },
  {
    name: "Credential Stuffing",
    description: "Automated login attempts using leaked credentials",
    category: "SPOOFING",
    severity: "MEDIUM",
    status: "OPEN",
    componentId: "service-1",
  },
  {
    name: "Data Breach",
    description: "Unauthorized access to sensitive user data",
    category: "INFO_DISCLOSURE",
    severity: "CRITICAL",
    status: "MITIGATED",
    componentId: "db-1",
  },
];

/** Create a model with seed data via API */
export async function createSeededModel(
  baseUrl: string,
  authCookie: string,
  modelName = "E2E Test Model",
): Promise<{ id: string; name: string }> {
  const response = await fetch(`${baseUrl}/api/threat-models`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: authCookie,
    },
    body: JSON.stringify({
      name: modelName,
      description: "Test model with sample architecture",
      canvasState: JSON.stringify(sampleCanvasState),
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to create model: ${response.status}`);
  }

  return response.json();
}

/** Create threats for a model via API */
export async function createSeededThreats(
  baseUrl: string,
  authCookie: string,
  modelId: string,
): Promise<void> {
  for (const threat of sampleThreats) {
    const response = await fetch(
      `${baseUrl}/api/threat-models/${modelId}/threats`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: authCookie,
        },
        body: JSON.stringify(threat),
      },
    );

    if (!response.ok) {
      console.warn(`Failed to create threat: ${response.status}`);
    }
  }
}

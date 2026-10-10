/**
 * Attack Surface Analysis Service
 *
 * Enumerates interfaces from threat models and calculates risk scores.
 */

import { getPrisma } from "../../db.js";
import {
  calculateCVSS31,
  estimateCVSSFromInterface,
} from "./cvss-calculator.js";
import type {
  AttackSurfaceAnalysis,
  AttackSurfaceComponent,
  AttackSurfaceInterface,
  InterfaceType,
  AuthLevel,
  DataSensitivity,
  NetworkExposure,
} from "./types.js";

/**
 * Analyze the attack surface of a threat model.
 */
export async function analyzeAttackSurface(
  modelId: string,
): Promise<AttackSurfaceAnalysis> {
  const prisma = await getPrisma();

  // Fetch threat model with all components and threats
  const model = await prisma.threatModel.findUnique({
    where: { id: modelId },
    include: {
      threats: {
        include: {
          mitigations: true,
        },
      },
    },
  });

  if (!model) {
    throw new Error(`Threat model not found: ${modelId}`);
  }

  // Parse canvas state to get components
  let canvasState: { nodes?: unknown[]; edges?: unknown[] } = {
    nodes: [],
    edges: [],
  };
  try {
    canvasState = JSON.parse(model.canvasState);
  } catch {
    // Invalid canvas state
  }

  const nodes = (canvasState.nodes || []) as Array<{
    id: string;
    type?: string;
    data?: {
      label?: string;
      name?: string;
      description?: string;
      componentType?: string;
      properties?: Record<string, unknown>;
    };
  }>;

  // Analyze each component
  const components: AttackSurfaceComponent[] = [];

  for (const node of nodes) {
    if (
      node.type === "component" ||
      node.type === "process" ||
      node.type === "dataStore" ||
      node.type === "externalEntity"
    ) {
      const component = await analyzeComponent(node, model.threats);
      components.push(component);
    }
  }

  // Calculate summary statistics
  const totalInterfaces = components.reduce(
    (sum, c) => sum + c.totalInterfaces,
    0,
  );
  const exposedInterfaces = components.reduce(
    (sum, c) => sum + c.exposedInterfaces,
    0,
  );
  const highRiskInterfaces = components.reduce(
    (sum, c) => sum + c.highRiskInterfaces,
    0,
  );
  const totalThreats = model.threats.length;
  const mitigatedThreats = model.threats.filter(
    (t) =>
      t.status === "MITIGATED" ||
      t.mitigations.some((m) => m.status === "IMPLEMENTED"),
  ).length;

  // Calculate risk distribution
  const riskDistribution = calculateRiskDistribution(components);

  // Calculate exposure matrix
  const exposureMatrix = calculateExposureMatrix(components);

  // Calculate average risk score
  const averageRiskScore =
    components.length > 0
      ? components.reduce((sum, c) => sum + c.riskScore, 0) / components.length
      : 0;

  return {
    modelId,
    modelName: model.name,
    analyzedAt: new Date().toISOString(),
    summary: {
      totalComponents: components.length,
      totalInterfaces,
      internetFacing: exposedInterfaces,
      highRisk: highRiskInterfaces,
      mediumRisk:
        totalInterfaces -
        highRiskInterfaces -
        Math.floor(totalInterfaces * 0.3),
      lowRisk: Math.floor(totalInterfaces * 0.3),
      totalThreats,
      mitigatedThreats,
      coveragePercentage:
        totalThreats > 0
          ? Math.round((mitigatedThreats / totalThreats) * 100)
          : 100,
      averageRiskScore: Math.round(averageRiskScore * 10) / 10,
    },
    components,
    riskDistribution,
    exposureMatrix,
  };
}

/**
 * Analyze a single component for attack surface.
 */
async function analyzeComponent(
  node: {
    id: string;
    type?: string;
    data?: {
      label?: string;
      name?: string;
      description?: string;
      componentType?: string;
      properties?: Record<string, unknown>;
    };
  },
  threats: Array<{
    id: string;
    componentNodeId?: string | null;
    status: string;
    severity: string;
    mitigations: Array<{ status: string }>;
  }>,
): Promise<AttackSurfaceComponent> {
  const data = node.data || {};
  const componentName = data.label || data.name || "Unknown Component";
  const componentType = data.componentType || node.type || "component";
  const properties = data.properties || {};

  // Extract interfaces from component properties
  const interfaces = extractInterfaces(
    node.id,
    componentName,
    componentType,
    properties,
  );

  // Get threats for this component
  const componentThreats = threats.filter((t) => t.componentNodeId === node.id);
  const threatCount = componentThreats.length;
  const mitigatedThreatCount = componentThreats.filter(
    (t) =>
      t.status === "MITIGATED" ||
      t.mitigations.some((m) => m.status === "IMPLEMENTED"),
  ).length;

  // Update interfaces with threat counts
  for (const iface of interfaces) {
    iface.threatCount = Math.floor(
      threatCount / Math.max(interfaces.length, 1),
    );
    iface.mitigatedThreatCount = Math.floor(
      mitigatedThreatCount / Math.max(interfaces.length, 1),
    );
  }

  // Calculate component risk score
  const riskScore = calculateComponentRiskScore(
    interfaces,
    threatCount,
    mitigatedThreatCount,
  );

  return {
    id: node.id,
    name: componentName,
    type: componentType,
    description: data.description,
    interfaces,
    totalInterfaces: interfaces.length,
    exposedInterfaces: interfaces.filter(
      (i) =>
        i.networkExposure === "INTERNET_FACING" ||
        i.networkExposure === "PUBLIC_CLOUD",
    ).length,
    highRiskInterfaces: interfaces.filter((i) => (i.cvssBase || 0) >= 7.0)
      .length,
    threatCount,
    mitigatedThreatCount,
    riskScore,
  };
}

/**
 * Extract interfaces from component properties.
 */
function extractInterfaces(
  componentId: string,
  componentName: string,
  componentType: string,
  properties: Record<string, unknown>,
): AttackSurfaceInterface[] {
  const interfaces: AttackSurfaceInterface[] = [];

  // Detect interface type based on component type and properties
  const detectedType = detectInterfaceType(componentType, properties);
  const authLevel = detectAuthLevel(properties);
  const sensitivity = detectDataSensitivity(properties);
  const exposure = detectNetworkExposure(properties);

  // Create primary interface
  const primaryInterface: AttackSurfaceInterface = {
    id: `${componentId}-primary`,
    componentId,
    componentName,
    type: detectedType,
    name: `${componentName} Primary Interface`,
    protocol: getProtocolForType(detectedType),
    port: getDefaultPortForType(detectedType),
    authLevel,
    dataFlow: "BIDIRECTIONAL",
    dataSensitivity: sensitivity,
    networkExposure: exposure,
    threatCount: 0,
    mitigatedThreatCount: 0,
  };

  // Calculate CVSS for interface
  const cvssVector = estimateCVSSFromInterface({
    networkExposure: exposure,
    authLevel,
    dataSensitivity: sensitivity,
    dataFlow: "BIDIRECTIONAL",
  });
  const cvssResult = calculateCVSS31(cvssVector);
  primaryInterface.cvssBase = cvssResult.baseScore;

  interfaces.push(primaryInterface);

  // Add additional interfaces based on properties
  if (properties.hasApi || properties.exposeApi) {
    interfaces.push(
      createInterface(componentId, componentName, "HTTP_API", properties),
    );
  }
  if (properties.hasDatabase || componentType === "dataStore") {
    interfaces.push(
      createInterface(componentId, componentName, "DATABASE", properties),
    );
  }
  if (properties.hasWebSocket || properties.realtime) {
    interfaces.push(
      createInterface(componentId, componentName, "WEBSOCKET", properties),
    );
  }

  return interfaces;
}

/**
 * Create an interface entry.
 */
function createInterface(
  componentId: string,
  componentName: string,
  type: InterfaceType,
  properties: Record<string, unknown>,
): AttackSurfaceInterface {
  const authLevel = detectAuthLevel(properties);
  const sensitivity = detectDataSensitivity(properties);
  const exposure = detectNetworkExposure(properties);

  const cvssVector = estimateCVSSFromInterface({
    networkExposure: exposure,
    authLevel,
    dataSensitivity: sensitivity,
    dataFlow: "BIDIRECTIONAL",
  });
  const cvssResult = calculateCVSS31(cvssVector);

  return {
    id: `${componentId}-${type.toLowerCase()}`,
    componentId,
    componentName,
    type,
    name: `${componentName} ${type.replace("_", " ")}`,
    protocol: getProtocolForType(type),
    port: getDefaultPortForType(type),
    authLevel,
    dataFlow: "BIDIRECTIONAL",
    dataSensitivity: sensitivity,
    networkExposure: exposure,
    threatCount: 0,
    mitigatedThreatCount: 0,
    cvssBase: cvssResult.baseScore,
  };
}

/**
 * Detect interface type from component type and properties.
 */
function detectInterfaceType(
  componentType: string,
  properties: Record<string, unknown>,
): InterfaceType {
  const typeMap: Record<string, InterfaceType> = {
    api: "HTTP_API",
    service: "HTTP_API",
    microservice: "HTTP_API",
    database: "DATABASE",
    dataStore: "DATABASE",
    queue: "MESSAGE_QUEUE",
    messageQueue: "MESSAGE_QUEUE",
    storage: "FILE_STORAGE",
    external: "EXTERNAL_SERVICE",
    externalEntity: "EXTERNAL_SERVICE",
    frontend: "USER_INTERFACE",
    ui: "USER_INTERFACE",
    webApp: "USER_INTERFACE",
  };

  // Check properties first
  if (properties.interfaceType) {
    return properties.interfaceType as InterfaceType;
  }
  if (properties.protocol === "grpc") return "GRPC_API";
  if (properties.protocol === "graphql") return "GRAPHQL_API";
  if (properties.protocol === "websocket") return "WEBSOCKET";

  return typeMap[componentType] || "OTHER";
}

/**
 * Detect authentication level from properties.
 */
function detectAuthLevel(properties: Record<string, unknown>): AuthLevel {
  if (properties.authLevel) return properties.authLevel as AuthLevel;
  if (properties.mfa || properties.multiFactorAuth) return "MULTI_FACTOR";
  if (properties.oauth || properties.oauth2) return "OAUTH2";
  if (properties.mtls || properties.mutualTls) return "MUTUAL_TLS";
  if (properties.certificate || properties.certAuth) return "CERTIFICATE";
  if (properties.apiKey) return "API_KEY";
  if (properties.basicAuth) return "BASIC";
  if (properties.noAuth || properties.public) return "NONE";
  return "API_KEY"; // Default assumption
}

/**
 * Detect data sensitivity from properties.
 */
function detectDataSensitivity(
  properties: Record<string, unknown>,
): DataSensitivity {
  if (properties.dataSensitivity)
    return properties.dataSensitivity as DataSensitivity;
  if (properties.pii || properties.phi || properties.pci) return "RESTRICTED";
  if (properties.sensitive || properties.confidential) return "CONFIDENTIAL";
  if (properties.internal) return "INTERNAL";
  if (properties.public) return "PUBLIC";
  return "INTERNAL"; // Default assumption
}

/**
 * Detect network exposure from properties.
 */
function detectNetworkExposure(
  properties: Record<string, unknown>,
): NetworkExposure {
  if (properties.networkExposure)
    return properties.networkExposure as NetworkExposure;
  if (properties.internetFacing || properties.public) return "INTERNET_FACING";
  if (properties.publicCloud || properties.cloud) return "PUBLIC_CLOUD";
  if (properties.privateCloud) return "PRIVATE_CLOUD";
  if (properties.vpn || properties.vpnProtected) return "VPN_PROTECTED";
  if (properties.internal || properties.internalOnly) return "INTERNAL_ONLY";
  return "PRIVATE_CLOUD"; // Default assumption
}

/**
 * Get protocol for interface type.
 */
function getProtocolForType(type: InterfaceType): string {
  const protocols: Record<InterfaceType, string> = {
    HTTP_API: "HTTPS",
    GRPC_API: "gRPC",
    GRAPHQL_API: "GraphQL over HTTPS",
    WEBSOCKET: "WSS",
    DATABASE: "Database Protocol",
    MESSAGE_QUEUE: "AMQP",
    FILE_STORAGE: "HTTPS/S3",
    EXTERNAL_SERVICE: "HTTPS",
    USER_INTERFACE: "HTTPS",
    NETWORK_PORT: "TCP/UDP",
    IPC: "IPC",
    OTHER: "Unknown",
  };
  return protocols[type];
}

/**
 * Get default port for interface type.
 */
function getDefaultPortForType(type: InterfaceType): number | undefined {
  const ports: Partial<Record<InterfaceType, number>> = {
    HTTP_API: 443,
    GRPC_API: 443,
    GRAPHQL_API: 443,
    WEBSOCKET: 443,
    DATABASE: 5432,
    MESSAGE_QUEUE: 5672,
    FILE_STORAGE: 443,
    USER_INTERFACE: 443,
  };
  return ports[type];
}

/**
 * Calculate component risk score.
 */
function calculateComponentRiskScore(
  interfaces: AttackSurfaceInterface[],
  threatCount: number,
  mitigatedThreatCount: number,
): number {
  if (interfaces.length === 0) return 0;

  // Average CVSS score
  const avgCvss =
    interfaces.reduce((sum, i) => sum + (i.cvssBase || 0), 0) /
    interfaces.length;

  // Threat mitigation factor (0.5 if all mitigated, 1.5 if none)
  const mitigationFactor =
    threatCount > 0 ? 0.5 + (1 - mitigatedThreatCount / threatCount) : 1;

  // Exposure factor
  const exposedCount = interfaces.filter(
    (i) =>
      i.networkExposure === "INTERNET_FACING" ||
      i.networkExposure === "PUBLIC_CLOUD",
  ).length;
  const exposureFactor = 1 + (exposedCount / interfaces.length) * 0.5;

  return Math.min(10, avgCvss * mitigationFactor * exposureFactor);
}

/**
 * Calculate risk distribution across components.
 */
function calculateRiskDistribution(
  components: AttackSurfaceComponent[],
): AttackSurfaceAnalysis["riskDistribution"] {
  let critical = 0;
  let high = 0;
  let medium = 0;
  let low = 0;
  let info = 0;

  for (const component of components) {
    for (const iface of component.interfaces) {
      const score = iface.cvssBase || 0;
      if (score >= 9.0) critical++;
      else if (score >= 7.0) high++;
      else if (score >= 4.0) medium++;
      else if (score > 0) low++;
      else info++;
    }
  }

  return { critical, high, medium, low, info };
}

/**
 * Calculate exposure matrix.
 */
function calculateExposureMatrix(
  components: AttackSurfaceComponent[],
): AttackSurfaceAnalysis["exposureMatrix"] {
  const matrix = new Map<string, { count: number; totalRisk: number }>();

  for (const component of components) {
    for (const iface of component.interfaces) {
      const key = `${iface.type}|${iface.networkExposure}`;
      const current = matrix.get(key) || { count: 0, totalRisk: 0 };
      current.count++;
      current.totalRisk += iface.cvssBase || 0;
      matrix.set(key, current);
    }
  }

  return Array.from(matrix.entries()).map(([key, value]) => {
    const [interfaceType, exposure] = key.split("|");
    return {
      interfaceType: interfaceType as InterfaceType,
      exposure: exposure as NetworkExposure,
      count: value.count,
      avgRiskScore: Math.round((value.totalRisk / value.count) * 10) / 10,
    };
  });
}

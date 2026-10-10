/**
 * Attack Surface Analysis Types
 *
 * Definitions for attack surface enumeration and CVSS mapping.
 */

/** Component interface types detected in threat models */
export type InterfaceType =
  | "HTTP_API"
  | "GRPC_API"
  | "GRAPHQL_API"
  | "WEBSOCKET"
  | "DATABASE"
  | "MESSAGE_QUEUE"
  | "FILE_STORAGE"
  | "EXTERNAL_SERVICE"
  | "USER_INTERFACE"
  | "NETWORK_PORT"
  | "IPC"
  | "OTHER";

/** Authentication levels for interfaces */
export type AuthLevel =
  | "NONE"
  | "API_KEY"
  | "BASIC"
  | "OAUTH2"
  | "MUTUAL_TLS"
  | "CERTIFICATE"
  | "MULTI_FACTOR";

/** Data sensitivity levels */
export type DataSensitivity =
  | "PUBLIC"
  | "INTERNAL"
  | "CONFIDENTIAL"
  | "RESTRICTED"
  | "CRITICAL";

/** Network exposure levels */
export type NetworkExposure =
  | "INTERNAL_ONLY"
  | "VPN_PROTECTED"
  | "PRIVATE_CLOUD"
  | "PUBLIC_CLOUD"
  | "INTERNET_FACING";

/** Attack surface interface */
export interface AttackSurfaceInterface {
  id: string;
  componentId: string;
  componentName: string;
  type: InterfaceType;
  name: string;
  description?: string;
  protocol?: string;
  port?: number;
  path?: string;
  authLevel: AuthLevel;
  dataFlow: "IN" | "OUT" | "BIDIRECTIONAL";
  dataSensitivity: DataSensitivity;
  networkExposure: NetworkExposure;
  threatCount: number;
  mitigatedThreatCount: number;
  cvssBase?: number;
}

/** Attack surface component summary */
export interface AttackSurfaceComponent {
  id: string;
  name: string;
  type: string;
  description?: string;
  interfaces: AttackSurfaceInterface[];
  totalInterfaces: number;
  exposedInterfaces: number;
  highRiskInterfaces: number;
  threatCount: number;
  mitigatedThreatCount: number;
  riskScore: number;
}

/** Overall attack surface analysis */
export interface AttackSurfaceAnalysis {
  modelId: string;
  modelName: string;
  analyzedAt: string;
  summary: {
    totalComponents: number;
    totalInterfaces: number;
    internetFacing: number;
    highRisk: number;
    mediumRisk: number;
    lowRisk: number;
    totalThreats: number;
    mitigatedThreats: number;
    coveragePercentage: number;
    averageRiskScore: number;
  };
  components: AttackSurfaceComponent[];
  riskDistribution: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
  };
  exposureMatrix: {
    interfaceType: InterfaceType;
    exposure: NetworkExposure;
    count: number;
    avgRiskScore: number;
  }[];
}

/** CVSS v3.1 vector components */
export interface CVSS31Vector {
  attackVector: "N" | "A" | "L" | "P";
  attackComplexity: "L" | "H";
  privilegesRequired: "N" | "L" | "H";
  userInteraction: "N" | "R";
  scope: "U" | "C";
  confidentialityImpact: "N" | "L" | "H";
  integrityImpact: "N" | "L" | "H";
  availabilityImpact: "N" | "L" | "H";
}

/** CVSS score calculation result */
export interface CVSSCalculation {
  vector: string;
  baseScore: number;
  severity: "NONE" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  impactScore: number;
  exploitabilityScore: number;
}

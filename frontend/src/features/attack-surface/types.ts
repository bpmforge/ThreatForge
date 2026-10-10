// Match backend types from server/src/services/attack-surface/types.ts

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

type AuthLevel =
  | "NONE"
  | "API_KEY"
  | "BASIC"
  | "OAUTH2"
  | "MUTUAL_TLS"
  | "CERTIFICATE"
  | "MULTI_FACTOR";

type DataSensitivity =
  | "PUBLIC"
  | "INTERNAL"
  | "CONFIDENTIAL"
  | "RESTRICTED"
  | "CRITICAL";

export type NetworkExposure =
  | "INTERNAL_ONLY"
  | "VPN_PROTECTED"
  | "PRIVATE_CLOUD"
  | "PUBLIC_CLOUD"
  | "INTERNET_FACING";

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

interface AttackSurfaceSummary {
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
}

interface RiskDistribution {
  critical: number;
  high: number;
  medium: number;
  low: number;
  info: number;
}

export interface ExposureMatrixEntry {
  interfaceType: InterfaceType;
  exposure: NetworkExposure;
  count: number;
  avgRiskScore: number;
}

export interface AttackSurfaceAnalysis {
  modelId: string;
  modelName: string;
  analyzedAt: string;
  summary: AttackSurfaceSummary;
  components: AttackSurfaceComponent[];
  riskDistribution: RiskDistribution;
  exposureMatrix: ExposureMatrixEntry[];
}

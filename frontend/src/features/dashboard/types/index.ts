/**
 * Dashboard Feature - Types
 */

/** Model lifecycle status */
export type ModelStatus = "DRAFT" | "IN_REVIEW" | "PUBLISHED" | "ARCHIVED";

export interface ThreatModelSummary {
  id: string;
  name: string;
  version: number;
  status?: ModelStatus;
  tags?: string[];
  threatCount: number;
  openThreatCount: number;
  mitigatedThreatCount?: number;
  criticalThreatCount?: number;
  highThreatCount?: number;
  lastModified: string;
  projectId: string;
  projectName?: string | null;
}

/** Full threat model with canvas state - returned by getThreatModel */
export interface ThreatModelFull extends ThreatModelSummary {
  projectName?: string | null;
  project?: {
    id: string;
    name: string;
  } | null;
  canvasState?: {
    nodes: unknown[];
    edges: unknown[];
    viewport?: {
      x: number;
      y: number;
      zoom: number;
    };
  };
}

export interface DashboardStats {
  totalModels: number;
  totalThreats: number;
  openThreats: number;
  mitigatedThreats: number;
  criticalThreats: number;
  modelsThisWeek: number;
}

export interface RecentActivity {
  id: string;
  type: "model_created" | "model_updated" | "threat_added" | "threat_mitigated";
  description: string;
  modelId: string;
  modelName: string;
  timestamp: string;
}

export interface DashboardFilters {
  organizationId?: string;
  projectId?: string;
  search?: string;
  sortBy?: "name" | "lastModified" | "threatCount";
  sortOrder?: "asc" | "desc";
}

/** STRIDE category breakdown */
export interface STRIDEBreakdown {
  category: string;
  total: number;
  open: number;
  inProgress: number;
  mitigated: number;
  accepted: number;
  bySeverity: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
}

/** Component type breakdown */
interface ComponentBreakdown {
  type: string;
  count: number;
}

/** Detailed model stats returned by /api/threat-models/:id/stats */
export interface ThreatModelStats {
  modelId: string;
  modelName: string;
  version: number;
  lastModified: string;

  // Overview counts
  componentCount: number;
  connectionCount: number;
  boundaryCount: number;

  // Threat summary
  totalThreats: number;
  openThreats: number;
  inProgressThreats: number;
  mitigatedThreats: number;
  acceptedThreats: number;
  criticalThreats: number;
  highThreats: number;

  // Mitigation summary
  totalMitigations: number;
  completedMitigations: number;
  mitigationProgress: number;

  // STRIDE breakdown
  strideBreakdown: STRIDEBreakdown[];

  // Component breakdown
  componentBreakdown: ComponentBreakdown[];

  // Risk score
  riskScore: number;
}

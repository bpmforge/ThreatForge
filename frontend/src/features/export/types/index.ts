/**
 * Export feature types.
 */
import type { Node, Edge } from "@xyflow/react";
import type { ComplianceControls } from "@/features/threat-library/types";

/** Threat data for export */
export interface ExportThreat {
  id: string;
  name: string;
  description?: string;
  strideCategories: string[];
  severity: string;
  status: string;
  componentId?: string;
  connectionId?: string;
  mitigations: ExportMitigation[];
  /** Compliance framework controls */
  complianceControls?: ComplianceControls;
  /** CWE IDs */
  cweIds?: string[];
  /** OWASP references */
  owaspIds?: string[];
  /** Citation-verifier rollup — compliance auditors rely on this */
  verificationStatus?:
    | "PENDING"
    | "VERIFIED"
    | "UNVERIFIED"
    | "PHANTOM"
    | "EXEMPT";
  /** Document section anchors cited for this threat (e.g. ["§3.2", "§appendix-a"]) */
  citationAnchors?: string[];
}

/** Mitigation data for export */
interface ExportMitigation {
  id: string;
  description: string;
  status: string;
  priority: string;
  notes?: string;
}

/** Full export data structure */
export interface ThreatModelExport {
  version: "1.0";
  exportedAt: string;
  model: {
    id: string | null;
    name: string;
  };
  canvas: {
    nodes: Node[];
    edges: Edge[];
  };
  threats: ExportThreat[];
}

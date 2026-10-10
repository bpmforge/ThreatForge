/**
 * Architectural mitigation types. Mirrors the server model
 * `ArchitecturalMitigation`; array fields arrive decoded.
 */
export type ArchitecturalChangeKind =
  | "ADD_WAF"
  | "ADD_TRUST_BOUNDARY"
  | "ENCRYPT_CONNECTION"
  | "SPLIT_COMPONENT"
  | "ADD_AUTHENTICATION"
  | "OTHER";

type ArchitecturalMitigationStatus =
  | "AI_SUGGESTED"
  | "ACCEPTED"
  | "REJECTED"
  | "MODIFIED";

export interface ArchitecturalMitigation {
  id: string;
  threatModelId: string;
  kind: ArchitecturalChangeKind;
  title: string;
  proposedChange: string;
  rationale: string | null;
  affectedComponentIds: string[];
  affectedConnectionIds: string[];
  threatIds: string[];
  attackChainIds: string[];
  priority: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  status: ArchitecturalMitigationStatus;
  source: "AI" | "HUMAN";
  createdAt: string;
}

export interface ArchitecturalMitigationPatch {
  status?: "ACCEPTED" | "REJECTED" | "MODIFIED";
  title?: string;
  proposedChange?: string;
  rationale?: string | null;
}

export const KIND_LABELS: Record<ArchitecturalChangeKind, string> = {
  ADD_WAF: "Add WAF",
  ADD_TRUST_BOUNDARY: "Add trust boundary",
  ENCRYPT_CONNECTION: "Encrypt connection",
  SPLIT_COMPONENT: "Split component",
  ADD_AUTHENTICATION: "Add authentication",
  OTHER: "Other change",
};

export const STATUS_BADGE_CLASSES: Record<string, string> = {
  AI_SUGGESTED: "bg-purple-100 text-purple-800 border-purple-200",
  ACCEPTED: "bg-green-100 text-green-800 border-green-200",
  REJECTED: "bg-gray-100 text-gray-600 border-gray-200",
  MODIFIED: "bg-blue-100 text-blue-800 border-blue-200",
};

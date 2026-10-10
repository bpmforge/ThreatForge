/**
 * Threats feature types.
 */
import type { StrideCategory, Severity } from "@/types/canvas";
import type { ComplianceControls } from "@/features/threat-library/types";
import type { ThreatRiskScores } from "./risk-frameworks";

// Re-export types used by hooks

export type EvidenceLink = { type: string; url: string; title: string };

export type MitigationStrategy =
  | "PREVENTION"
  | "DETECTION"
  | "RESPONSE"
  | "RECOVERY"
  | "DETERRENCE";

export interface Mitigation {
  id: string;
  description: string;
  status: string;
  priority: string;
  strategy: MitigationStrategy;
  controlCategory?: string;
  notes?: string;
  dueDate?: string;
  effectivenessScore?: number; // 0.0-0.85 — risk reduction percentage
  implementationNotes?: string;
  verified?: boolean;
  obligation?: "REQUIRED" | "RECOMMENDED";
  // Testability
  testCriteria?: string;
  testResult?: string;
  testedAt?: string;
  // Evidence
  evidenceLinks?: Array<{ type: string; url: string; title: string }>;
  // Requirement traceability — legacy JSON (kept for migration period)
  requirementRefs?: Array<{ docId: string; reqId: string; text: string }>;
  // Normalized requirement links (from junction table)
  requirements?: Array<{
    id: string;
    reqId: string;
    text: string;
    category: string | null;
    docId: string | null;
  }>;
  // Control inheritance
  isSharedControl?: boolean;
  inheritedFromId?: string;
  inheritedFromModel?: string;
}

type ThreatSource = "MANUAL" | "AI_SUGGESTED" | "AI_ACCEPTED" | "AI_MODIFIED";
type ReviewStatus = "PENDING" | "ACCEPTED" | "REJECTED" | "MODIFIED";

export type VerificationStatus =
  | "PENDING"
  | "VERIFIED"
  | "UNVERIFIED"
  | "PHANTOM"
  | "EXEMPT";

/**
 * Challenger-gate verdict. The adversarial-refutation
 * outcome retained on a kept threat. Distinct from `verificationStatus`, which
 * is the citation-rollup field. REFUTED is intentionally absent — confidently
 * refuted AI threats are deleted, never surfaced.
 */
export type ChallengeStatus = "UNVERIFIED" | "CONFIRMED" | "UNCERTAIN";

export interface ThreatAssignee {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
}

export interface ThreatComment {
  id: string;
  body: string;
  threatId: string;
  authorId: string;
  author: ThreatAssignee;
  createdAt: string;
  updatedAt: string;
}

export interface Threat {
  id: string;
  name: string;
  description?: string;
  strideCategories: StrideCategory[];
  severity: Severity;
  status: string;
  category?: string; // Custom organization category
  componentNodeId?: string; // React Flow node ID
  connectionEdgeId?: string; // React Flow edge ID
  assigneeId?: string | null;
  assignee?: ThreatAssignee | null;
  mitigations: Mitigation[];
  complianceControls?: ComplianceControls;
  cweIds?: string[];
  owaspIds?: string[];
  riskScores?: ThreatRiskScores; // Multi-framework risk scores
  // AI provenance + review
  source?: ThreatSource;
  reviewStatus?: ReviewStatus;
  reviewedById?: string;
  reviewedAt?: string;
  reviewNotes?: string;
  // CVSS scoring
  cvssVector31?: string;
  cvssScore31?: number;
  cvssVector40?: string;
  cvssScore40?: number;
  // AI metadata
  aiConfidence?: number;
  aiMethodology?: string;
  attackVector?: string;
  residualRisk?: string;
  // Human edit flag — true once a human has saved any edit; AI skips on re-run
  manuallyEdited?: boolean;
  // Citation verifier rollup (per Threat — composes with reviewStatus)
  verificationStatus?: VerificationStatus;
  // Challenger-gate verdict — adversarial-refutation outcome. Distinct
  // from `verificationStatus`. UNVERIFIED = not yet challenged; CONFIRMED =
  // survived refutation; UNCERTAIN = kept but flagged (note explains why).
  challengeStatus?: ChallengeStatus;
  verificationNote?: string;
  // Business context risk scoring (A23)
  likelihood?: number | null; // 0.0–1.0; null = not set
  businessRiskScore?: number | null; // 0–30; null if BusinessContext not configured
  businessRiskTier?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" | null;
}

export interface StrideCategoryOption {
  value: StrideCategory;
  label: string;
  short: string;
  description: string;
}

export interface SeverityOption {
  value: Severity;
  label: string;
  color: string;
}

export interface StatusOption {
  value: string;
  label: string;
}

export interface MitigationStatusOption {
  value: string;
  label: string;
  color: string;
}

export interface PriorityOption {
  value: string;
  label: string;
}

export interface MitigationStrategyOption {
  value: MitigationStrategy;
  label: string;
  description: string;
}

type CitationKind = "DERIVED" | "INFERRED" | "NOT_FOUND" | "NONE";
type CitationType =
  | "DOCUMENT"
  | "REFERENCE"
  | "COMPONENT"
  | "REQUIREMENT"
  | "NONE";

export interface Citation {
  id: string;
  kind: CitationKind;
  citationType: CitationType;
  // DOCUMENT
  documentId?: string | null;
  sectionId?: string | null;
  section?: { anchor: string; header: string } | null;
  pageNumber?: number | null;
  excerpt?: string | null;
  // REFERENCE
  referenceKind?: string | null;
  referenceId?: string | null;
  // COMPONENT
  componentNodeId?: string | null;
  // REQUIREMENT
  requirementId?: string | null;
  // Verification
  verificationStatus: VerificationStatus;
  verifiedAt?: string | null;
  verifierConfidence?: number | null;
  verifierRationale?: string | null;
  verifierProvider?: string | null;
  // Override
  overriddenById?: string | null;
  overrideRationale?: string | null;
  overriddenAt?: string | null;
  createdAt: string;
}

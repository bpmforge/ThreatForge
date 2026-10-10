/**
 * Security Review Workflow Types
 *
 * Types for the threat model review and approval workflow.
 */

// Thrown when a workflow action is attempted from a status that does not
// permit it (e.g. signing off a REJECTED review). Routes should map this to
// a 409 Conflict.
export class InvalidReviewStateError extends Error {
  constructor(
    message: string,
    public readonly currentStatus: string,
  ) {
    super(message);
    this.name = "InvalidReviewStateError";
  }
}

// Review status
export type ReviewStatus =
  | "DRAFT"
  | "PENDING_REVIEW"
  | "IN_REVIEW"
  | "CHANGES_REQUESTED"
  | "APPROVED"
  | "REJECTED"
  | "SIGNED_OFF";

// Reviewer decision
export type ReviewDecision =
  | "APPROVE"
  | "REQUEST_CHANGES"
  | "REJECT"
  | "SIGN_OFF";

// Reviewer role in the review
export type ReviewerRole =
  | "REVIEWER" // Standard reviewer
  | "SECURITY_LEAD" // Security team lead
  | "ARCHITECT" // Solution architect
  | "COMPLIANCE" // Compliance officer
  | "SIGN_OFF_AUTHORITY" // Final sign-off authority
  | "STAKEHOLDER"; // Business stakeholder

// Review request
export interface ReviewRequest {
  id: string;
  threatModelId: string;
  threatModelName: string;
  version: number;
  status: ReviewStatus;
  requestedById: string;
  requestedByName: string;
  requestedAt: Date;
  dueDate?: Date;
  priority: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  reviewType: "INITIAL" | "PERIODIC" | "CHANGE" | "COMPLIANCE";
  description?: string;
  scope?: string;
  reviewers: Reviewer[];
  comments: ReviewComment[];
  checklist: ChecklistItem[];
  signOffRequired: boolean;
  signOff?: SignOff;
  metadata?: Record<string, unknown>;
  completedAt?: Date;
}

// Reviewer assignment
export interface Reviewer {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  role: ReviewerRole;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED";
  decision?: ReviewDecision;
  decisionAt?: Date;
  comments?: string;
  required: boolean;
  notifiedAt?: Date;
  assignedAt: Date;
}

// Review comment
export interface ReviewComment {
  id: string;
  reviewRequestId: string;
  userId: string;
  userName: string;
  content: string;
  category?:
    | "GENERAL"
    | "THREAT"
    | "MITIGATION"
    | "COMPONENT"
    | "ARCHITECTURE"
    | "COMPLIANCE";
  referencedItemType?: "THREAT" | "MITIGATION" | "COMPONENT" | "CONNECTION";
  referencedItemId?: string;
  isResolved: boolean;
  resolvedById?: string;
  resolvedAt?: Date;
  parentCommentId?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Review checklist item
export interface ChecklistItem {
  id: string;
  category: string;
  description: string;
  required: boolean;
  isCompleted: boolean;
  completedById?: string;
  completedAt?: Date;
  notes?: string;
}

// Sign-off record
export interface SignOff {
  id: string;
  reviewRequestId: string;
  signedOffById: string;
  signedOffByName: string;
  signedOffAt: Date;
  signature?: string; // Digital signature if available
  statement: string; // Attestation statement
  expiresAt?: Date; // Sign-off expiration (for periodic reviews)
  metadata?: {
    ipAddress?: string;
    userAgent?: string;
    location?: string;
  };
}

// Review workflow configuration
export interface WorkflowConfig {
  id: string;
  organizationId: string;
  name: string;
  description?: string;
  isDefault: boolean;

  // Requirements
  minimumReviewers: number;
  requireSecurityLead: boolean;
  requireSignOff: boolean;

  // Timing
  defaultDueDays: number;
  reminderDays: number[]; // Days before due to send reminders
  escalationDays?: number; // Days after due to escalate

  // Auto-actions
  autoApproveIfAllPass: boolean;
  autoCloseOnReject: boolean;

  // Checklist template
  checklistTemplate: ChecklistTemplate[];

  // Review criteria
  criteria: ReviewCriteria;

  // Active status
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Checklist template item
export interface ChecklistTemplate {
  category: string;
  items: {
    description: string;
    required: boolean;
    helpText?: string;
  }[];
}

// Review criteria for automatic validation
export interface ReviewCriteria {
  // Threat requirements
  maxOpenCriticalThreats: number;
  maxOpenHighThreats: number;
  requireAllThreatsReviewed: boolean;

  // Mitigation requirements
  minMitigationCoverage: number; // Percentage
  requireMitigationsForCritical: boolean;
  requireMitigationsForHigh: boolean;

  // Compliance requirements
  requiredComplianceFrameworks: string[];
  minComplianceScore: number; // Percentage

  // Documentation requirements
  requireDescription: boolean;
  requireArchitectureDiagram: boolean;
  minComponentCount: number;
}

// Review summary/metrics
export interface ReviewMetrics {
  threatModelId: string;
  totalThreats: number;
  openThreats: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  mitigationCoverage: number;
  complianceScores: Record<string, number>;
  criteriaResults: {
    criterion: string;
    passed: boolean;
    details?: string;
  }[];
  overallPassed: boolean;
}

// Review activity log entry
export interface ReviewActivity {
  id: string;
  reviewRequestId: string;
  userId?: string;
  userName?: string;
  action: ReviewActivityAction;
  details?: Record<string, unknown>;
  createdAt: Date;
}

export type ReviewActivityAction =
  | "REVIEW_REQUESTED"
  | "REVIEWER_ASSIGNED"
  | "REVIEWER_REMOVED"
  | "REVIEW_STARTED"
  | "COMMENT_ADDED"
  | "COMMENT_RESOLVED"
  | "CHECKLIST_ITEM_COMPLETED"
  | "DECISION_MADE"
  | "CHANGES_REQUESTED"
  | "APPROVED"
  | "REJECTED"
  | "SIGNED_OFF"
  | "REVIEW_COMPLETED"
  | "REVIEW_EXPIRED"
  | "REMINDER_SENT";

// Default checklist templates
export const DEFAULT_CHECKLIST_TEMPLATES: ChecklistTemplate[] = [
  {
    category: "Threat Identification",
    items: [
      { description: "All system boundaries identified", required: true },
      { description: "All data flows documented", required: true },
      {
        description: "STRIDE analysis completed for each component",
        required: true,
      },
      { description: "External attack vectors considered", required: true },
      { description: "Insider threat scenarios evaluated", required: false },
    ],
  },
  {
    category: "Risk Assessment",
    items: [
      {
        description: "Severity ratings reviewed and validated",
        required: true,
      },
      { description: "Business impact assessed", required: true },
      { description: "Likelihood factors documented", required: false },
      {
        description: "Risk scores calculated using approved methodology",
        required: true,
      },
    ],
  },
  {
    category: "Mitigations",
    items: [
      {
        description: "Mitigations identified for all critical threats",
        required: true,
      },
      {
        description: "Mitigations identified for all high threats",
        required: true,
      },
      { description: "Mitigation owners assigned", required: true },
      { description: "Implementation timeline defined", required: false },
      { description: "Residual risk documented", required: true },
    ],
  },
  {
    category: "Compliance",
    items: [
      { description: "Relevant compliance frameworks mapped", required: true },
      { description: "Control gaps identified", required: true },
      { description: "Remediation plan for gaps documented", required: false },
    ],
  },
  {
    category: "Documentation",
    items: [
      {
        description: "Architecture diagram accurate and current",
        required: true,
      },
      { description: "Component descriptions complete", required: true },
      { description: "Data classification documented", required: true },
      { description: "Assumptions and constraints listed", required: false },
    ],
  },
];

// Default review criteria
export const DEFAULT_REVIEW_CRITERIA: ReviewCriteria = {
  maxOpenCriticalThreats: 0,
  maxOpenHighThreats: 3,
  requireAllThreatsReviewed: true,
  minMitigationCoverage: 80,
  requireMitigationsForCritical: true,
  requireMitigationsForHigh: true,
  requiredComplianceFrameworks: [],
  minComplianceScore: 70,
  requireDescription: true,
  requireArchitectureDiagram: false,
  minComponentCount: 2,
};

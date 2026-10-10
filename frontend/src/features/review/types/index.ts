// Match backend types from server/src/services/review-workflow/types.ts

export type ReviewStatus =
  | "DRAFT"
  | "PENDING_REVIEW"
  | "IN_REVIEW"
  | "CHANGES_REQUESTED"
  | "APPROVED"
  | "REJECTED"
  | "SIGNED_OFF";

export type ReviewDecision =
  | "APPROVE"
  | "REQUEST_CHANGES"
  | "REJECT"
  | "SIGN_OFF";

export type ReviewerRole =
  | "REVIEWER"
  | "SECURITY_LEAD"
  | "ARCHITECT"
  | "COMPLIANCE"
  | "SIGN_OFF_AUTHORITY"
  | "STAKEHOLDER";

type ReviewerStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED";

export type ReviewPriority = "LOW" | "NORMAL" | "HIGH" | "URGENT";

export type ReviewType = "INITIAL" | "PERIODIC" | "CHANGE" | "COMPLIANCE";

export interface Reviewer {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  role: ReviewerRole;
  status: ReviewerStatus;
  decision?: ReviewDecision;
  decisionAt?: string;
  comments?: string;
  required: boolean;
  notifiedAt?: string;
  assignedAt: string;
}

type CommentCategory =
  | "GENERAL"
  | "THREAT"
  | "MITIGATION"
  | "COMPONENT"
  | "ARCHITECTURE"
  | "COMPLIANCE";

type ReferencedItemType = "THREAT" | "MITIGATION" | "COMPONENT" | "CONNECTION";

export interface ReviewComment {
  id: string;
  reviewRequestId: string;
  userId: string;
  userName: string;
  content: string;
  category?: CommentCategory;
  referencedItemType?: ReferencedItemType;
  referencedItemId?: string;
  isResolved: boolean;
  resolvedById?: string;
  resolvedAt?: string;
  parentCommentId?: string;
  createdAt: string;
  updatedAt: string;
}

interface ChecklistItem {
  id: string;
  category: string;
  description: string;
  required: boolean;
  isCompleted: boolean;
  completedById?: string;
  completedAt?: string;
  notes?: string;
}

interface SignOff {
  id: string;
  reviewRequestId: string;
  signedOffById: string;
  signedOffByName: string;
  signedOffAt: string;
  signature?: string;
  statement: string;
  expiresAt?: string;
  metadata?: {
    ipAddress?: string;
    userAgent?: string;
    location?: string;
  };
}

export interface ReviewRequest {
  id: string;
  threatModelId: string;
  threatModelName: string;
  version: number;
  status: ReviewStatus;
  requestedById: string;
  requestedByName: string;
  requestedAt: string;
  dueDate?: string;
  priority: ReviewPriority;
  reviewType: ReviewType;
  description?: string;
  scope?: string;
  reviewers: Reviewer[];
  comments: ReviewComment[];
  checklist: ChecklistItem[];
  signOffRequired: boolean;
  signOff?: SignOff;
  metadata?: Record<string, unknown>;
  completedAt?: string;
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

export interface ReviewActivity {
  id: string;
  reviewRequestId: string;
  userId?: string;
  userName?: string;
  action: ReviewActivityAction;
  details?: Record<string, unknown>;
  createdAt: string;
}

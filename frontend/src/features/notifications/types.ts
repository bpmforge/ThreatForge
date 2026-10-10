type NotificationCategory =
  | "THREAT"
  | "MITIGATION"
  | "MODEL"
  | "PROJECT"
  | "ORGANIZATION"
  | "SECURITY"
  | "SYSTEM";

type NotificationPriority = "LOW" | "NORMAL" | "HIGH" | "URGENT";

type NotificationType =
  | "THREAT_CREATED"
  | "THREAT_UPDATED"
  | "THREAT_STATUS_CHANGED"
  | "THREAT_ASSIGNED"
  | "THREAT_SEVERITY_ESCALATED"
  | "CRITICAL_THREAT_DETECTED"
  | "MITIGATION_CREATED"
  | "MITIGATION_COMPLETED"
  | "MITIGATION_OVERDUE"
  | "MITIGATION_ASSIGNED"
  | "MODEL_SHARED"
  | "MODEL_EXPORTED"
  | "MODEL_VERSION_CREATED"
  | "MODEL_STATUS_CHANGED"
  | "PROJECT_MEMBER_ADDED"
  | "PROJECT_MEMBER_REMOVED"
  | "ORG_MEMBER_JOINED"
  | "ORG_MEMBER_LEFT"
  | "ORG_INVITATION_RECEIVED"
  | "ORG_ROLE_CHANGED"
  | "SCAN_COMPLETED"
  | "VULNERABILITY_FOUND"
  | "CI_SCAN_FAILED"
  | "MENTION"
  | "COMMENT_ADDED"
  | "WEEKLY_DIGEST";

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  category: NotificationCategory;
  priority: NotificationPriority;
  title: string;
  message: string;
  link?: string;
  metadata?: Record<string, unknown>;
  isRead: boolean;
  readAt?: string;
  createdAt: string;
}

export interface NotificationStats {
  total: number;
  unread: number;
  byCategory: Record<NotificationCategory, number>;
  byPriority: Record<NotificationPriority, number>;
}

export interface NotificationsResponse {
  notifications: Notification[];
  pagination: {
    offset: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
}

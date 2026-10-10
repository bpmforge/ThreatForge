/**
 * Notification Service Types
 *
 * Types for in-app, email, and external notifications.
 */

// Notification channels
export type NotificationChannel =
  | "IN_APP"
  | "EMAIL"
  | "SLACK"
  | "TEAMS"
  | "WEBHOOK";

// Notification categories
export type NotificationCategory =
  | "THREAT"
  | "MITIGATION"
  | "MODEL"
  | "PROJECT"
  | "ORGANIZATION"
  | "SECURITY"
  | "SYSTEM";

// Notification priority
export type NotificationPriority = "LOW" | "NORMAL" | "HIGH" | "URGENT";

// Notification event types
export type NotificationEventType =
  // Threat events
  | "THREAT_CREATED"
  | "THREAT_UPDATED"
  | "THREAT_STATUS_CHANGED"
  | "THREAT_ASSIGNED"
  | "THREAT_SEVERITY_ESCALATED"
  | "CRITICAL_THREAT_DETECTED"
  // Mitigation events
  | "MITIGATION_CREATED"
  | "MITIGATION_COMPLETED"
  | "MITIGATION_OVERDUE"
  | "MITIGATION_ASSIGNED"
  // Model events
  | "MODEL_SHARED"
  | "MODEL_EXPORTED"
  | "MODEL_VERSION_CREATED"
  | "MODEL_STATUS_CHANGED"
  | "MODEL_STALE"
  // Project events
  | "PROJECT_MEMBER_ADDED"
  | "PROJECT_MEMBER_REMOVED"
  // Organization events
  | "ORG_MEMBER_JOINED"
  | "ORG_MEMBER_LEFT"
  | "ORG_INVITATION_RECEIVED"
  | "ORG_ROLE_CHANGED"
  // Security events
  | "SCAN_COMPLETED"
  | "VULNERABILITY_FOUND"
  | "CI_SCAN_FAILED"
  // System events
  | "MENTION"
  | "COMMENT_ADDED"
  | "WEEKLY_DIGEST";

// In-app notification
export interface InAppNotification {
  id: string;
  userId: string;
  type: NotificationEventType;
  category: NotificationCategory;
  priority: NotificationPriority;
  title: string;
  message: string;
  link?: string;
  metadata?: Record<string, unknown>;
  isRead: boolean;
  readAt?: Date;
  createdAt: Date;
}

// Slack message
export interface SlackNotification {
  channel: string;
  text: string;
  blocks?: SlackBlock[];
  attachments?: SlackAttachment[];
  threadTs?: string;
  unfurlLinks?: boolean;
  unfurlMedia?: boolean;
}

export interface SlackBlock {
  type: "section" | "divider" | "header" | "context" | "actions" | "image";
  text?: {
    type: "plain_text" | "mrkdwn";
    text: string;
    emoji?: boolean;
  };
  fields?: Array<{ type: string; text: string }>;
  accessory?: Record<string, unknown>;
  elements?: Array<Record<string, unknown>>;
}

export interface SlackAttachment {
  color?: string;
  fallback?: string;
  title?: string;
  title_link?: string;
  text?: string;
  fields?: Array<{ title: string; value: string; short?: boolean }>;
  footer?: string;
  footer_icon?: string;
  ts?: number;
}

// Microsoft Teams adaptive card
export interface TeamsNotification {
  webhookUrl?: string;
  card: TeamsAdaptiveCard;
}

export interface TeamsAdaptiveCard {
  $schema: string;
  type: "AdaptiveCard";
  version: string;
  body: TeamsCardElement[];
  actions?: TeamsCardAction[];
}

export interface TeamsCardElement {
  type: "TextBlock" | "Image" | "ColumnSet" | "Container" | "FactSet";
  text?: string;
  size?: "small" | "default" | "medium" | "large" | "extraLarge";
  weight?: "lighter" | "default" | "bolder";
  color?:
    | "default"
    | "dark"
    | "light"
    | "accent"
    | "good"
    | "warning"
    | "attention";
  wrap?: boolean;
  spacing?: "none" | "small" | "default" | "medium" | "large" | "extraLarge";
  columns?: Array<{ type: string; items: TeamsCardElement[] }>;
  facts?: Array<{ title: string; value: string }>;
}

interface TeamsCardAction {
  type: "Action.OpenUrl" | "Action.Submit";
  title: string;
  url?: string;
  data?: Record<string, unknown>;
}

// Notification preferences (per user)
export interface NotificationPreferences {
  // Channel preferences by category
  channels: {
    [K in NotificationCategory]?: NotificationChannel[];
  };
  // Event-specific overrides
  eventOverrides?: {
    [K in NotificationEventType]?: {
      enabled: boolean;
      channels?: NotificationChannel[];
    };
  };
  // Email preferences
  email: {
    enabled: boolean;
    digestFrequency: "REALTIME" | "DAILY" | "WEEKLY" | "NEVER";
    digestTime?: string; // HH:mm format
    quietHoursStart?: string;
    quietHoursEnd?: string;
    timezone?: string;
  };
  // Slack preferences
  slack?: {
    enabled: boolean;
    dmEnabled: boolean;
    channelId?: string;
  };
  // Teams preferences
  teams?: {
    enabled: boolean;
    webhookUrl?: string;
  };
}

// Notification delivery result
export interface NotificationDeliveryResult {
  channel: NotificationChannel;
  success: boolean;
  messageId?: string;
  error?: string;
  timestamp: Date;
}

// Notification template
export interface NotificationTemplate {
  type: NotificationEventType;
  title: (data: Record<string, unknown>) => string;
  message: (data: Record<string, unknown>) => string;
  email?: {
    subject: (data: Record<string, unknown>) => string;
  };
  slack?: {
    blocks: (data: Record<string, unknown>) => SlackBlock[];
    color: string;
  };
  teams?: {
    card: (data: Record<string, unknown>) => TeamsAdaptiveCard;
  };
}

// Event payload
export interface NotificationEventPayload {
  type: NotificationEventType;
  category: NotificationCategory;
  priority: NotificationPriority;
  recipientIds: string[];
  data: Record<string, unknown>;
  link?: string;
  organizationId?: string;
  modelId?: string;
  projectId?: string;
  actorId?: string;
  actorName?: string;
}

// Slack integration config
export interface SlackConfig {
  botToken: string;
  appToken?: string;
  signingSecret?: string;
  defaultChannel?: string;
}

// Teams integration config
export interface TeamsConfig {
  webhookUrl: string;
  tenantId?: string;
}

// Notification stats
export interface NotificationStats {
  total: number;
  unread: number;
  byCategory: Record<NotificationCategory, number>;
  byPriority: Record<NotificationPriority, number>;
}

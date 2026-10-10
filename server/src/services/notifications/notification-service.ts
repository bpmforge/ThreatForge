/**
 * Notification Service
 *
 * Orchestrates sending notifications across multiple channels. Holds the
 * provider clients + app URL and delegates the per-channel send logic,
 * preference resolution, and store queries to sibling modules.
 */

import logger from "../../utils/logger.js";
import { createSlackClient, SlackClient } from "./slack-client.js";
import { getNotificationTemplate } from "./templates.js";
import {
  getUserPreferences,
  updateUserPreferences,
  getChannelsForEvent,
} from "./notification-preferences.js";
import {
  sendInApp,
  sendEmail,
  sendSlack,
  sendTeams,
} from "./notification-channels.js";
import { sendWebhook } from "./notification-webhook.js";
import {
  getUnreadNotifications,
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  getStats,
} from "./notification-store.js";
import type {
  NotificationChannel,
  NotificationEventPayload,
  NotificationPreferences,
  NotificationDeliveryResult,
  InAppNotification,
  SlackConfig,
  NotificationStats,
} from "./types.js";

export class NotificationService {
  private slackClient: SlackClient | null = null;
  private appUrl: string;

  constructor() {
    this.appUrl = process.env.APP_URL || "http://localhost:3000";
  }

  /**
   * Initialize the instance-wide Slack client. Email goes through the shared
   * email service (Admin > Settings); Teams posts to each recipient's own
   * webhook, so neither needs setup here.
   */
  async initialize(config?: { slack?: SlackConfig }): Promise<void> {
    if (config?.slack) {
      this.slackClient = createSlackClient(config.slack);
    }
  }

  /** Send a notification based on event */
  async notify(
    payload: NotificationEventPayload,
  ): Promise<NotificationDeliveryResult[]> {
    const results: NotificationDeliveryResult[] = [];
    const template = getNotificationTemplate(payload.type);

    if (!template) {
      logger.warn(`No template found for notification type: ${payload.type}`);
      return results;
    }

    // Get data for template
    const data = {
      ...payload.data,
      link: payload.link ? `${this.appUrl}${payload.link}` : undefined,
    };

    // Process each recipient
    for (const recipientId of payload.recipientIds) {
      const prefs = await getUserPreferences(recipientId);
      const channels = getChannelsForEvent(
        payload.category,
        payload.type,
        prefs,
      );

      // Send to each enabled channel
      for (const channel of channels) {
        try {
          const result = await this.sendToChannel(
            channel,
            template,
            data,
            recipientId,
            payload,
          );
          results.push(result);
        } catch (error) {
          results.push({
            channel,
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
            timestamp: new Date(),
          });
        }
      }
    }

    return results;
  }

  /** Send notification to a specific channel */
  private async sendToChannel(
    channel: NotificationChannel,
    template: ReturnType<typeof getNotificationTemplate>,
    data: Record<string, unknown>,
    recipientId: string,
    payload: NotificationEventPayload,
  ): Promise<NotificationDeliveryResult> {
    if (!template) {
      return {
        channel,
        success: false,
        error: "No template",
        timestamp: new Date(),
      };
    }

    switch (channel) {
      case "IN_APP":
        return sendInApp(template, data, recipientId, payload);

      case "EMAIL":
        return sendEmail(template, data, recipientId);

      case "SLACK":
        return sendSlack(this.slackClient, template, data, recipientId);

      case "TEAMS":
        return sendTeams(template, data, recipientId);

      case "WEBHOOK":
        return sendWebhook(data, payload);

      default:
        return {
          channel,
          success: false,
          error: `Unknown channel: ${channel}`,
          timestamp: new Date(),
        };
    }
  }

  // Thin delegates to the preferences + store modules. Kept on the class so
  // existing callers (service.getStats(...), service.markAsRead(...)) work.

  async getUserPreferences(userId: string): Promise<NotificationPreferences> {
    return getUserPreferences(userId);
  }

  async updateUserPreferences(
    userId: string,
    preferences: Partial<NotificationPreferences>,
  ): Promise<NotificationPreferences> {
    return updateUserPreferences(userId, preferences);
  }

  async getUnreadNotifications(
    userId: string,
    limit = 50,
  ): Promise<InAppNotification[]> {
    return getUnreadNotifications(userId, limit);
  }

  async getNotifications(
    userId: string,
    options: { offset?: number; limit?: number; unreadOnly?: boolean } = {},
  ): Promise<{ notifications: InAppNotification[]; total: number }> {
    return getNotifications(userId, options);
  }

  async markAsRead(notificationId: string, userId: string): Promise<void> {
    return markAsRead(notificationId, userId);
  }

  async markAllAsRead(userId: string): Promise<number> {
    return markAllAsRead(userId);
  }

  async deleteNotification(
    notificationId: string,
    userId: string,
  ): Promise<void> {
    return deleteNotification(notificationId, userId);
  }

  async getStats(userId: string): Promise<NotificationStats> {
    return getStats(userId);
  }
}

// Singleton instance
let notificationService: NotificationService | null = null;

/** Get or create the notification service */
export function getNotificationService(): NotificationService {
  if (!notificationService) {
    notificationService = new NotificationService();
  }
  return notificationService;
}

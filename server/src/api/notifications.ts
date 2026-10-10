/**
 * Notifications API
 *
 * REST endpoints for managing user notifications.
 */

import { FastifyInstance } from "fastify";
import { getNotificationService } from "../services/notifications/index.js";
import {
  sendSuccess,
  sendUnauthorized,
  sendForbidden,
  sendBadRequest,
} from "../utils/api-response.js";
import type { NotificationPreferences } from "../services/notifications/types.js";
import { isSuperAdmin } from "./admin/utils.js";
import { assertPublicHttpUrl } from "../utils/outbound-url.js";
import { routeAuthz } from "../middleware/authz-policy.js";

// Request/Response types
interface NotificationQuery {
  offset?: number;
  limit?: number;
  unreadOnly?: boolean;
}

interface MarkReadBody {
  notificationIds: string[];
}

interface PreferencesBody {
  preferences: Partial<NotificationPreferences>;
}

interface SlackIntegrationBody {
  botToken: string;
  defaultChannel?: string;
}

interface TeamsIntegrationBody {
  webhookUrl: string;
}

const AUTHENTICATED = routeAuthz("authenticated");

export async function notificationRoutes(fastify: FastifyInstance) {
  const notificationService = getNotificationService();

  // Get notifications with pagination
  fastify.get<{ Querystring: NotificationQuery }>(
    "/api/notifications",
    {
      config: { authz: "authenticated" },
      schema: {
        querystring: {
          type: "object",
          properties: {
            offset: { type: "number", default: 0 },
            limit: { type: "number", default: 20, maximum: 100 },
            unreadOnly: { type: "boolean", default: false },
          },
        },
      },
    },
    async (request, reply) => {
      const userId = request.authUser?.id;
      if (!userId) {
        return sendUnauthorized(reply);
      }

      const { offset = 0, limit = 20, unreadOnly = false } = request.query;

      const result = await notificationService.getNotifications(userId, {
        offset,
        limit,
        unreadOnly,
      });

      return sendSuccess(reply, result.notifications, {
        pagination: {
          offset,
          limit,
          total: result.total,
          hasMore: offset + result.notifications.length < result.total,
        },
      });
    },
  );

  // Get unread notification count and stats
  fastify.get(
    "/api/notifications/stats",
    AUTHENTICATED,
    async (request, reply) => {
      const userId = request.authUser?.id;
      if (!userId) {
        return sendUnauthorized(reply);
      }

      const stats = await notificationService.getStats(userId);

      return sendSuccess(reply, stats);
    },
  );

  // Mark notifications as read
  fastify.post<{ Body: MarkReadBody }>(
    "/api/notifications/read",
    {
      config: { authz: "authenticated" },
      schema: {
        body: {
          type: "object",
          properties: {
            notificationIds: {
              type: "array",
              items: { type: "string" },
              minItems: 1,
            },
          },
          required: ["notificationIds"],
        },
      },
    },
    async (request, reply) => {
      const userId = request.authUser?.id;
      if (!userId) {
        return sendUnauthorized(reply);
      }

      const { notificationIds } = request.body;

      for (const id of notificationIds) {
        await notificationService.markAsRead(id, userId);
      }

      return sendSuccess(reply, { markedCount: notificationIds.length });
    },
  );

  // Mark all notifications as read
  fastify.post(
    "/api/notifications/read-all",
    AUTHENTICATED,
    async (request, reply) => {
      const userId = request.authUser?.id;
      if (!userId) {
        return sendUnauthorized(reply);
      }

      const count = await notificationService.markAllAsRead(userId);

      return sendSuccess(reply, { markedCount: count });
    },
  );

  // Delete a notification
  fastify.delete<{ Params: { notificationId: string } }>(
    "/api/notifications/:notificationId",
    AUTHENTICATED,
    async (request, reply) => {
      const userId = request.authUser?.id;
      if (!userId) {
        return sendUnauthorized(reply);
      }

      const { notificationId } = request.params;
      await notificationService.deleteNotification(notificationId, userId);

      return sendSuccess(reply, { deleted: true });
    },
  );

  // Get notification preferences
  fastify.get(
    "/api/notifications/preferences",
    AUTHENTICATED,
    async (request, reply) => {
      const userId = request.authUser?.id;
      if (!userId) {
        return sendUnauthorized(reply);
      }

      const preferences = await notificationService.getUserPreferences(userId);

      return sendSuccess(reply, preferences);
    },
  );

  // Update notification preferences
  fastify.patch<{ Body: PreferencesBody }>(
    "/api/notifications/preferences",
    {
      config: { authz: "authenticated" },
      schema: {
        body: {
          type: "object",
          properties: {
            preferences: {
              type: "object",
            },
          },
          required: ["preferences"],
        },
      },
    },
    async (request, reply) => {
      const userId = request.authUser?.id;
      if (!userId) {
        return sendUnauthorized(reply);
      }

      const { preferences } = request.body;
      const updated = await notificationService.updateUserPreferences(
        userId,
        preferences,
      );

      return sendSuccess(reply, updated);
    },
  );

  // Configure the instance-wide Slack bot. The notification service holds one
  // Slack client for every tenant, so only a super-admin may replace it.
  fastify.post<{ Body: SlackIntegrationBody }>(
    "/api/notifications/integrations/slack",
    {
      config: { authz: "superAdmin" },
      schema: {
        body: {
          type: "object",
          properties: {
            botToken: { type: "string" },
            defaultChannel: { type: "string" },
          },
          required: ["botToken"],
        },
      },
    },
    async (request, reply) => {
      const userId = request.authUser?.id;
      if (!userId) {
        return sendUnauthorized(reply);
      }

      if (!(await isSuperAdmin(userId))) {
        return sendForbidden(
          reply,
          "Slack is configured instance-wide by a system administrator",
        );
      }

      const { botToken, defaultChannel } = request.body;

      // Update user preferences with Slack config
      const updated = await notificationService.updateUserPreferences(userId, {
        slack: {
          enabled: true,
          dmEnabled: true,
          channelId: defaultChannel,
        },
      });

      await notificationService.initialize({
        slack: { botToken, defaultChannel },
      });

      return sendSuccess(reply, {
        message: "Slack integration configured",
        preferences: updated,
      });
    },
  );

  // Configure the caller's own Teams webhook (used only for their notifications)
  fastify.post<{ Body: TeamsIntegrationBody }>(
    "/api/notifications/integrations/teams",
    {
      config: { authz: "authenticated" },
      schema: {
        body: {
          type: "object",
          properties: {
            webhookUrl: { type: "string", format: "uri" },
          },
          required: ["webhookUrl"],
        },
      },
    },
    async (request, reply) => {
      const userId = request.authUser?.id;
      if (!userId) {
        return sendUnauthorized(reply);
      }

      const { webhookUrl } = request.body;
      const urlError = await assertPublicHttpUrl(webhookUrl);
      if (urlError) {
        return sendBadRequest(reply, urlError);
      }

      // Update user preferences with Teams config
      const updated = await notificationService.updateUserPreferences(userId, {
        teams: {
          enabled: true,
          webhookUrl,
        },
      });

      return sendSuccess(reply, {
        message: "Teams integration configured",
        preferences: updated,
      });
    },
  );

  // Test notification (for debugging/testing)
  fastify.post(
    "/api/notifications/test",
    AUTHENTICATED,
    async (request, reply) => {
      const userId = request.authUser?.id;
      if (!userId) {
        return sendUnauthorized(reply);
      }

      const results = await notificationService.notify({
        type: "MENTION",
        category: "SYSTEM",
        priority: "NORMAL",
        recipientIds: [userId],
        data: {
          mentionerName: "System",
          context: "Test Notification",
          snippet:
            "This is a test notification to verify your setup is working correctly.",
        },
        link: "/dashboard",
      });

      return sendSuccess(reply, { results });
    },
  );
}

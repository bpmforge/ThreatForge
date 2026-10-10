/**
 * Per-channel notification senders: IN_APP, EMAIL, SLACK, TEAMS.
 *
 * Each sender is a standalone function taking the relevant provider/client
 * as an argument so the orchestrating service stays thin. SLACK/TEAMS read
 * the recipient's preferences via notification-preferences.
 */
import { getPrisma } from "../../db.js";
import { getUserPreferences } from "./notification-preferences.js";
import { emailService } from "../email/index.js";
import type { SlackClient } from "./slack-client.js";
import { createTeamsClient } from "./teams-client.js";
import { getNotificationTemplate } from "./templates.js";
import type {
  NotificationEventPayload,
  NotificationDeliveryResult,
} from "./types.js";

type Template = NonNullable<ReturnType<typeof getNotificationTemplate>>;

/** Send in-app notification */
export async function sendInApp(
  template: Template,
  data: Record<string, unknown>,
  recipientId: string,
  payload: NotificationEventPayload,
): Promise<NotificationDeliveryResult> {
  const prisma = await getPrisma();

  const notification = await prisma.notification.create({
    data: {
      userId: recipientId,
      type: payload.type,
      category: payload.category,
      priority: payload.priority,
      title: template.title(data),
      message: template.message(data),
      link: data.link as string | undefined,
      metadata: JSON.stringify(data),
      isRead: false,
    },
  });

  return {
    channel: "IN_APP",
    success: true,
    messageId: notification.id,
    timestamp: new Date(),
  };
}

/** Send email notification */
export async function sendEmail(
  template: Template,
  data: Record<string, unknown>,
  recipientId: string,
): Promise<NotificationDeliveryResult> {
  if (!template.email || !(await emailService.isConfigured())) {
    return {
      channel: "EMAIL",
      success: false,
      error: "Email not configured",
      timestamp: new Date(),
    };
  }

  const prisma = await getPrisma();
  const user = await prisma.user.findUnique({
    where: { id: recipientId },
    select: { email: true },
  });

  if (!user) {
    return {
      channel: "EMAIL",
      success: false,
      error: "User not found",
      timestamp: new Date(),
    };
  }

  const link = typeof data.link === "string" ? `\n\n${data.link}` : "";
  const result = await emailService.send({
    to: user.email,
    subject: template.email.subject(data),
    text: `${template.message(data)}${link}`,
  });

  return {
    channel: "EMAIL",
    success: result.success,
    messageId: result.messageId,
    error: result.error,
    timestamp: new Date(),
  };
}

/** Send Slack notification */
export async function sendSlack(
  slackClient: SlackClient | null,
  template: Template,
  data: Record<string, unknown>,
  recipientId: string,
): Promise<NotificationDeliveryResult> {
  if (!slackClient || !template.slack) {
    return {
      channel: "SLACK",
      success: false,
      error: "Slack not configured",
      timestamp: new Date(),
    };
  }

  const prefs = await getUserPreferences(recipientId);
  const channel = prefs.slack?.channelId;

  if (!channel) {
    return {
      channel: "SLACK",
      success: false,
      error: "No Slack channel configured for user",
      timestamp: new Date(),
    };
  }

  const blocks = template.slack.blocks(data);
  const result = await slackClient.postMessage({
    channel,
    text: template.title(data),
    blocks,
    attachments: [{ color: template.slack.color }],
  });

  return {
    channel: "SLACK",
    success: true,
    messageId: result.ts,
    timestamp: new Date(),
  };
}

/** Send Teams notification to the recipient's own incoming webhook */
export async function sendTeams(
  template: Template,
  data: Record<string, unknown>,
  recipientId: string,
): Promise<NotificationDeliveryResult> {
  if (!template.teams) {
    return {
      channel: "TEAMS",
      success: false,
      error: "Teams not configured",
      timestamp: new Date(),
    };
  }

  const prefs = await getUserPreferences(recipientId);
  const webhookUrl = prefs.teams?.webhookUrl;

  if (!webhookUrl) {
    return {
      channel: "TEAMS",
      success: false,
      error: "No Teams webhook configured for user",
      timestamp: new Date(),
    };
  }

  const card = template.teams.card(data);
  await createTeamsClient({ webhookUrl }).sendCard({ webhookUrl, card });

  return {
    channel: "TEAMS",
    success: true,
    timestamp: new Date(),
  };
}

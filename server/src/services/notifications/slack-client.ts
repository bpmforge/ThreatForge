/**
 * Slack Client
 *
 * Client for sending notifications to Slack channels and DMs.
 */

import type {
  SlackConfig,
  SlackNotification,
  SlackBlock,
  SlackAttachment,
} from "./types.js";

/** Build header + message + optional fields/link Slack blocks */
export function buildSlackBlocks(
  title: string,
  message: string,
  fields?: Array<{ title: string; value: string }>,
  link?: string,
): SlackBlock[] {
  const blocks: SlackBlock[] = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: title,
        emoji: true,
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: message,
      },
    },
  ];

  if (fields && fields.length > 0) {
    blocks.push({
      type: "section",
      fields: fields.map((f) => ({
        type: "mrkdwn",
        text: `*${f.title}:*\n${f.value}`,
      })),
    });
  }

  if (link) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `<${link}|View Details>`,
      },
    });
  }

  return blocks;
}

export class SlackClient {
  private botToken: string;
  private defaultChannel?: string;
  private baseUrl = "https://slack.com/api";

  constructor(config: SlackConfig) {
    this.botToken = config.botToken;
    this.defaultChannel = config.defaultChannel;
  }

  private async request<T>(
    method: string,
    body: Record<string, unknown>,
  ): Promise<T> {
    const response = await fetch(`${this.baseUrl}/${method}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.botToken}`,
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify(body),
    });

    const result = (await response.json()) as {
      ok: boolean;
      error?: string;
      ts?: string;
      channel?: string;
    };

    if (!result.ok) {
      throw new Error(`Slack API error: ${result.error}`);
    }

    return result as T;
  }

  /** Post a message to a channel */
  async postMessage(
    notification: SlackNotification,
  ): Promise<{ ts: string; channel: string }> {
    const channel = notification.channel || this.defaultChannel;
    if (!channel) {
      throw new Error("No channel specified and no default channel configured");
    }

    const payload: Record<string, unknown> = {
      channel,
      text: notification.text,
      unfurl_links: notification.unfurlLinks ?? false,
      unfurl_media: notification.unfurlMedia ?? true,
    };

    if (notification.blocks && notification.blocks.length > 0) {
      payload.blocks = notification.blocks;
    }

    if (notification.attachments && notification.attachments.length > 0) {
      payload.attachments = notification.attachments;
    }

    if (notification.threadTs) {
      payload.thread_ts = notification.threadTs;
    }

    return this.request<{ ts: string; channel: string }>(
      "chat.postMessage",
      payload,
    );
  }

  /** Send a direct message to a user */
  async sendDM(
    userId: string,
    text: string,
    blocks?: SlackBlock[],
    attachments?: SlackAttachment[],
  ): Promise<{ ts: string; channel: string }> {
    // Open a DM channel first
    const { channel } = await this.request<{ channel: { id: string } }>(
      "conversations.open",
      {
        users: userId,
      },
    );

    // Send the message
    return this.postMessage({
      channel: channel.id,
      text,
      blocks,
      attachments,
    });
  }

  /** Update an existing message */
  async updateMessage(
    channel: string,
    ts: string,
    text: string,
    blocks?: SlackBlock[],
  ): Promise<{ ts: string }> {
    const payload: Record<string, unknown> = {
      channel,
      ts,
      text,
    };

    if (blocks) {
      payload.blocks = blocks;
    }

    return this.request<{ ts: string }>("chat.update", payload);
  }

  /** Delete a message */
  async deleteMessage(channel: string, ts: string): Promise<void> {
    await this.request("chat.delete", { channel, ts });
  }

  /** Add a reaction to a message */
  async addReaction(channel: string, ts: string, emoji: string): Promise<void> {
    await this.request("reactions.add", {
      channel,
      timestamp: ts,
      name: emoji,
    });
  }

  /** Get user info by email */
  async getUserByEmail(
    email: string,
  ): Promise<{ id: string; name: string } | null> {
    try {
      const result = await this.request<{ user: { id: string; name: string } }>(
        "users.lookupByEmail",
        { email },
      );
      return result.user;
    } catch {
      return null;
    }
  }

  /** List channels the bot is a member of */
  async listChannels(): Promise<Array<{ id: string; name: string }>> {
    const result = await this.request<{
      channels: Array<{ id: string; name: string }>;
    }>("conversations.list", {
      types: "public_channel,private_channel",
      exclude_archived: true,
    });
    return result.channels;
  }

  /** Create a simple notification with severity color */
  static createColoredMessage(
    title: string,
    message: string,
    color: string,
    fields?: Array<{ title: string; value: string; short?: boolean }>,
    link?: string,
  ): SlackNotification {
    const blocks = buildSlackBlocks(title, message, fields, link);

    const attachments: SlackAttachment[] = [{ color, fallback: title }];

    return {
      channel: "",
      text: title,
      blocks,
      attachments,
    };
  }
}

/** Create Slack client from config */
export function createSlackClient(config: SlackConfig): SlackClient {
  return new SlackClient(config);
}

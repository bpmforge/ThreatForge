/**
 * Microsoft Teams Client
 *
 * Client for sending notifications to Microsoft Teams via incoming webhooks.
 */

import { assertPublicHttpUrl } from "../../utils/outbound-url.js";
import type {
  TeamsConfig,
  TeamsNotification,
  TeamsAdaptiveCard,
  TeamsCardElement,
} from "./types.js";

export class TeamsClient {
  private webhookUrl: string;

  constructor(config: TeamsConfig) {
    this.webhookUrl = config.webhookUrl;
  }

  /** Send an adaptive card to Teams */
  async sendCard(
    notification: TeamsNotification,
  ): Promise<{ success: boolean }> {
    const webhookUrl = notification.webhookUrl || this.webhookUrl;

    if (!webhookUrl) {
      throw new Error("No webhook URL provided");
    }
    // The URL is user-supplied (route or preferences PATCH): check it at send time.
    const urlError = await assertPublicHttpUrl(webhookUrl);
    if (urlError) {
      throw new Error(`Teams webhook rejected: ${urlError}`);
    }

    // Wrap the adaptive card in a message payload
    const payload = {
      type: "message",
      attachments: [
        {
          contentType: "application/vnd.microsoft.card.adaptive",
          contentUrl: null,
          content: notification.card,
        },
      ],
    };

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      redirect: "manual",
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Teams webhook error: ${response.status} - ${error}`);
    }

    return { success: true };
  }

  /** Create a simple notification card */
  static createSimpleCard(
    title: string,
    message: string,
    color?: "good" | "warning" | "attention" | "accent",
    link?: string,
    facts?: Array<{ title: string; value: string }>,
  ): TeamsAdaptiveCard {
    const body: TeamsCardElement[] = [
      {
        type: "TextBlock",
        text: title,
        size: "large",
        weight: "bolder",
        color: color || "accent",
        wrap: true,
      },
      {
        type: "TextBlock",
        text: message,
        wrap: true,
        spacing: "medium",
      },
    ];

    if (facts && facts.length > 0) {
      body.push({
        type: "FactSet",
        facts,
        spacing: "medium",
      });
    }

    const card: TeamsAdaptiveCard = {
      $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
      type: "AdaptiveCard",
      version: "1.4",
      body,
      actions: [],
    };

    if (link) {
      card.actions = [
        {
          type: "Action.OpenUrl",
          title: "View Details",
          url: link,
        },
      ];
    }

    return card;
  }

  /** Create a threat notification card */
  static createThreatCard(
    threatName: string,
    severity: string,
    modelName: string,
    description?: string,
    link?: string,
  ): TeamsAdaptiveCard {
    const severityColors: Record<
      string,
      "attention" | "warning" | "good" | "accent"
    > = {
      CRITICAL: "attention",
      HIGH: "attention",
      MEDIUM: "warning",
      LOW: "good",
      INFO: "accent",
    };

    const severityEmoji: Record<string, string> = {
      CRITICAL: "🔴",
      HIGH: "🟠",
      MEDIUM: "🟡",
      LOW: "🟢",
      INFO: "🔵",
    };

    const body: TeamsCardElement[] = [
      {
        type: "TextBlock",
        text: `${severityEmoji[severity] || "⚪"} New Threat Detected`,
        size: "large",
        weight: "bolder",
        color: severityColors[severity] || "accent",
        wrap: true,
      },
      {
        type: "TextBlock",
        text: threatName,
        size: "medium",
        weight: "bolder",
        wrap: true,
        spacing: "small",
      },
    ];

    if (description) {
      body.push({
        type: "TextBlock",
        text: description,
        wrap: true,
        spacing: "medium",
      });
    }

    body.push({
      type: "FactSet",
      facts: [
        { title: "Severity", value: severity },
        { title: "Model", value: modelName },
      ],
      spacing: "medium",
    });

    const card: TeamsAdaptiveCard = {
      $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
      type: "AdaptiveCard",
      version: "1.4",
      body,
      actions: [],
    };

    if (link) {
      card.actions = [
        {
          type: "Action.OpenUrl",
          title: "View in ThreatForge",
          url: link,
        },
      ];
    }

    return card;
  }

  /** Create a scan results card */
  static createScanResultsCard(
    scanType: string,
    totalFindings: number,
    criticalCount: number,
    highCount: number,
    mediumCount: number,
    lowCount: number,
    link?: string,
  ): TeamsAdaptiveCard {
    const statusColor: "attention" | "warning" | "good" =
      criticalCount > 0 ? "attention" : highCount > 0 ? "warning" : "good";

    const body: TeamsCardElement[] = [
      {
        type: "TextBlock",
        text: `🔍 ${scanType} Scan Results`,
        size: "large",
        weight: "bolder",
        color: statusColor,
        wrap: true,
      },
      {
        type: "TextBlock",
        text: `Found ${totalFindings} findings requiring attention.`,
        wrap: true,
        spacing: "medium",
      },
      {
        type: "ColumnSet",
        columns: [
          {
            type: "Column",
            items: [
              {
                type: "TextBlock",
                text: "🔴 Critical",
                weight: "bolder",
              },
              {
                type: "TextBlock",
                text: String(criticalCount),
                size: "extraLarge",
                color: criticalCount > 0 ? "attention" : "default",
              },
            ],
          },
          {
            type: "Column",
            items: [
              {
                type: "TextBlock",
                text: "🟠 High",
                weight: "bolder",
              },
              {
                type: "TextBlock",
                text: String(highCount),
                size: "extraLarge",
                color: highCount > 0 ? "warning" : "default",
              },
            ],
          },
          {
            type: "Column",
            items: [
              {
                type: "TextBlock",
                text: "🟡 Medium",
                weight: "bolder",
              },
              {
                type: "TextBlock",
                text: String(mediumCount),
                size: "extraLarge",
              },
            ],
          },
          {
            type: "Column",
            items: [
              {
                type: "TextBlock",
                text: "🟢 Low",
                weight: "bolder",
              },
              {
                type: "TextBlock",
                text: String(lowCount),
                size: "extraLarge",
              },
            ],
          },
        ],
      } as unknown as TeamsCardElement,
    ];

    const card: TeamsAdaptiveCard = {
      $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
      type: "AdaptiveCard",
      version: "1.4",
      body,
      actions: [],
    };

    if (link) {
      card.actions = [
        {
          type: "Action.OpenUrl",
          title: "View Full Report",
          url: link,
        },
      ];
    }

    return card;
  }
}

/** Create Teams client from config */
export function createTeamsClient(config: TeamsConfig): TeamsClient {
  return new TeamsClient(config);
}

/**
 * Notification Templates
 *
 * Predefined templates for different notification types.
 */

import type {
  NotificationTemplate,
  NotificationEventType,
  TeamsAdaptiveCard,
} from "./types.js";
import { buildSlackBlocks } from "./slack-client.js";

// Severity colors
const SEVERITY_COLORS = {
  CRITICAL: "#dc2626",
  HIGH: "#ea580c",
  MEDIUM: "#f59e0b",
  LOW: "#22c55e",
  INFO: "#3b82f6",
};

const STATUS_COLORS = {
  success: "#22c55e",
  warning: "#f59e0b",
  error: "#dc2626",
  info: "#3b82f6",
};

// Helper to get severity color
function getSeverityColor(severity: string): string {
  return (
    SEVERITY_COLORS[severity as keyof typeof SEVERITY_COLORS] ||
    SEVERITY_COLORS.INFO
  );
}

// Base Teams adaptive card
function createTeamsCard(
  title: string,
  body: string,
  color: string,
  link?: string,
  facts?: Array<{ title: string; value: string }>,
): TeamsAdaptiveCard {
  const card: TeamsAdaptiveCard = {
    $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
    type: "AdaptiveCard",
    version: "1.4",
    body: [
      {
        type: "TextBlock",
        text: title,
        size: "large",
        weight: "bolder",
        color: "accent",
        wrap: true,
      },
      {
        type: "TextBlock",
        text: body,
        wrap: true,
        spacing: "medium",
      },
    ],
    actions: [],
  };

  if (facts && facts.length > 0) {
    card.body.push({
      type: "FactSet",
      facts,
      spacing: "medium",
    });
  }

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

// Notification templates
const NOTIFICATION_TEMPLATES: Partial<
  Record<NotificationEventType, NotificationTemplate>
> = {
  // Threat events
  THREAT_CREATED: {
    type: "THREAT_CREATED",
    title: (d) => `New threat: ${d.threatName}`,
    message: (d) =>
      `A new ${d.severity} severity threat "${d.threatName}" has been identified in ${d.modelName}.`,
    email: {
      subject: (d) => `[${d.severity}] New Threat: ${d.threatName}`,
    },
    slack: {
      blocks: (d) =>
        buildSlackBlocks(
          `New Threat Identified`,
          `A new *${d.severity}* severity threat has been identified.`,
          [
            { title: "Threat", value: String(d.threatName) },
            { title: "Model", value: String(d.modelName) },
            { title: "Category", value: String(d.category || "N/A") },
          ],
          d.link as string,
        ),
      color: getSeverityColor(String("HIGH")),
    },
    teams: {
      card: (d) =>
        createTeamsCard(
          "New Threat Identified",
          `A new ${d.severity} severity threat "${d.threatName}" has been identified.`,
          getSeverityColor(String(d.severity)),
          d.link as string,
          [
            { title: "Threat", value: String(d.threatName) },
            { title: "Model", value: String(d.modelName) },
            { title: "Severity", value: String(d.severity) },
          ],
        ),
    },
  },

  CRITICAL_THREAT_DETECTED: {
    type: "CRITICAL_THREAT_DETECTED",
    title: (d) => `CRITICAL: ${d.threatName}`,
    message: (d) =>
      `A critical severity threat "${d.threatName}" requires immediate attention in ${d.modelName}.`,
    email: {
      subject: (d) => `[CRITICAL] Immediate Action Required: ${d.threatName}`,
    },
    slack: {
      blocks: (d) =>
        buildSlackBlocks(
          ":rotating_light: Critical Threat Detected",
          `*Immediate attention required!*\n\nA critical severity threat has been detected and requires immediate review.`,
          [
            { title: "Threat", value: String(d.threatName) },
            { title: "Model", value: String(d.modelName) },
            { title: "Component", value: String(d.componentName || "N/A") },
          ],
          d.link as string,
        ),
      color: SEVERITY_COLORS.CRITICAL,
    },
    teams: {
      card: (d) =>
        createTeamsCard(
          "Critical Threat Detected",
          `Immediate attention required! A critical threat "${d.threatName}" has been detected.`,
          SEVERITY_COLORS.CRITICAL,
          d.link as string,
          [
            { title: "Threat", value: String(d.threatName) },
            { title: "Model", value: String(d.modelName) },
            { title: "Component", value: String(d.componentName || "N/A") },
          ],
        ),
    },
  },

  THREAT_ASSIGNED: {
    type: "THREAT_ASSIGNED",
    title: (d) => `Threat assigned to you: ${d.threatName}`,
    message: (d) =>
      `${d.assignerName} has assigned you to address the threat "${d.threatName}" in ${d.modelName}.`,
    email: {
      subject: (d) => `Threat Assigned: ${d.threatName}`,
    },
    slack: {
      blocks: (d) =>
        buildSlackBlocks(
          "Threat Assigned to You",
          `You have been assigned to address a threat.`,
          [
            { title: "Threat", value: String(d.threatName) },
            { title: "Assigned By", value: String(d.assignerName) },
            { title: "Severity", value: String(d.severity) },
          ],
          d.link as string,
        ),
      color: STATUS_COLORS.info,
    },
    teams: {
      card: (d) =>
        createTeamsCard(
          "Threat Assigned to You",
          `${d.assignerName} has assigned you to address the threat "${d.threatName}".`,
          STATUS_COLORS.info,
          d.link as string,
          [
            { title: "Threat", value: String(d.threatName) },
            { title: "Severity", value: String(d.severity) },
            { title: "Model", value: String(d.modelName) },
          ],
        ),
    },
  },

  // Mitigation events
  MITIGATION_COMPLETED: {
    type: "MITIGATION_COMPLETED",
    title: (d) => `Mitigation completed: ${d.mitigationName}`,
    message: (d) =>
      `The mitigation "${d.mitigationName}" for threat "${d.threatName}" has been marked as completed.`,
    email: {
      subject: (d) => `Mitigation Completed: ${d.mitigationName}`,
    },
    slack: {
      blocks: (d) =>
        buildSlackBlocks(
          ":white_check_mark: Mitigation Completed",
          `A mitigation has been completed.`,
          [
            { title: "Mitigation", value: String(d.mitigationName) },
            { title: "Threat", value: String(d.threatName) },
            { title: "Completed By", value: String(d.completedByName) },
          ],
          d.link as string,
        ),
      color: STATUS_COLORS.success,
    },
    teams: {
      card: (d) =>
        createTeamsCard(
          "Mitigation Completed",
          `The mitigation "${d.mitigationName}" has been completed.`,
          STATUS_COLORS.success,
          d.link as string,
          [
            { title: "Threat", value: String(d.threatName) },
            { title: "Completed By", value: String(d.completedByName) },
          ],
        ),
    },
  },

  MITIGATION_OVERDUE: {
    type: "MITIGATION_OVERDUE",
    title: (d) => `Overdue mitigation: ${d.mitigationName}`,
    message: (d) =>
      `The mitigation "${d.mitigationName}" is overdue. Due date was ${d.dueDate}.`,
    email: {
      subject: (d) => `[OVERDUE] Mitigation: ${d.mitigationName}`,
    },
    slack: {
      blocks: (d) =>
        buildSlackBlocks(
          ":warning: Mitigation Overdue",
          `A mitigation is past its due date.`,
          [
            { title: "Mitigation", value: String(d.mitigationName) },
            { title: "Due Date", value: String(d.dueDate) },
            {
              title: "Assignee",
              value: String(d.assigneeName || "Unassigned"),
            },
          ],
          d.link as string,
        ),
      color: STATUS_COLORS.warning,
    },
    teams: {
      card: (d) =>
        createTeamsCard(
          "Mitigation Overdue",
          `The mitigation "${d.mitigationName}" is past its due date.`,
          STATUS_COLORS.warning,
          d.link as string,
          [
            { title: "Due Date", value: String(d.dueDate) },
            {
              title: "Assignee",
              value: String(d.assigneeName || "Unassigned"),
            },
          ],
        ),
    },
  },

  // Scan events
  SCAN_COMPLETED: {
    type: "SCAN_COMPLETED",
    title: (d) => `Scan completed: ${d.scanType}`,
    message: (d) =>
      `${d.scanType} scan completed. Found ${d.findingsCount} findings (${d.criticalCount} critical, ${d.highCount} high).`,
    email: {
      subject: (d) => `Scan Completed: ${d.findingsCount} Findings`,
    },
    slack: {
      blocks: (d) =>
        buildSlackBlocks(
          ":mag: Scan Completed",
          `A security scan has completed.`,
          [
            { title: "Scanner", value: String(d.scanType) },
            { title: "Total", value: String(d.findingsCount) },
            { title: "Critical", value: String(d.criticalCount) },
            { title: "High", value: String(d.highCount) },
          ],
          d.link as string,
        ),
      color: STATUS_COLORS.info,
    },
    teams: {
      card: (d) =>
        createTeamsCard(
          "Security Scan Completed",
          `${d.scanType} scan has completed with ${d.findingsCount} findings.`,
          (d.criticalCount as number) > 0
            ? STATUS_COLORS.error
            : STATUS_COLORS.info,
          d.link as string,
          [
            { title: "Critical", value: String(d.criticalCount) },
            { title: "High", value: String(d.highCount) },
            { title: "Medium", value: String(d.mediumCount) },
            { title: "Low", value: String(d.lowCount) },
          ],
        ),
    },
  },

  CI_SCAN_FAILED: {
    type: "CI_SCAN_FAILED",
    title: (d) => `CI scan failed: ${d.repositoryId}`,
    message: (d) =>
      `CI scan for PR #${d.prNumber} failed with ${d.criticalCount} critical and ${d.highCount} high severity threats.`,
    email: {
      subject: (d) => `[FAILED] CI Scan: ${d.repositoryId} PR #${d.prNumber}`,
    },
    slack: {
      blocks: (d) =>
        buildSlackBlocks(
          ":x: CI Scan Failed",
          `CI scan has failed due to security threats.`,
          [
            { title: "Repository", value: String(d.repositoryId) },
            { title: "PR", value: `#${d.prNumber}` },
            { title: "Critical", value: String(d.criticalCount) },
            { title: "High", value: String(d.highCount) },
          ],
          d.link as string,
        ),
      color: STATUS_COLORS.error,
    },
    teams: {
      card: (d) =>
        createTeamsCard(
          "CI Scan Failed",
          `The CI scan for PR #${d.prNumber} has failed due to security threats.`,
          STATUS_COLORS.error,
          d.link as string,
          [
            { title: "Repository", value: String(d.repositoryId) },
            { title: "Critical", value: String(d.criticalCount) },
            { title: "High", value: String(d.highCount) },
          ],
        ),
    },
  },

  // Organization events
  ORG_INVITATION_RECEIVED: {
    type: "ORG_INVITATION_RECEIVED",
    title: (d) => `Invitation to join ${d.organizationName}`,
    message: (d) =>
      `${d.inviterName} has invited you to join the organization "${d.organizationName}" as ${d.role}.`,
    email: {
      subject: (d) => `Invitation to Join ${d.organizationName}`,
    },
    slack: {
      blocks: (d) =>
        buildSlackBlocks(
          ":envelope: Organization Invitation",
          `You've been invited to join an organization.`,
          [
            { title: "Organization", value: String(d.organizationName) },
            { title: "Invited By", value: String(d.inviterName) },
            { title: "Role", value: String(d.role) },
          ],
          d.link as string,
        ),
      color: STATUS_COLORS.info,
    },
    teams: {
      card: (d) =>
        createTeamsCard(
          "Organization Invitation",
          `You've been invited to join "${d.organizationName}" by ${d.inviterName}.`,
          STATUS_COLORS.info,
          d.link as string,
          [{ title: "Role", value: String(d.role) }],
        ),
    },
  },

  // Model events
  MODEL_SHARED: {
    type: "MODEL_SHARED",
    title: (d) => `Model shared: ${d.modelName}`,
    message: (d) =>
      `${d.sharerName} has shared the threat model "${d.modelName}" with you.`,
    email: {
      subject: (d) => `Threat Model Shared: ${d.modelName}`,
    },
    slack: {
      blocks: (d) =>
        buildSlackBlocks(
          ":link: Model Shared With You",
          `A threat model has been shared with you.`,
          [
            { title: "Model", value: String(d.modelName) },
            { title: "Shared By", value: String(d.sharerName) },
            { title: "Permission", value: String(d.permission) },
          ],
          d.link as string,
        ),
      color: STATUS_COLORS.info,
    },
    teams: {
      card: (d) =>
        createTeamsCard(
          "Model Shared With You",
          `${d.sharerName} has shared the threat model "${d.modelName}" with you.`,
          STATUS_COLORS.info,
          d.link as string,
          [{ title: "Permission", value: String(d.permission) }],
        ),
    },
  },

  // Mention
  MENTION: {
    type: "MENTION",
    title: (d) => `${d.mentionerName} mentioned you`,
    message: (d) =>
      `${d.mentionerName} mentioned you in ${d.context}: "${d.snippet}"`,
    email: {
      subject: (d) => `${d.mentionerName} mentioned you`,
    },
    slack: {
      blocks: (d) =>
        buildSlackBlocks(
          ":speech_balloon: You Were Mentioned",
          `${d.mentionerName} mentioned you.`,
          [
            { title: "Context", value: String(d.context) },
            { title: "Message", value: String(d.snippet) },
          ],
          d.link as string,
        ),
      color: STATUS_COLORS.info,
    },
    teams: {
      card: (d) =>
        createTeamsCard(
          "You Were Mentioned",
          `${d.mentionerName} mentioned you: "${d.snippet}"`,
          STATUS_COLORS.info,
          d.link as string,
        ),
    },
  },

  // Weekly digest
  MODEL_STALE: {
    type: "MODEL_STALE",
    title: (d) =>
      d.staleness === "critical"
        ? `⚠️ Threat model critically stale: ${d.modelName}`
        : `Threat model needs review: ${d.modelName}`,
    message: (d) =>
      `"${d.modelName}" (${d.projectName}) hasn't been updated in ${d.daysSinceUpdate} days` +
      (d.openThreatCount
        ? ` and has ${d.openThreatCount} open threat${d.openThreatCount === 1 ? "" : "s"}.`
        : "."),
    email: {
      subject: (d) =>
        d.staleness === "critical"
          ? `[Action Required] Threat model stale: ${d.modelName}`
          : `[Reminder] Threat model needs review: ${d.modelName}`,
    },
  },
  WEEKLY_DIGEST: {
    type: "WEEKLY_DIGEST",
    title: () => `Your weekly threat model digest`,
    message: (d) =>
      `This week: ${d.threatsCreated} new threats, ${d.mitigationsCompleted} mitigations completed.`,
    email: {
      subject: () => `Weekly Threat Model Digest`,
    },
    slack: {
      blocks: (d) =>
        buildSlackBlocks(
          ":calendar: Weekly Digest",
          `Here's your weekly summary.`,
          [
            { title: "New Threats", value: String(d.threatsCreated) },
            {
              title: "Mitigations Completed",
              value: String(d.mitigationsCompleted),
            },
            { title: "Open Critical", value: String(d.openCritical) },
            { title: "Open High", value: String(d.openHigh) },
          ],
          d.link as string,
        ),
      color: STATUS_COLORS.info,
    },
    teams: {
      card: (d) =>
        createTeamsCard(
          "Weekly Threat Model Digest",
          `Here's your weekly summary of threat model activity.`,
          STATUS_COLORS.info,
          d.link as string,
          [
            { title: "New Threats", value: String(d.threatsCreated) },
            {
              title: "Mitigations Completed",
              value: String(d.mitigationsCompleted),
            },
            { title: "Open Critical", value: String(d.openCritical) },
          ],
        ),
    },
  },
};

// Get template by event type
export function getNotificationTemplate(
  type: NotificationEventType,
): NotificationTemplate | null {
  return NOTIFICATION_TEMPLATES[type] || null;
}

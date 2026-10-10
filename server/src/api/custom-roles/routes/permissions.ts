/**
 * Custom Roles - Permissions endpoint (list available permissions).
 */
import type { FastifyPluginAsync } from "fastify";
import { PERMISSION_PRESETS } from "../helpers.js";
import { routeAuthz } from "../../../middleware/authz-policy.js";

const AUTHENTICATED = routeAuthz("authenticated");

export const permissionRoutes: FastifyPluginAsync = async (server) => {
  /** GET /api/permissions - Get all available permissions with descriptions. */
  server.get("/api/permissions", AUTHENTICATED, async () => {
    return {
      permissions: [
        // Organization-level
        {
          id: "ORG_VIEW",
          category: "Organization",
          label: "View Organization",
          description: "View organization details",
        },
        {
          id: "ORG_EDIT",
          category: "Organization",
          label: "Edit Organization",
          description: "Edit organization settings",
        },
        {
          id: "ORG_DELETE",
          category: "Organization",
          label: "Delete Organization",
          description: "Delete organization",
        },
        {
          id: "ORG_MANAGE_MEMBERS",
          category: "Organization",
          label: "Manage Members",
          description: "Invite/remove members, change roles",
        },
        {
          id: "ORG_MANAGE_SSO",
          category: "Organization",
          label: "Manage SSO",
          description: "Configure SSO settings",
        },
        {
          id: "ORG_MANAGE_WEBHOOKS",
          category: "Organization",
          label: "Manage Webhooks",
          description: "Configure webhooks",
        },
        {
          id: "ORG_VIEW_AUDIT",
          category: "Organization",
          label: "View Audit Logs",
          description: "View audit logs",
        },
        {
          id: "ORG_EXPORT_AUDIT",
          category: "Organization",
          label: "Export Audit Logs",
          description: "Export audit logs",
        },

        // Project-level
        {
          id: "PROJECT_CREATE",
          category: "Projects",
          label: "Create Projects",
          description: "Create new projects",
        },
        {
          id: "PROJECT_VIEW",
          category: "Projects",
          label: "View Projects",
          description: "View project details",
        },
        {
          id: "PROJECT_EDIT",
          category: "Projects",
          label: "Edit Projects",
          description: "Edit project settings",
        },
        {
          id: "PROJECT_DELETE",
          category: "Projects",
          label: "Delete Projects",
          description: "Delete projects",
        },
        {
          id: "PROJECT_ARCHIVE",
          category: "Projects",
          label: "Archive Projects",
          description: "Archive/unarchive projects",
        },

        // Threat Model-level
        {
          id: "MODEL_CREATE",
          category: "Threat Models",
          label: "Create Models",
          description: "Create new threat models",
        },
        {
          id: "MODEL_VIEW",
          category: "Threat Models",
          label: "View Models",
          description: "View threat model details",
        },
        {
          id: "MODEL_EDIT",
          category: "Threat Models",
          label: "Edit Models",
          description: "Edit threat models",
        },
        {
          id: "MODEL_DELETE",
          category: "Threat Models",
          label: "Delete Models",
          description: "Delete threat models",
        },
        {
          id: "MODEL_EXPORT",
          category: "Threat Models",
          label: "Export Models",
          description: "Export to PDF, JSON, etc.",
        },
        {
          id: "MODEL_SHARE",
          category: "Threat Models",
          label: "Share Models",
          description: "Share with guests",
        },
        {
          id: "MODEL_VERSION",
          category: "Threat Models",
          label: "Manage Versions",
          description: "Create/restore versions",
        },

        // Threats & Mitigations
        {
          id: "THREAT_CREATE",
          category: "Threats",
          label: "Create Threats",
          description: "Create threats",
        },
        {
          id: "THREAT_EDIT",
          category: "Threats",
          label: "Edit Threats",
          description: "Edit threats",
        },
        {
          id: "THREAT_DELETE",
          category: "Threats",
          label: "Delete Threats",
          description: "Delete threats",
        },
        {
          id: "THREAT_ASSIGN",
          category: "Threats",
          label: "Assign Threats",
          description: "Assign threats to team members",
        },
        {
          id: "MITIGATION_CREATE",
          category: "Mitigations",
          label: "Create Mitigations",
          description: "Create mitigations",
        },
        {
          id: "MITIGATION_EDIT",
          category: "Mitigations",
          label: "Edit Mitigations",
          description: "Edit mitigations",
        },
        {
          id: "MITIGATION_DELETE",
          category: "Mitigations",
          label: "Delete Mitigations",
          description: "Delete mitigations",
        },
        {
          id: "MITIGATION_ASSIGN",
          category: "Mitigations",
          label: "Assign Mitigations",
          description: "Assign to team members",
        },

        // AI Features
        {
          id: "AI_SUGGEST_THREATS",
          category: "AI",
          label: "Suggest Threats",
          description: "Use AI to suggest threats",
        },
        {
          id: "AI_CHAT",
          category: "AI",
          label: "AI Chat",
          description: "Use AI chat features",
        },
        {
          id: "AI_ANALYZE",
          category: "AI",
          label: "AI Analysis",
          description: "Use AI analysis features",
        },

        // Library Access
        {
          id: "LIBRARY_VIEW",
          category: "Libraries",
          label: "View Libraries",
          description: "View threat/component libraries",
        },
        {
          id: "LIBRARY_EDIT",
          category: "Libraries",
          label: "Edit Libraries",
          description: "Edit library items",
        },
        {
          id: "LIBRARY_CREATE",
          category: "Libraries",
          label: "Create Library Items",
          description: "Create library items",
        },
        {
          id: "LIBRARY_DELETE",
          category: "Libraries",
          label: "Delete Library Items",
          description: "Delete library items",
        },
      ],
      presets: Object.entries(PERMISSION_PRESETS).map(
        ([name, permissions]) => ({
          name,
          permissions,
        }),
      ),
    };
  });
};

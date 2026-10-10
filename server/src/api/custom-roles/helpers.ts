/**
 * Custom Roles - Shared types, permission presets, and helpers.
 */
import type { Permission } from "@prisma/client";

// Re-export commonly used utilities for sub-routes
export { getPrisma } from "../../db.js";
export { getAuthUser } from "../../utils/auth-helpers.js";
export { checkOrganizationAccess } from "../../services/access-control/access-control-service.js";
export { logAudit } from "../../services/audit.js";
export {
  sendBadRequest,
  sendForbidden,
  sendNotFound,
} from "../../utils/api-response.js";

// =============================================================================
// Types
// =============================================================================

export interface CreateRoleBody {
  name: string;
  description?: string;
  color?: string;
  permissions: Permission[];
}

export interface UpdateRoleBody {
  name?: string;
  description?: string;
  color?: string;
  permissions?: Permission[];
}

// =============================================================================
// Permission Presets
// =============================================================================

export const PERMISSION_PRESETS = {
  VIEWER: ["ORG_VIEW", "PROJECT_VIEW", "MODEL_VIEW", "LIBRARY_VIEW"],
  EDITOR: [
    "ORG_VIEW",
    "PROJECT_VIEW",
    "MODEL_VIEW",
    "MODEL_EDIT",
    "THREAT_CREATE",
    "THREAT_EDIT",
    "MITIGATION_CREATE",
    "MITIGATION_EDIT",
    "LIBRARY_VIEW",
    "AI_SUGGEST_THREATS",
    "AI_CHAT",
  ],
  SECURITY_REVIEWER: [
    "ORG_VIEW",
    "PROJECT_VIEW",
    "MODEL_VIEW",
    "MODEL_EXPORT",
    "THREAT_CREATE",
    "THREAT_EDIT",
    "THREAT_ASSIGN",
    "MITIGATION_CREATE",
    "MITIGATION_EDIT",
    "MITIGATION_ASSIGN",
    "LIBRARY_VIEW",
    "LIBRARY_EDIT",
    "AI_SUGGEST_THREATS",
    "AI_CHAT",
    "AI_ANALYZE",
  ],
  PROJECT_MANAGER: [
    "ORG_VIEW",
    "PROJECT_CREATE",
    "PROJECT_VIEW",
    "PROJECT_EDIT",
    "MODEL_CREATE",
    "MODEL_VIEW",
    "MODEL_EDIT",
    "MODEL_DELETE",
    "MODEL_EXPORT",
    "MODEL_SHARE",
    "THREAT_ASSIGN",
    "MITIGATION_ASSIGN",
    "LIBRARY_VIEW",
  ],
  ADMIN: [
    "ORG_VIEW",
    "ORG_EDIT",
    "ORG_MANAGE_MEMBERS",
    "ORG_MANAGE_WEBHOOKS",
    "ORG_VIEW_AUDIT",
    "PROJECT_CREATE",
    "PROJECT_VIEW",
    "PROJECT_EDIT",
    "PROJECT_DELETE",
    "PROJECT_ARCHIVE",
    "MODEL_CREATE",
    "MODEL_VIEW",
    "MODEL_EDIT",
    "MODEL_DELETE",
    "MODEL_EXPORT",
    "MODEL_SHARE",
    "MODEL_VERSION",
    "THREAT_CREATE",
    "THREAT_EDIT",
    "THREAT_DELETE",
    "THREAT_ASSIGN",
    "MITIGATION_CREATE",
    "MITIGATION_EDIT",
    "MITIGATION_DELETE",
    "MITIGATION_ASSIGN",
    "AI_SUGGEST_THREATS",
    "AI_CHAT",
    "AI_ANALYZE",
    "LIBRARY_VIEW",
    "LIBRARY_EDIT",
    "LIBRARY_CREATE",
    "LIBRARY_DELETE",
  ],
} as const;

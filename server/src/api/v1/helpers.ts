/**
 * V1 API Helpers
 *
 * Common utilities for v1 API routes.
 */
import type { AuditAction, AuditScope, ResourceType } from "@prisma/client";
import { checkOrganizationAccess as checkOrgAccess } from "../../services/access-control/access-control-service.js";
import { logAudit as logAuditOriginal } from "../../services/audit.js";

export { getAuthUser } from "../../utils/auth-helpers.js";

/**
 * Result of organization access check with simplified interface for v1 APIs.
 */
export interface OrgAccessResult {
  hasAccess: boolean;
  role?: string;
}

/**
 * Check organization access - returns simplified result for v1 APIs.
 */
export async function checkOrganizationAccess(
  userId: string,
  organizationId: string,
): Promise<OrgAccessResult | null> {
  const result = await checkOrgAccess(userId, organizationId);
  if (!result.hasAccess) {
    return null;
  }
  return {
    hasAccess: true,
    role: result.role,
  };
}

/**
 * Acting with the organization's stored integration credentials (creating
 * Jira/GitHub issues, syncing, reading repositories) needs EDITOR or above.
 */
export function canUseOrgCredentials(access: OrgAccessResult | null): boolean {
  return !!access && ["OWNER", "ADMIN", "EDITOR"].includes(access.role ?? "");
}

/**
 * Audit log entry for v1 APIs
 */
export interface V1AuditLogEntry {
  scope?: AuditScope | "ORGANIZATION" | "SYSTEM" | "MODEL";
  action: AuditAction | "CREATE" | "UPDATE" | "DELETE" | "VIEW" | "EXPORT";
  resourceType:
    | ResourceType
    | "THREAT_MODEL"
    | "PROJECT"
    | "ORGANIZATION"
    | "THREAT"
    | "MITIGATION"
    | "THREAT_LIBRARY";
  resourceId: string;
  resourceName?: string;
  userId: string;
  userEmail: string;
  organizationId?: string;
  modelId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Log an audit event with v1 API-compatible types.
 */
export async function logAudit(entry: V1AuditLogEntry): Promise<void> {
  return logAuditOriginal({
    scope: entry.scope as AuditScope,
    action: entry.action as AuditAction,
    resourceType: entry.resourceType as ResourceType,
    resourceId: entry.resourceId,
    resourceName: entry.resourceName,
    userId: entry.userId,
    userEmail: entry.userEmail,
    organizationId: entry.organizationId,
    modelId: entry.modelId,
    metadata: entry.metadata,
  });
}

/**
 * Re-export other access control functions.
 */

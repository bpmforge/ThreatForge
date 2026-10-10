/**
 * Threat Model API - Helper Functions
 */
import type { FastifyReply } from "fastify";
import {
  canPerformAction,
  checkThreatModelAccess,
  getOrgIdFromModel,
  isActiveOrgMember,
  type Permission,
} from "../../services/access-control/access-control-service.js";
import {
  sendBadRequest,
  sendForbidden,
  sendNotFound,
} from "../../utils/api-response.js";
import { getPrisma } from "../../db.js";
import { authorizeProject } from "../projects/helpers.js";

export { getAuthUser } from "../../utils/auth-helpers.js";

export async function canAccessThreatModel(
  userId: string,
  threatModelId: string,
): Promise<boolean> {
  const access = await checkThreatModelAccess(userId, threatModelId);
  return access.hasAccess;
}

/** True when the user may edit the threat model (spends its org's AI budget). */
export async function canEditThreatModel(
  userId: string,
  threatModelId: string,
): Promise<boolean> {
  return (await canPerformAction(userId, threatModelId, "edit")).allowed;
}

/**
 * Authorize `action` on a threat model. On refusal, sends 404 (no access or
 * no such model — indistinguishable on purpose) or 403 (role lacks the
 * permission) and returns false; the caller should `return reply`.
 */
export async function authorizeModelAction(
  reply: FastifyReply,
  userId: string,
  threatModelId: string,
  action: Permission,
): Promise<boolean> {
  const actionCheck = await canPerformAction(userId, threatModelId, action);
  if (actionCheck.allowed) return true;
  if (!actionCheck.access?.hasAccess) {
    sendNotFound(reply, "Threat model");
  } else {
    sendForbidden(reply, actionCheck.error);
  }
  return false;
}

/**
 * Authorize exporting a threat model (YAML, DOCX). Members with view access
 * may export; guests also need the export right on their share. Sends 404/403
 * like authorizeModelAction and returns false on refusal.
 */
export async function authorizeModelExport(
  reply: FastifyReply,
  userId: string,
  threatModelId: string,
): Promise<boolean> {
  const access = await checkThreatModelAccess(userId, threatModelId);
  if (!access.hasAccess) {
    sendNotFound(reply, "Threat model");
    return false;
  }
  if (access.isGuest && !access.permissions.includes("export")) {
    sendForbidden(reply, "This share does not allow exporting");
    return false;
  }
  return true;
}

/** Org roles that may create projects and models. */
export const CREATOR_ROLES: ("OWNER" | "ADMIN" | "EDITOR")[] = [
  "OWNER",
  "ADMIN",
  "EDITOR",
];

/**
 * The project a new threat model goes into. With a projectId the caller needs
 * edit on that project (404 no access, 403 VIEWER). Without one, the first
 * project of an org where the caller is EDITOR or above — never one where they
 * only view (400 when there is none). Sends the refusal and returns null.
 */
export async function resolveModelTargetProject(
  reply: FastifyReply,
  userId: string,
  projectId: string | undefined,
): Promise<string | null> {
  if (projectId) {
    return (await authorizeProject(reply, userId, projectId, "edit"))
      ? projectId
      : null;
  }
  const projectIdFound = await firstEditableProjectId(userId);
  if (!projectIdFound) {
    sendBadRequest(
      reply,
      "No project available in an organization where you can edit. Create a project first.",
    );
  }
  return projectIdFound;
}

/** First project of an org where the caller is an ACTIVE EDITOR or above. */
export async function firstEditableProjectId(
  userId: string,
): Promise<string | null> {
  const prisma = await getPrisma();
  const project = await prisma.project.findFirst({
    where: {
      organization: {
        memberships: {
          some: { userId, status: "ACTIVE", role: { in: CREATOR_ROLES } },
        },
      },
    },
    select: { id: true },
  });
  return project?.id ?? null;
}

/**
 * Authorize `action` on the threat model a threat belongs to. A missing threat
 * and an unreachable one are the same 404. Returns false after replying.
 */
export async function authorizeThreatAction(
  reply: FastifyReply,
  userId: string,
  threatId: string,
  action: Permission,
): Promise<boolean> {
  const prisma = await getPrisma();
  const threat = await prisma.threat.findUnique({
    where: { id: threatId },
    select: { threatModelId: true },
  });
  if (!threat) {
    sendNotFound(reply, "Threat model");
    return false;
  }
  return authorizeModelAction(reply, userId, threat.threatModelId, action);
}

/**
 * Like authorizeModelAction, but guests are refused (403) whatever their
 * grant: for actions that reach beyond the one model a guest was invited to,
 * such as creating models in its project or minting public links.
 */
export async function authorizeMemberModelAction(
  reply: FastifyReply,
  userId: string,
  threatModelId: string,
  action: Permission,
): Promise<boolean> {
  const access = await checkThreatModelAccess(userId, threatModelId);
  if (!access.hasAccess) {
    sendNotFound(reply, "Threat model");
    return false;
  }
  if (access.isGuest || !access.permissions.includes(action)) {
    sendForbidden(
      reply,
      `Requires an organization member with '${action}' permission`,
    );
    return false;
  }
  return true;
}

/**
 * Require edit permission on a threat model (sends 404/403 and returns false
 * when refused). Returns a boolean, not the reply: a FastifyReply is thenable,
 * so an async function cannot hand it back without awaiting the send.
 */
export function requireThreatModelEdit(
  userId: string,
  threatModelId: string,
  reply: FastifyReply,
): Promise<boolean> {
  return authorizeModelAction(reply, userId, threatModelId, "edit");
}

/**
 * An assignee/owner must be an ACTIVE member of the model's organization.
 * Unset/null passes. Replies 400 and returns false otherwise.
 */
export async function requireActiveOrgMemberOfModel(
  reply: FastifyReply,
  threatModelId: string,
  memberId: string | null | undefined,
  label = "Assignee",
): Promise<boolean> {
  if (!memberId) return true;
  const orgId = await getOrgIdFromModel(threatModelId);
  if (!orgId || !(await isActiveOrgMember(memberId, orgId))) {
    sendBadRequest(
      reply,
      `${label} must be an active member of the organization`,
    );
    return false;
  }
  return true;
}

/**
 * Every requirement id must belong to the given threat model.
 * Replies 400 and returns false otherwise.
 */
export async function requireRequirementsInModel(
  reply: FastifyReply,
  threatModelId: string,
  requirementIds: string[] | null | undefined,
): Promise<boolean> {
  const ids = [...new Set(requirementIds ?? [])];
  if (ids.length === 0) return true;
  const prisma = await getPrisma();
  const count = await prisma.requirement.count({
    where: { id: { in: ids }, threatModelId },
  });
  if (count !== ids.length) {
    sendBadRequest(reply, "Unknown requirement for this threat model");
    return false;
  }
  return true;
}

/**
 * Access Control Service
 *
 * Centralized access control for resources:
 * - Organization membership checks
 * - Role-based permission checks (basic + custom roles)
 * - Guest access integration
 * - Resource-level access validation
 */
import { getPrisma } from "../../db.js";
import type { MemberRole, GuestRole } from "@prisma/client";

/** Permission levels for different operations */
export type Permission =
  | "view" // Can view resource
  | "comment" // Can add comments
  | "edit" // Can modify resource
  | "delete" // Can delete resource
  | "manage" // Can manage settings/members
  | "admin" // Full admin access
  | "export"; // Can export resource

/** Role to permissions mapping */
const MEMBER_ROLE_PERMISSIONS: Record<MemberRole, Permission[]> = {
  OWNER: ["view", "comment", "edit", "delete", "manage", "admin", "export"],
  ADMIN: ["view", "comment", "edit", "delete", "manage", "export"],
  EDITOR: ["view", "comment", "edit", "export"],
  VIEWER: ["view"],
};

const GUEST_ROLE_PERMISSIONS: Record<GuestRole, Permission[]> = {
  VIEWER: ["view"],
  COMMENTER: ["view", "comment"],
  EDITOR: ["view", "comment", "edit"],
};

/** Access check result with details */
export interface AccessCheckResult {
  hasAccess: boolean;
  role?: MemberRole | GuestRole;
  permissions: Permission[];
  isGuest: boolean;
  organizationId?: string;
  canExport?: boolean;
}

/**
 * Check if a user has access to an organization.
 */
export async function checkOrganizationAccess(
  userId: string,
  organizationId: string,
): Promise<AccessCheckResult> {
  const prisma = await getPrisma();

  // nosemgrep: tf-membership-query-missing-status -- status is checked on the result below
  const membership = await prisma.membership.findUnique({
    where: {
      userId_organizationId: {
        userId,
        organizationId,
      },
    },
  });

  if (!membership || membership.status !== "ACTIVE") {
    return { hasAccess: false, permissions: [], isGuest: false };
  }

  return {
    hasAccess: true,
    role: membership.role,
    permissions: MEMBER_ROLE_PERMISSIONS[membership.role],
    isGuest: false,
    organizationId,
  };
}

/**
 * Check if a user has access to a project.
 */
export async function checkProjectAccess(
  userId: string,
  projectId: string,
): Promise<AccessCheckResult> {
  const prisma = await getPrisma();

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      organizationId: true,
      organization: {
        select: {
          deletedAt: true,
          memberships: {
            where: { userId, status: "ACTIVE" },
            select: { role: true },
          },
        },
      },
    },
  });

  if (!project || project.organization.deletedAt) {
    return { hasAccess: false, permissions: [], isGuest: false };
  }

  const membership = project.organization.memberships[0];
  if (!membership) {
    return { hasAccess: false, permissions: [], isGuest: false };
  }

  return {
    hasAccess: true,
    role: membership.role,
    permissions: MEMBER_ROLE_PERMISSIONS[membership.role],
    isGuest: false,
    organizationId: project.organizationId,
  };
}

/**
 * Check if a user has access to a threat model.
 * Includes both membership and guest access checks.
 */
export async function checkThreatModelAccess(
  userId: string,
  threatModelId: string,
): Promise<AccessCheckResult> {
  const prisma = await getPrisma();

  // First check for organization membership
  const model = await prisma.threatModel.findUnique({
    where: { id: threatModelId },
    select: {
      id: true,
      project: {
        select: {
          organizationId: true,
          organization: {
            select: {
              deletedAt: true,
              memberships: {
                where: { userId, status: "ACTIVE" },
                select: { role: true },
              },
            },
          },
        },
      },
    },
  });

  if (!model || model.project.organization.deletedAt) {
    return { hasAccess: false, permissions: [], isGuest: false };
  }

  // Check membership first (higher priority)
  const membership = model.project.organization.memberships[0];
  if (membership) {
    return {
      hasAccess: true,
      role: membership.role,
      permissions: MEMBER_ROLE_PERMISSIONS[membership.role],
      isGuest: false,
      organizationId: model.project.organizationId,
    };
  }

  // Check guest access
  const guestAccess = await prisma.modelAccess.findFirst({
    where: {
      threatModelId,
      userId,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
  });

  if (guestAccess) {
    const guestPermissions = [...GUEST_ROLE_PERMISSIONS[guestAccess.role]];
    if (guestAccess.canExport) {
      guestPermissions.push("export");
    }

    // Update last accessed
    await prisma.modelAccess.update({
      where: { id: guestAccess.id },
      data: {
        lastAccessedAt: new Date(),
        accessCount: { increment: 1 },
      },
    });

    return {
      hasAccess: true,
      role: guestAccess.role,
      permissions: guestPermissions,
      isGuest: true,
      organizationId: model.project.organizationId,
      canExport: guestAccess.canExport,
    };
  }

  return { hasAccess: false, permissions: [], isGuest: false };
}

/**
 * Check if a user can perform an action on a threat model.
 * Returns detailed error message if not allowed.
 */
export async function canPerformAction(
  userId: string,
  threatModelId: string,
  action: Permission,
): Promise<{ allowed: boolean; error?: string; access?: AccessCheckResult }> {
  const access = await checkThreatModelAccess(userId, threatModelId);

  if (!access.hasAccess) {
    return { allowed: false, error: "Resource not found or access denied" };
  }

  if (!access.permissions.includes(action)) {
    const roleLabel = access.isGuest ? `Guest (${access.role})` : access.role;
    return {
      allowed: false,
      error: `${roleLabel} role does not have '${action}' permission`,
      access,
    };
  }

  return { allowed: true, access };
}

/**
 * Get user's role in an organization.
 */
export async function getUserOrgRole(
  userId: string,
  organizationId: string,
): Promise<MemberRole | null> {
  const prisma = await getPrisma();

  // nosemgrep: tf-membership-query-missing-status -- status is checked on the result below
  const membership = await prisma.membership.findUnique({
    where: {
      userId_organizationId: {
        userId,
        organizationId,
      },
    },
    select: { role: true, status: true },
  });

  if (!membership || membership.status !== "ACTIVE") {
    return null;
  }

  return membership.role;
}

/** True when the user holds an ACTIVE membership in the organization. */
export async function isActiveOrgMember(
  userId: string,
  organizationId: string,
): Promise<boolean> {
  return (await getUserOrgRole(userId, organizationId)) !== null;
}

/** True when the user is an ACTIVE OWNER or ADMIN of the organization. */
export async function isActiveOrgAdmin(
  userId: string,
  organizationId: string,
): Promise<boolean> {
  return (await requireOrgRole(userId, organizationId, "ADMIN")).allowed;
}

/** Organizations in which the user holds an ACTIVE membership. */
export async function getActiveOrgIds(userId: string): Promise<string[]> {
  const prisma = await getPrisma();
  const memberships = await prisma.membership.findMany({
    where: { userId, status: "ACTIVE" },
    select: { organizationId: true },
  });
  return memberships.map((m) => m.organizationId);
}

/**
 * Require a minimum role level for an organization.
 * Returns error message if requirement not met.
 */
export async function requireOrgRole(
  userId: string,
  organizationId: string,
  minimumRole: MemberRole,
): Promise<{ allowed: boolean; role?: MemberRole; error?: string }> {
  const role = await getUserOrgRole(userId, organizationId);

  if (!role) {
    return { allowed: false, error: "Not a member of this organization" };
  }

  const roleHierarchy: Record<MemberRole, number> = {
    OWNER: 4,
    ADMIN: 3,
    EDITOR: 2,
    VIEWER: 1,
  };

  if (roleHierarchy[role] < roleHierarchy[minimumRole]) {
    return {
      allowed: false,
      role,
      error: `Requires ${minimumRole} role or higher`,
    };
  }

  return { allowed: true, role };
}

// =============================================================================
// Shared helpers used by threats.ts and mitigations.ts
// =============================================================================

/**
 * Get the organization ID that owns a threat model.
 * Returns null if the model does not exist.
 */
export async function getOrgIdFromModel(
  modelId: string,
): Promise<string | null> {
  const prisma = await getPrisma();
  const model = await prisma.threatModel.findUnique({
    where: { id: modelId },
    select: { project: { select: { organizationId: true } } },
  });
  return model?.project.organizationId ?? null;
}

/**
 * Get the organization ID that owns a threat.
 * Returns null if the threat does not exist.
 */
export async function getOrgIdFromThreat(
  threatId: string,
): Promise<string | null> {
  const prisma = await getPrisma();
  const threat = await prisma.threat.findUnique({
    where: { id: threatId },
    select: {
      threatModel: {
        select: { project: { select: { organizationId: true } } },
      },
    },
  });
  return threat?.threatModel.project.organizationId ?? null;
}

/**
 * Check if a user can access a threat via its threat model's organization membership.
 */
export async function canAccessThreat(
  userId: string,
  threatId: string,
): Promise<boolean> {
  const prisma = await getPrisma();
  const threat = await prisma.threat.findUnique({
    where: { id: threatId },
    include: {
      threatModel: {
        include: {
          project: {
            include: {
              organization: {
                include: {
                  memberships: { where: { userId, status: "ACTIVE" } },
                },
              },
            },
          },
        },
      },
    },
  });
  if (!threat) return false;
  return threat.threatModel.project.organization.memberships.length > 0;
}

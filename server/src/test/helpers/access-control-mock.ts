/**
 * Test double for services/access-control/access-control-service.js.
 *
 * Route authz tests mock the whole module; this keeps the derived helpers
 * (canPerformAction, checkProjectAccess, requireOrgRole) consistent with a
 * single per-test answer instead of each test re-implementing them.
 *
 *   vi.mock("<rel>/services/access-control/access-control-service.js",
 *     async () => (await import("<rel>/test/helpers/access-control-mock.js")).accessControlModule);
 */
import { vi } from "vitest";

type Role = "OWNER" | "ADMIN" | "EDITOR" | "VIEWER" | "COMMENTER";
type Permission =
  | "view"
  | "comment"
  | "edit"
  | "delete"
  | "manage"
  | "admin"
  | "export";

const MEMBER: Record<string, Permission[]> = {
  OWNER: ["view", "comment", "edit", "delete", "manage", "admin", "export"],
  ADMIN: ["view", "comment", "edit", "delete", "manage", "export"],
  EDITOR: ["view", "comment", "edit", "export"],
  VIEWER: ["view"],
};
const GUEST: Record<string, Permission[]> = {
  VIEWER: ["view"],
  COMMENTER: ["view", "comment"],
  EDITOR: ["view", "comment", "edit"],
};
const RANK: Record<string, number> = {
  OWNER: 4,
  ADMIN: 3,
  EDITOR: 2,
  VIEWER: 1,
};

export interface Grant {
  role: Role;
  guest?: boolean;
  organizationId?: string;
}

/** modelId -> grant. Absent = no access (or model does not exist). */
export const modelGrants = new Map<string, Grant>();
/** projectId -> grant (org membership via the project). */
export const projectGrants = new Map<string, Grant>();
/** organizationId -> member role (of the caller, whoever asks). */
export const orgRoles = new Map<string, Role>();
/** `${organizationId}:${userId}` -> role, for tests that need per-user answers. */
export const orgUserRoles = new Map<string, Role>();

function roleOf(userId: string, organizationId: string): Role | undefined {
  return (
    orgUserRoles.get(`${organizationId}:${userId}`) ??
    orgRoles.get(organizationId)
  );
}

export function resetGrants(): void {
  modelGrants.clear();
  projectGrants.clear();
  orgRoles.clear();
  orgUserRoles.clear();
}

function result(grant: Grant | undefined): {
  hasAccess: boolean;
  role?: Role;
  permissions: Permission[];
  isGuest: boolean;
  organizationId?: string;
} {
  if (!grant) return { hasAccess: false, permissions: [], isGuest: false };
  const table = grant.guest ? GUEST : MEMBER;
  return {
    hasAccess: true,
    role: grant.role,
    permissions: [...(table[grant.role] ?? [])],
    isGuest: !!grant.guest,
    organizationId: grant.organizationId,
  };
}

export const checkThreatModelAccess = vi.fn(
  async (_userId: string, modelId: string) => result(modelGrants.get(modelId)),
);

export const checkProjectAccess = vi.fn(
  async (_userId: string, projectId: string) =>
    result(projectGrants.get(projectId)),
);

export const canPerformAction = vi.fn(
  async (userId: string, modelId: string, action: Permission) => {
    const access = await checkThreatModelAccess(userId, modelId);
    if (!access.hasAccess) {
      return { allowed: false, error: "Resource not found or access denied" };
    }
    if (!access.permissions.includes(action)) {
      return { allowed: false, error: `no '${action}' permission`, access };
    }
    return { allowed: true, access };
  },
);

export const requireOrgRole = vi.fn(
  async (userId: string, organizationId: string, minimumRole: Role) => {
    const role = roleOf(userId, organizationId);
    if (!role)
      return { allowed: false, error: "Not a member of this organization" };
    if ((RANK[role] ?? 0) < (RANK[minimumRole] ?? 99)) {
      return {
        allowed: false,
        role,
        error: `Requires ${minimumRole} role or higher`,
      };
    }
    return { allowed: true, role };
  },
);

export const checkOrganizationAccess = vi.fn(
  async (userId: string, organizationId: string) => {
    const role = roleOf(userId, organizationId);
    return result(role ? { role, organizationId } : undefined);
  },
);

export const getUserOrgRole = vi.fn(
  async (userId: string, organizationId: string) =>
    roleOf(userId, organizationId) ?? null,
);

export const isActiveOrgMember = vi.fn(
  async (userId: string, organizationId: string) =>
    roleOf(userId, organizationId) !== undefined,
);

export const getOrgIdFromModel = vi.fn(
  async (modelId: string) => modelGrants.get(modelId)?.organizationId ?? null,
);

export const isActiveOrgAdmin = vi.fn(
  async (userId: string, organizationId: string) =>
    (await requireOrgRole(userId, organizationId, "ADMIN")).allowed,
);

export const getActiveOrgIds = vi.fn(async () => [...orgRoles.keys()]);

export const accessControlModule = {
  checkThreatModelAccess,
  checkProjectAccess,
  checkOrganizationAccess,
  canPerformAction,
  requireOrgRole,
  getUserOrgRole,
  isActiveOrgMember,
  isActiveOrgAdmin,
  getActiveOrgIds,
  getOrgIdFromModel,
};

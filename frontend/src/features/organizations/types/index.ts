/**
 * Organization type definitions
 */

/** Member role levels in an organization */
export type MemberRole = "OWNER" | "ADMIN" | "EDITOR" | "VIEWER";

/** Organization member with user info */
export interface OrganizationMember {
  id: string;
  userId: string;
  role: MemberRole;
  user: {
    id: string;
    name: string;
    email: string;
    avatarUrl?: string | null;
  };
  createdAt: string;
}

/** Organization with members */
export interface Organization {
  id: string;
  name: string;
  slug: string;
  settings?: Record<string, unknown>;
  memberships: OrganizationMember[];
  createdAt: string;
  updatedAt: string;
}

/** Organization list item (without full membership details) */
export interface OrganizationSummary {
  id: string;
  name: string;
  slug: string;
  description?: string;
  type: "PERSONAL" | "TEAM" | "ENTERPRISE";
  isPersonal: boolean;
  memberCount: number;
  role: MemberRole;
  createdAt: string;
}

/** Invite member request */
export interface InviteMemberRequest {
  email: string;
  role: MemberRole;
  /** If true and user is already registered, directly add them without requiring acceptance */
  addDirectly?: boolean;
}

/** Update member role request */
export interface UpdateMemberRoleRequest {
  memberId: string;
  role: MemberRole;
}

/** Organization settings update */
export interface UpdateOrganizationRequest {
  name?: string;
  settings?: Record<string, unknown>;
}

/** Create organization request */
export interface CreateOrganizationRequest {
  name: string;
  description?: string;
  type?: "TEAM" | "ENTERPRISE";
}

/** Audit log entry */
export interface AuditLogEntry {
  id: string;
  action: string;
  actorId: string;
  actorName: string;
  targetType: string;
  targetId: string;
  details?: Record<string, unknown>;
  createdAt: string;
}

/** Role display info */
export const MEMBER_ROLES: {
  value: MemberRole;
  label: string;
  description: string;
}[] = [
  {
    value: "OWNER",
    label: "Owner",
    description: "Full control, can delete organization",
  },
  {
    value: "ADMIN",
    label: "Admin",
    description: "Manage members and settings",
  },
  { value: "EDITOR", label: "Editor", description: "Create and edit projects" },
  { value: "VIEWER", label: "Viewer", description: "View-only access" },
];

/** Check if role can manage members */
export function canManageMembers(role: MemberRole): boolean {
  return role === "OWNER" || role === "ADMIN";
}

/** Check if role can edit settings */
export function canEditSettings(role: MemberRole): boolean {
  return role === "OWNER" || role === "ADMIN";
}

/** Check if user can assign a specific role */
export function canAssignRole(
  userRole: MemberRole,
  targetRole: MemberRole,
): boolean {
  const hierarchy: MemberRole[] = ["OWNER", "ADMIN", "EDITOR", "VIEWER"];
  const userIndex = hierarchy.indexOf(userRole);
  const targetIndex = hierarchy.indexOf(targetRole);
  // Can only assign roles below your own level (except owner can assign admin)
  if (userRole === "OWNER") return true;
  return userIndex < targetIndex;
}

/**
 * Role Permission Helpers
 */
import type { MemberRole } from "@prisma/client";

/**
 * Check if a role can manage another role.
 * - OWNER can manage all roles
 * - ADMIN can manage EDITOR and VIEWER
 * - EDITOR and VIEWER cannot manage anyone
 */
export function canManageRole(
  managerRole: MemberRole,
  targetRole: MemberRole,
): boolean {
  if (managerRole === "OWNER") return true;
  if (managerRole === "ADMIN") {
    return targetRole === "EDITOR" || targetRole === "VIEWER";
  }
  return false;
}

/**
 * Check if a role can assign another role.
 * - OWNER can assign any role except OWNER (transfer ownership is separate)
 * - ADMIN can only assign EDITOR and VIEWER
 */
export function canAssignRole(
  assignerRole: MemberRole,
  newRole: MemberRole,
): boolean {
  if (newRole === "OWNER") return false; // Ownership transfer is separate
  if (assignerRole === "OWNER") return true;
  if (assignerRole === "ADMIN") {
    return newRole === "EDITOR" || newRole === "VIEWER";
  }
  return false;
}

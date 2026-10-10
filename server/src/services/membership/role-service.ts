/**
 * Role Update Operations
 */
import { getPrisma } from "../../db.js";
import type { UpdateRoleParams, UpdateRoleResult } from "./types.js";
import { findTargetMembership } from "./target-membership.js";
import { canManageRole, canAssignRole } from "./role-helpers.js";

/**
 * Update a member's role in an organization.
 */
export async function updateMemberRole(
  params: UpdateRoleParams,
): Promise<UpdateRoleResult> {
  const {
    membershipId,
    organizationId,
    newRole,
    updatingUserId,
    updatingUserEmail,
  } = params;

  const prisma = await getPrisma();

  const targetMembership = await findTargetMembership(
    membershipId,
    organizationId,
  );
  if (!targetMembership) {
    return { success: false, error: "Membership not found" };
  }

  if (targetMembership.status !== "ACTIVE") {
    return {
      success: false,
      error: "Can only update roles for active members",
    };
  }

  // Cannot change roles in personal organizations
  if (targetMembership.organization.isPersonal) {
    return {
      success: false,
      error: "Cannot change roles in personal organizations",
    };
  }

  // Get the updater's membership
  // nosemgrep: tf-membership-query-missing-status -- status is checked on the result below
  const updaterMembership = await prisma.membership.findUnique({
    where: {
      userId_organizationId: {
        userId: updatingUserId,
        organizationId: targetMembership.organizationId,
      },
    },
  });

  if (!updaterMembership || updaterMembership.status !== "ACTIVE") {
    return {
      success: false,
      error: "You are not an active member of this organization",
    };
  }

  // Cannot update your own role
  if (targetMembership.userId === updatingUserId) {
    return { success: false, error: "Cannot update your own role" };
  }

  // Check if updater can manage the target's current role
  if (!canManageRole(updaterMembership.role, targetMembership.role)) {
    return {
      success: false,
      error: "Insufficient permissions to manage this member",
    };
  }

  // Check if updater can assign the new role
  if (!canAssignRole(updaterMembership.role, newRole)) {
    return {
      success: false,
      error: "Insufficient permissions to assign this role",
    };
  }

  // Cannot demote another OWNER (there must always be one owner)
  if (targetMembership.role === "OWNER") {
    return {
      success: false,
      error:
        "Cannot change the role of an owner. Use ownership transfer instead.",
    };
  }

  const previousRole = targetMembership.role;

  // Update the role
  await prisma.$transaction(async (tx) => {
    await tx.membership.update({
      where: { id: membershipId },
      data: { role: newRole },
    });

    await tx.auditLog.create({
      data: {
        scope: "ORGANIZATION",
        action: "UPDATE",
        resourceType: "ORGANIZATION",
        resourceId: targetMembership.organizationId,
        resourceName: targetMembership.organization.name,
        userId: updatingUserId,
        userEmail: updatingUserEmail,
        organizationId: targetMembership.organizationId,
        metadata: JSON.stringify({
          action: "update_member_role",
          targetUserId: targetMembership.userId,
          targetUserEmail: targetMembership.user.email,
          previousRole,
          newRole,
        }),
      },
    });
  });

  return { success: true, previousRole, newRole };
}

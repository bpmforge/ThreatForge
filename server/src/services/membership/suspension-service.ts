/**
 * Member Suspension Operations
 */
import { getPrisma } from "../../db.js";
import type {
  SuspendMemberParams,
  SuspendMemberResult,
  UnsuspendMemberParams,
  UnsuspendMemberResult,
} from "./types.js";
import { findTargetMembership } from "./target-membership.js";
import { canManageRole } from "./role-helpers.js";

/**
 * Suspend a member in an organization.
 */
export async function suspendMember(
  params: SuspendMemberParams,
): Promise<SuspendMemberResult> {
  const {
    membershipId,
    organizationId,
    suspendingUserId,
    suspendingUserEmail,
    reason,
  } = params;

  const prisma = await getPrisma();

  const targetMembership = await findTargetMembership(
    membershipId,
    organizationId,
  );
  if (!targetMembership) {
    return { success: false, error: "Membership not found" };
  }

  // Cannot suspend in personal organizations
  if (targetMembership.organization.isPersonal) {
    return {
      success: false,
      error: "Cannot suspend members in personal organizations",
    };
  }

  // Already suspended
  if (targetMembership.status === "SUSPENDED") {
    return { success: false, error: "Member is already suspended" };
  }

  // Get the suspender's membership
  // nosemgrep: tf-membership-query-missing-status -- status is checked on the result below
  const suspenderMembership = await prisma.membership.findUnique({
    where: {
      userId_organizationId: {
        userId: suspendingUserId,
        organizationId: targetMembership.organizationId,
      },
    },
  });

  if (!suspenderMembership || suspenderMembership.status !== "ACTIVE") {
    return {
      success: false,
      error: "You are not an active member of this organization",
    };
  }

  // Cannot suspend yourself
  if (targetMembership.userId === suspendingUserId) {
    return { success: false, error: "Cannot suspend yourself" };
  }

  // Check if suspender can manage the target
  if (!canManageRole(suspenderMembership.role, targetMembership.role)) {
    return {
      success: false,
      error: "Insufficient permissions to suspend this member",
    };
  }

  // Cannot suspend an OWNER
  if (targetMembership.role === "OWNER") {
    return { success: false, error: "Cannot suspend an owner" };
  }

  // Suspend the membership
  await prisma.$transaction(async (tx) => {
    await tx.membership.update({
      where: { id: membershipId },
      data: {
        status: "SUSPENDED",
        suspendedBy: suspendingUserId,
        suspendedAt: new Date(),
        suspensionReason: reason || null,
      },
    });

    await tx.auditLog.create({
      data: {
        scope: "ORGANIZATION",
        action: "UPDATE",
        resourceType: "ORGANIZATION",
        resourceId: targetMembership.organizationId,
        resourceName: targetMembership.organization.name,
        userId: suspendingUserId,
        userEmail: suspendingUserEmail,
        organizationId: targetMembership.organizationId,
        metadata: JSON.stringify({
          action: "suspend_member",
          targetUserId: targetMembership.userId,
          targetUserEmail: targetMembership.user.email,
          reason: reason || null,
        }),
      },
    });
  });

  return {
    success: true,
    suspendedUserId: targetMembership.userId,
    suspendedUserEmail: targetMembership.user.email,
  };
}

/**
 * Unsuspend (reactivate) a member in an organization.
 */
export async function unsuspendMember(
  params: UnsuspendMemberParams,
): Promise<UnsuspendMemberResult> {
  const {
    membershipId,
    organizationId,
    unsuspendingUserId,
    unsuspendingUserEmail,
  } = params;

  const prisma = await getPrisma();

  const targetMembership = await findTargetMembership(
    membershipId,
    organizationId,
  );
  if (!targetMembership) {
    return { success: false, error: "Membership not found" };
  }

  // Not suspended
  if (targetMembership.status !== "SUSPENDED") {
    return { success: false, error: "Member is not suspended" };
  }

  // Get the unsuspender's membership
  // nosemgrep: tf-membership-query-missing-status -- status is checked on the result below
  const unsuspenderMembership = await prisma.membership.findUnique({
    where: {
      userId_organizationId: {
        userId: unsuspendingUserId,
        organizationId: targetMembership.organizationId,
      },
    },
  });

  if (!unsuspenderMembership || unsuspenderMembership.status !== "ACTIVE") {
    return {
      success: false,
      error: "You are not an active member of this organization",
    };
  }

  // Check if unsuspender can manage the target
  if (!canManageRole(unsuspenderMembership.role, targetMembership.role)) {
    return {
      success: false,
      error: "Insufficient permissions to unsuspend this member",
    };
  }

  // Unsuspend the membership
  await prisma.$transaction(async (tx) => {
    await tx.membership.update({
      where: { id: membershipId },
      data: {
        status: "ACTIVE",
        suspendedBy: null,
        suspendedAt: null,
        suspensionReason: null,
      },
    });

    await tx.auditLog.create({
      data: {
        scope: "ORGANIZATION",
        action: "UPDATE",
        resourceType: "ORGANIZATION",
        resourceId: targetMembership.organizationId,
        resourceName: targetMembership.organization.name,
        userId: unsuspendingUserId,
        userEmail: unsuspendingUserEmail,
        organizationId: targetMembership.organizationId,
        metadata: JSON.stringify({
          action: "unsuspend_member",
          targetUserId: targetMembership.userId,
          targetUserEmail: targetMembership.user.email,
        }),
      },
    });
  });

  return {
    success: true,
    unsuspendedUserId: targetMembership.userId,
    unsuspendedUserEmail: targetMembership.user.email,
  };
}

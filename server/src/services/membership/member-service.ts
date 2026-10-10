/**
 * Member CRUD Operations
 */
import { getPrisma } from "../../db.js";
import type {
  RemoveMemberParams,
  RemoveMemberResult,
  LeaveOrgParams,
  LeaveOrgResult,
  GetMembersOptions,
  GetMembersResult,
} from "./types.js";
import { findTargetMembership } from "./target-membership.js";
import { canManageRole } from "./role-helpers.js";

/**
 * Remove a member from an organization.
 */
export async function removeMember(
  params: RemoveMemberParams,
): Promise<RemoveMemberResult> {
  const { membershipId, organizationId, removingUserId, removingUserEmail } =
    params;

  const prisma = await getPrisma();

  const targetMembership = await findTargetMembership(
    membershipId,
    organizationId,
  );
  if (!targetMembership) {
    return { success: false, error: "Membership not found" };
  }

  // Cannot remove members from personal organizations
  if (targetMembership.organization.isPersonal) {
    return {
      success: false,
      error: "Cannot remove members from personal organizations",
    };
  }

  // Get the remover's membership
  // nosemgrep: tf-membership-query-missing-status -- status is checked on the result below
  const removerMembership = await prisma.membership.findUnique({
    where: {
      userId_organizationId: {
        userId: removingUserId,
        organizationId: targetMembership.organizationId,
      },
    },
  });

  if (!removerMembership || removerMembership.status !== "ACTIVE") {
    return {
      success: false,
      error: "You are not an active member of this organization",
    };
  }

  // Cannot remove yourself (use leave instead)
  if (targetMembership.userId === removingUserId) {
    return {
      success: false,
      error: "Cannot remove yourself. Use leave organization instead.",
    };
  }

  // Check if remover can manage the target
  if (!canManageRole(removerMembership.role, targetMembership.role)) {
    return {
      success: false,
      error: "Insufficient permissions to remove this member",
    };
  }

  // Cannot remove an OWNER
  if (targetMembership.role === "OWNER") {
    return {
      success: false,
      error: "Cannot remove an owner. Transfer ownership first.",
    };
  }

  // Remove the membership
  await prisma.$transaction(async (tx) => {
    await tx.membership.delete({
      where: { id: membershipId },
    });

    await tx.auditLog.create({
      data: {
        scope: "ORGANIZATION",
        action: "UPDATE",
        resourceType: "ORGANIZATION",
        resourceId: targetMembership.organizationId,
        resourceName: targetMembership.organization.name,
        userId: removingUserId,
        userEmail: removingUserEmail,
        organizationId: targetMembership.organizationId,
        metadata: JSON.stringify({
          action: "remove_member",
          removedUserId: targetMembership.userId,
          removedUserEmail: targetMembership.user.email,
          removedRole: targetMembership.role,
        }),
      },
    });
  });

  return {
    success: true,
    removedUserId: targetMembership.userId,
    removedUserEmail: targetMembership.user.email,
  };
}

/**
 * Leave an organization voluntarily.
 */
export async function leaveOrganization(
  params: LeaveOrgParams,
): Promise<LeaveOrgResult> {
  const { organizationId, userId, userEmail } = params;

  const prisma = await getPrisma();

  // Get the organization
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { id: true, name: true, isPersonal: true },
  });

  if (!org) {
    return { success: false, error: "Organization not found" };
  }

  // Cannot leave personal organization
  if (org.isPersonal) {
    return { success: false, error: "Cannot leave your personal organization" };
  }

  // Get user's membership
  // nosemgrep: tf-membership-query-missing-status -- leaving the org works from any status
  const membership = await prisma.membership.findUnique({
    where: {
      userId_organizationId: {
        userId,
        organizationId,
      },
    },
  });

  if (!membership) {
    return {
      success: false,
      error: "You are not a member of this organization",
    };
  }

  // Owner cannot leave without transferring ownership first
  if (membership.role === "OWNER") {
    // Check if there are other members who could become owner
    const otherActiveMembers = await prisma.membership.count({
      where: {
        organizationId,
        userId: { not: userId },
        status: "ACTIVE",
      },
    });

    if (otherActiveMembers > 0) {
      return {
        success: false,
        error:
          "Owner cannot leave. Transfer ownership to another member first.",
      };
    } else {
      return {
        success: false,
        error: "Owner cannot leave. Delete the organization instead.",
      };
    }
  }

  // Leave the organization
  await prisma.$transaction(async (tx) => {
    await tx.membership.delete({
      where: { id: membership.id },
    });

    await tx.auditLog.create({
      data: {
        scope: "ORGANIZATION",
        action: "UPDATE",
        resourceType: "ORGANIZATION",
        resourceId: organizationId,
        resourceName: org.name,
        userId,
        userEmail,
        organizationId,
        metadata: JSON.stringify({
          action: "leave_organization",
          previousRole: membership.role,
        }),
      },
    });
  });

  return { success: true };
}

/**
 * Get members of an organization.
 */
export async function getOrganizationMembers(
  organizationId: string,
  requestingUserId: string,
  options?: GetMembersOptions,
): Promise<GetMembersResult> {
  const prisma = await getPrisma();

  // Verify requester is a member
  // nosemgrep: tf-membership-query-missing-status -- status is checked on the result below
  const requesterMembership = await prisma.membership.findUnique({
    where: {
      userId_organizationId: {
        userId: requestingUserId,
        organizationId,
      },
    },
  });

  if (!requesterMembership || requesterMembership.status !== "ACTIVE") {
    return {
      success: false,
      error: "You are not an active member of this organization",
    };
  }

  const { includeInactive = false, limit = 50, offset = 0 } = options || {};

  const where: Record<string, unknown> = { organizationId };
  if (!includeInactive) {
    where.status = "ACTIVE";
  }

  const [members, total] = await Promise.all([
    // nosemgrep: tf-membership-query-missing-status -- status filter is set on `where` above unless includeInactive
    prisma.membership.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
      orderBy: [
        { role: "asc" }, // OWNER first, then ADMIN, etc.
        { createdAt: "asc" },
      ],
      take: limit,
      skip: offset,
    }),
    prisma.membership.count({ where }),
  ]);

  return {
    success: true,
    members: members.map((m) => ({
      id: m.id,
      userId: m.userId,
      role: m.role,
      status: m.status,
      joinedAt: m.acceptedAt?.toISOString() || m.createdAt.toISOString(),
      user: m.user,
    })),
    total,
    canManageMembers:
      requesterMembership.role === "OWNER" ||
      requesterMembership.role === "ADMIN",
  };
}

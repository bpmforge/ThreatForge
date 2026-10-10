/**
 * Invitation Service
 *
 * Handles organization invitation logic:
 * - Token generation and validation
 * - Invitation creation and acceptance
 * - Expiration handling
 */
import crypto from "crypto";
import { getPrisma } from "../../db.js";
import type { MemberRole } from "@prisma/client";

/** Default invitation expiration: 7 days */
const DEFAULT_EXPIRATION_DAYS = 7;

/** Invitation token prefix for identification */
const TOKEN_PREFIX = "inv_";

export interface CreateInvitationParams {
  organizationId: string;
  email: string;
  role: MemberRole;
  invitedById: string;
  inviterEmail: string;
  expirationDays?: number;
}

export interface InvitationResult {
  success: boolean;
  invitationId?: string;
  invitationToken?: string;
  error?: string;
  alreadyMember?: boolean;
  existingInvitation?: boolean;
}

export interface AcceptInvitationResult {
  success: boolean;
  membershipId?: string;
  organizationId?: string;
  organizationName?: string;
  role?: MemberRole;
  error?: string;
}

export function generateInvitationToken(): string {
  const randomBytes = crypto.randomBytes(32).toString("hex");
  return `${TOKEN_PREFIX}${randomBytes}`;
}

export function calculateExpirationDate(
  days: number = DEFAULT_EXPIRATION_DAYS,
): Date {
  const expiration = new Date();
  expiration.setDate(expiration.getDate() + days);
  return expiration;
}

export function isValidTokenFormat(token: string): boolean {
  return (
    token.startsWith(TOKEN_PREFIX) && token.length === TOKEN_PREFIX.length + 64
  );
}

export async function createInvitation(
  params: CreateInvitationParams,
): Promise<InvitationResult> {
  const {
    organizationId,
    email,
    role,
    invitedById,
    inviterEmail,
    expirationDays = DEFAULT_EXPIRATION_DAYS,
  } = params;

  const prisma = await getPrisma();
  const normalizedEmail = email.toLowerCase().trim();

  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { id: true, name: true, deletedAt: true },
  });

  if (!org || org.deletedAt) {
    return { success: false, error: "Organization not found" };
  }

  const existingUser = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true },
  });

  if (existingUser) {
    // nosemgrep: tf-membership-query-missing-status -- needs the inactive row too: ACTIVE conflicts, others are re-invited
    const existingMembership = await prisma.membership.findUnique({
      where: {
        userId_organizationId: {
          userId: existingUser.id,
          organizationId,
        },
      },
    });

    if (existingMembership) {
      if (existingMembership.status === "ACTIVE") {
        return {
          success: false,
          error: "User is already a member",
          alreadyMember: true,
        };
      }
      // A suspension is an admin decision; an invite must not undo it.
      if (existingMembership.status === "SUSPENDED") {
        return {
          success: false,
          error:
            "User is suspended in this organization. Unsuspend them instead.",
          alreadyMember: true,
        };
      }
      if (existingMembership.status === "PENDING") {
        const token = generateInvitationToken();
        const expiresAt = calculateExpirationDate(expirationDays);

        await prisma.membership.update({
          where: { id: existingMembership.id },
          data: {
            role,
            invitationToken: token,
            invitationExpiresAt: expiresAt,
            invitedById,
            invitedAt: new Date(),
          },
        });

        return {
          success: true,
          invitationId: existingMembership.id,
          invitationToken: token,
          existingInvitation: true,
        };
      }
    }
  }

  const token = generateInvitationToken();
  const expiresAt = calculateExpirationDate(expirationDays);

  const result = await prisma.$transaction(async (tx) => {
    let userId: string;
    if (existingUser) {
      userId = existingUser.id;
    } else {
      const newUser = await tx.user.create({
        data: {
          email: normalizedEmail,
          name: normalizedEmail.split("@")[0],
          status: "PENDING_VERIFICATION",
        },
      });
      userId = newUser.id;
    }

    const membership = await tx.membership.create({
      data: {
        userId,
        organizationId,
        role,
        status: "PENDING",
        invitedById,
        invitedAt: new Date(),
        invitationToken: token,
        invitationExpiresAt: expiresAt,
      },
    });

    await tx.auditLog.create({
      data: {
        scope: "ORGANIZATION",
        action: "INVITE",
        resourceType: "ORGANIZATION",
        resourceId: organizationId,
        resourceName: org.name,
        userId: invitedById,
        userEmail: inviterEmail,
        organizationId,
        metadata: JSON.stringify({
          invitedEmail: normalizedEmail,
          role,
          expiresAt: expiresAt.toISOString(),
        }),
      },
    });

    return membership;
  });

  return {
    success: true,
    invitationId: result.id,
    invitationToken: token,
  };
}

export async function acceptInvitation(
  token: string,
  acceptingUserId: string,
  acceptingUserEmail: string,
): Promise<AcceptInvitationResult> {
  if (!isValidTokenFormat(token)) {
    return { success: false, error: "Invalid invitation token format" };
  }

  const prisma = await getPrisma();

  // nosemgrep: tf-membership-query-missing-status -- target membership looked up by id/token; any status is managed here
  const membership = await prisma.membership.findUnique({
    where: { invitationToken: token },
    include: {
      organization: { select: { id: true, name: true, deletedAt: true } },
      user: { select: { id: true, email: true } },
    },
  });

  if (!membership) {
    return { success: false, error: "Invitation not found" };
  }

  if (membership.status !== "PENDING") {
    return { success: false, error: "Invitation has already been processed" };
  }

  if (membership.organization.deletedAt) {
    return { success: false, error: "Organization no longer exists" };
  }

  if (
    membership.invitationExpiresAt &&
    membership.invitationExpiresAt < new Date()
  ) {
    return { success: false, error: "Invitation has expired" };
  }

  // Verify the accepting user matches the invited user (by email)
  const acceptingUser = await prisma.user.findUnique({
    where: { id: acceptingUserId },
    select: { email: true, emailVerified: true },
  });

  if (!acceptingUser) {
    return { success: false, error: "User not found" };
  }

  // An unverified account may not own this address yet
  if (!acceptingUser.emailVerified) {
    return {
      success: false,
      error: "Verify your email address before accepting invitations",
    };
  }

  // The accepting user's email must match the invited email
  if (
    acceptingUser.email.toLowerCase() !== membership.user.email.toLowerCase()
  ) {
    return {
      success: false,
      error: "This invitation is for a different email address",
    };
  }

  await prisma.$transaction(async (tx) => {
    await tx.membership.update({
      where: { id: membership.id },
      data: {
        status: "ACTIVE",
        acceptedAt: new Date(),
        invitationToken: null, // Clear token after use
      },
    });

    await tx.user.updateMany({
      where: {
        id: membership.userId,
        status: "PENDING_VERIFICATION",
      },
      data: {
        status: "ACTIVE",
        emailVerified: new Date(),
      },
    });

    await tx.auditLog.create({
      data: {
        scope: "ORGANIZATION",
        action: "ACCEPT_INVITE",
        resourceType: "ORGANIZATION",
        resourceId: membership.organizationId,
        resourceName: membership.organization.name,
        userId: acceptingUserId,
        userEmail: acceptingUserEmail,
        organizationId: membership.organizationId,
        metadata: JSON.stringify({
          membershipId: membership.id,
          role: membership.role,
        }),
      },
    });
  });

  return {
    success: true,
    membershipId: membership.id,
    organizationId: membership.organizationId,
    organizationName: membership.organization.name,
    role: membership.role,
  };
}

export async function declineInvitation(
  token: string,
  decliningUserId: string,
  decliningUserEmail: string,
): Promise<{ success: boolean; error?: string }> {
  if (!isValidTokenFormat(token)) {
    return { success: false, error: "Invalid invitation token format" };
  }

  const prisma = await getPrisma();

  // nosemgrep: tf-membership-query-missing-status -- target membership looked up by id/token; any status is managed here
  const membership = await prisma.membership.findUnique({
    where: { invitationToken: token },
    include: {
      organization: { select: { id: true, name: true } },
      user: { select: { id: true, email: true } },
    },
  });

  if (!membership) {
    return { success: false, error: "Invitation not found" };
  }

  if (membership.status !== "PENDING") {
    return { success: false, error: "Invitation has already been processed" };
  }

  // Verify the declining user matches the invited user (by email)
  const decliningUser = await prisma.user.findUnique({
    where: { id: decliningUserId },
    select: { email: true },
  });

  if (
    !decliningUser ||
    decliningUser.email.toLowerCase() !== membership.user.email.toLowerCase()
  ) {
    return {
      success: false,
      error: "This invitation is for a different email address",
    };
  }

  // Delete the membership (decline = remove the pending membership)
  await prisma.$transaction(async (tx) => {
    await tx.membership.delete({
      where: { id: membership.id },
    });

    await tx.auditLog.create({
      data: {
        scope: "ORGANIZATION",
        action: "DECLINE_INVITE",
        resourceType: "ORGANIZATION",
        resourceId: membership.organizationId,
        resourceName: membership.organization.name,
        userId: decliningUserId,
        userEmail: decliningUserEmail,
        organizationId: membership.organizationId,
        metadata: JSON.stringify({
          declinedRole: membership.role,
        }),
      },
    });
  });

  return { success: true };
}

export async function getPendingInvitations(userId: string) {
  const prisma = await getPrisma();

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, emailVerified: true },
  });

  // Unverified accounts must not see tokens for the address they claim
  if (!user?.emailVerified) {
    return [];
  }

  const pendingMemberships = await prisma.membership.findMany({
    where: {
      user: { email: user.email },
      status: "PENDING",
      invitationExpiresAt: { gt: new Date() }, // Not expired
      organization: { deletedAt: null }, // Org not deleted
    },
    include: {
      organization: {
        select: { id: true, name: true, slug: true, type: true },
      },
      invitedBy: { select: { id: true, name: true, email: true } },
    },
    orderBy: { invitedAt: "desc" },
  });

  return pendingMemberships.map((m) => ({
    id: m.id,
    token: m.invitationToken,
    role: m.role,
    invitedAt: m.invitedAt?.toISOString(),
    expiresAt: m.invitationExpiresAt?.toISOString(),
    organization: m.organization,
    invitedBy: m.invitedBy,
  }));
}

export async function revokeInvitation(
  membershipId: string,
  revokingUserId: string,
  revokingUserEmail: string,
): Promise<{ success: boolean; error?: string }> {
  const prisma = await getPrisma();

  // nosemgrep: tf-membership-query-missing-status -- target membership looked up by id/token; any status is managed here
  const membership = await prisma.membership.findUnique({
    where: { id: membershipId },
    include: {
      organization: { select: { id: true, name: true } },
      user: { select: { email: true } },
    },
  });

  if (!membership) {
    return { success: false, error: "Invitation not found" };
  }

  if (membership.status !== "PENDING") {
    return { success: false, error: "Can only revoke pending invitations" };
  }

  // Check revoker has permission (OWNER or ADMIN)
  // nosemgrep: tf-membership-query-missing-status -- status is checked on the result below
  const revokerMembership = await prisma.membership.findUnique({
    where: {
      userId_organizationId: {
        userId: revokingUserId,
        organizationId: membership.organizationId,
      },
    },
  });

  if (
    revokerMembership?.status !== "ACTIVE" ||
    (revokerMembership.role !== "OWNER" && revokerMembership.role !== "ADMIN")
  ) {
    return {
      success: false,
      error: "Only owners and admins can revoke invitations",
    };
  }

  await prisma.$transaction(async (tx) => {
    await tx.membership.delete({
      where: { id: membershipId },
    });

    await tx.auditLog.create({
      data: {
        scope: "ORGANIZATION",
        action: "UPDATE",
        resourceType: "ORGANIZATION",
        resourceId: membership.organizationId,
        resourceName: membership.organization.name,
        userId: revokingUserId,
        userEmail: revokingUserEmail,
        organizationId: membership.organizationId,
        metadata: JSON.stringify({
          action: "revoke_invitation",
          revokedEmail: membership.user.email,
          revokedRole: membership.role,
        }),
      },
    });
  });

  return { success: true };
}

/**
 * Guest Access Service
 *
 * Handles model-level guest access:
 * - Grant access to external users/emails
 * - Revoke access
 * - Validate access tokens
 * - Check access permissions
 */
import crypto from "crypto";
import { getPrisma } from "../../db.js";
import type { GuestRole } from "@prisma/client";

/** Access token prefix for identification */
export const TOKEN_PREFIX = "gst_";

export interface GrantAccessParams {
  threatModelId: string;
  email: string;
  role: GuestRole;
  canExport: boolean;
  expiresInDays?: number | null;
  allowedIps?: string[];
  allowedDomains?: string[];
  grantedById: string;
  grantedByEmail: string;
}

export interface GrantAccessResult {
  success: boolean;
  accessId?: string;
  accessToken?: string;
  shareUrl?: string;
  error?: string;
  alreadyGranted?: boolean;
}

export interface RevokeAccessResult {
  success: boolean;
  error?: string;
}

export interface ValidateAccessResult {
  valid: boolean;
  accessId?: string;
  threatModelId?: string;
  role?: GuestRole;
  canExport?: boolean;
  error?: string;
}

/**
 * Generate a secure access token for sharing.
 */
export function generateAccessToken(): string {
  const randomBytes = crypto.randomBytes(32).toString("hex");
  return `${TOKEN_PREFIX}${randomBytes}`;
}

/**
 * Check if an access token has valid format.
 */
export function isValidTokenFormat(token: string): boolean {
  return (
    token.startsWith(TOKEN_PREFIX) && token.length === TOKEN_PREFIX.length + 64
  );
}

/**
 * Grant guest access to a threat model.
 */
export async function grantGuestAccess(
  params: GrantAccessParams,
): Promise<GrantAccessResult> {
  const {
    threatModelId,
    email,
    role,
    canExport,
    expiresInDays,
    allowedIps,
    allowedDomains,
    grantedById,
    grantedByEmail,
  } = params;

  const prisma = await getPrisma();
  const normalizedEmail = email.toLowerCase().trim();

  // Get the threat model and verify it exists
  const threatModel = await prisma.threatModel.findUnique({
    where: { id: threatModelId },
    include: {
      project: {
        include: {
          organization: {
            select: {
              id: true,
              name: true,
              allowGuestAccess: true,
              allowGuestExport: true,
            },
          },
        },
      },
    },
  });

  if (!threatModel) {
    return { success: false, error: "Threat model not found" };
  }

  const org = threatModel.project.organization;

  // Check if organization allows guest access
  if (!org.allowGuestAccess) {
    return {
      success: false,
      error: "This organization does not allow guest access",
    };
  }

  // Check if export is allowed if requested
  if (canExport && !org.allowGuestExport) {
    return {
      success: false,
      error: "This organization does not allow guest export",
    };
  }

  // Verify the granter has permission (OWNER, ADMIN, or EDITOR)
  // nosemgrep: tf-membership-query-missing-status -- status is checked on the result below
  const granterMembership = await prisma.membership.findUnique({
    where: {
      userId_organizationId: {
        userId: grantedById,
        organizationId: org.id,
      },
    },
  });

  if (!granterMembership || granterMembership.status !== "ACTIVE") {
    return {
      success: false,
      error: "You are not an active member of this organization",
    };
  }

  const canGrantAccess = ["OWNER", "ADMIN", "EDITOR"].includes(
    granterMembership.role,
  );
  if (!canGrantAccess) {
    return {
      success: false,
      error: "Only owners, admins, and editors can grant guest access",
    };
  }

  // Check if user already exists in the system
  const existingUser = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true },
  });

  // Check if access already exists
  const existingAccess = await prisma.modelAccess.findFirst({
    where: {
      threatModelId,
      OR: [{ userId: existingUser?.id }, { guestEmail: normalizedEmail }],
    },
  });

  if (existingAccess) {
    // Update existing access
    const accessToken = generateAccessToken();
    const expiresAt = expiresInDays
      ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
      : null;

    await prisma.$transaction(async (tx) => {
      await tx.modelAccess.update({
        where: { id: existingAccess.id },
        data: {
          role,
          canExport,
          expiresAt,
          accessToken,
          allowedIps: allowedIps?.join(",") || null,
          allowedDomains: allowedDomains?.join(",") || null,
          grantedById,
        },
      });

      await tx.auditLog.create({
        data: {
          scope: "MODEL",
          action: "UPDATE",
          resourceType: "THREAT_MODEL",
          resourceId: threatModelId,
          resourceName: threatModel.name,
          userId: grantedById,
          userEmail: grantedByEmail,
          organizationId: org.id,
          metadata: JSON.stringify({
            action: "update_guest_access",
            guestEmail: normalizedEmail,
            role,
            canExport,
          }),
        },
      });
    });

    return {
      success: true,
      accessId: existingAccess.id,
      accessToken,
      alreadyGranted: true,
    };
  }

  // Create new access
  const accessToken = generateAccessToken();
  const expiresAt = expiresInDays
    ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
    : null;

  const result = await prisma.$transaction(async (tx) => {
    const access = await tx.modelAccess.create({
      data: {
        userId: existingUser?.id || null,
        guestEmail: existingUser ? null : normalizedEmail,
        threatModelId,
        organizationId: org.id,
        role,
        canExport,
        expiresAt,
        accessToken,
        allowedIps: allowedIps?.join(",") || null,
        allowedDomains: allowedDomains?.join(",") || null,
        grantedById,
      },
    });

    await tx.auditLog.create({
      data: {
        scope: "MODEL",
        action: "CREATE",
        resourceType: "THREAT_MODEL",
        resourceId: threatModelId,
        resourceName: threatModel.name,
        userId: grantedById,
        userEmail: grantedByEmail,
        organizationId: org.id,
        metadata: JSON.stringify({
          action: "grant_guest_access",
          guestEmail: normalizedEmail,
          role,
          canExport,
          expiresAt: expiresAt?.toISOString() || null,
        }),
      },
    });

    return access;
  });

  return {
    success: true,
    accessId: result.id,
    accessToken,
  };
}

/**
 * Revoke guest access to a threat model.
 */
export async function revokeGuestAccess(
  accessId: string,
  revokingUserId: string,
  revokingUserEmail: string,
): Promise<RevokeAccessResult> {
  const prisma = await getPrisma();

  // Get the access record
  const access = await prisma.modelAccess.findUnique({
    where: { id: accessId },
    include: {
      threatModel: { select: { id: true, name: true } },
      organization: { select: { id: true, name: true } },
      user: { select: { email: true } },
    },
  });

  if (!access) {
    return { success: false, error: "Access record not found" };
  }

  // Verify the revoker has permission
  // nosemgrep: tf-membership-query-missing-status -- status is checked on the result below
  const revokerMembership = await prisma.membership.findUnique({
    where: {
      userId_organizationId: {
        userId: revokingUserId,
        organizationId: access.organizationId,
      },
    },
  });

  if (!revokerMembership || revokerMembership.status !== "ACTIVE") {
    return {
      success: false,
      error: "You are not an active member of this organization",
    };
  }

  const canRevokeAccess = ["OWNER", "ADMIN", "EDITOR"].includes(
    revokerMembership.role,
  );
  if (!canRevokeAccess) {
    return {
      success: false,
      error: "Only owners, admins, and editors can revoke guest access",
    };
  }

  // Revoke the access
  await prisma.$transaction(async (tx) => {
    await tx.modelAccess.delete({
      where: { id: accessId },
    });

    await tx.auditLog.create({
      data: {
        scope: "MODEL",
        action: "DELETE",
        resourceType: "THREAT_MODEL",
        resourceId: access.threatModelId,
        resourceName: access.threatModel.name,
        userId: revokingUserId,
        userEmail: revokingUserEmail,
        organizationId: access.organizationId,
        metadata: JSON.stringify({
          action: "revoke_guest_access",
          revokedEmail: access.user?.email || access.guestEmail,
          revokedRole: access.role,
        }),
      },
    });
  });

  return { success: true };
}

/**
 * Validate an access token and return the access details.
 */
export async function validateAccessToken(
  token: string,
  clientIp?: string,
): Promise<ValidateAccessResult> {
  if (!isValidTokenFormat(token)) {
    return { valid: false, error: "Invalid token format" };
  }

  const prisma = await getPrisma();

  const access = await prisma.modelAccess.findUnique({
    where: { accessToken: token },
    include: {
      threatModel: { select: { id: true } },
      organization: { select: { deletedAt: true } },
    },
  });

  if (!access) {
    return { valid: false, error: "Access token not found" };
  }

  // Check if organization is deleted
  if (access.organization.deletedAt) {
    return { valid: false, error: "Organization no longer exists" };
  }

  // Check expiration
  if (access.expiresAt && access.expiresAt < new Date()) {
    return { valid: false, error: "Access has expired" };
  }

  // Check IP whitelist if specified
  if (access.allowedIps && clientIp) {
    const allowedIps = access.allowedIps.split(",").map((ip) => ip.trim());
    if (!allowedIps.includes(clientIp)) {
      return { valid: false, error: "Access not allowed from this IP address" };
    }
  }

  // Update last accessed
  await prisma.modelAccess.update({
    where: { id: access.id },
    data: { lastAccessedAt: new Date() },
  });

  return {
    valid: true,
    accessId: access.id,
    threatModelId: access.threatModelId,
    role: access.role,
    canExport: access.canExport,
  };
}

/**
 * List all guest access for a threat model.
 */
export async function listModelGuestAccess(
  threatModelId: string,
  requestingUserId: string,
) {
  const prisma = await getPrisma();

  // Get the threat model and org
  const threatModel = await prisma.threatModel.findUnique({
    where: { id: threatModelId },
    include: {
      project: {
        include: {
          organization: { select: { id: true } },
        },
      },
    },
  });

  if (!threatModel) {
    return { success: false, error: "Threat model not found" };
  }

  const orgId = threatModel.project.organization.id;

  // Verify the requester has permission
  // nosemgrep: tf-membership-query-missing-status -- status is checked on the result below
  const requesterMembership = await prisma.membership.findUnique({
    where: {
      userId_organizationId: {
        userId: requestingUserId,
        organizationId: orgId,
      },
    },
  });

  if (!requesterMembership || requesterMembership.status !== "ACTIVE") {
    return {
      success: false,
      error: "You are not an active member of this organization",
    };
  }

  // Get all guest access records for this model
  const accessRecords = await prisma.modelAccess.findMany({
    where: { threatModelId },
    include: {
      user: { select: { id: true, name: true, email: true } },
      grantedBy: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const canManageAccess = ["OWNER", "ADMIN", "EDITOR"].includes(
    requesterMembership.role,
  );

  return {
    success: true,
    accessRecords: accessRecords.map((a) => ({
      id: a.id,
      email: a.user?.email || a.guestEmail,
      userId: a.userId,
      role: a.role,
      canExport: a.canExport,
      expiresAt: a.expiresAt?.toISOString() || null,
      grantedAt: a.createdAt.toISOString(),
      lastAccessedAt: a.lastAccessedAt?.toISOString() || null,
      grantedBy: a.grantedBy,
      // Only show tokens to those who can manage access
      accessToken: canManageAccess ? a.accessToken : undefined,
    })),
    canManageAccess,
  };
}

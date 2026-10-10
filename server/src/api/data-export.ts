/**
 * Data Export API (GDPR Compliance)
 *
 * Endpoints for users to export all their personal data.
 */
import type { FastifyPluginAsync } from "fastify";
import { getPrisma } from "../db.js";
import { getAuthUser } from "../utils/auth-helpers.js";
import { logAudit } from "../services/audit.js";
import { sendBadRequest, sendNotFound } from "../utils/api-response.js";
import { routeAuthz } from "../middleware/authz-policy.js";

const OWN_DATA = routeAuthz("authenticated");

export const dataExportRoutes: FastifyPluginAsync = async (server) => {
  /**
   * GET /api/users/me/data-export
   * Request export of all user's personal data (GDPR Right to Data Portability)
   */
  server.get("/api/users/me/data-export", OWN_DATA, async (request, reply) => {
    const authUser = getAuthUser(request);
    const prisma = await getPrisma();

    // Fetch all user data
    const user = await prisma.user.findUnique({
      where: { id: authUser.id },
      include: {
        memberships: {
          include: {
            organization: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
        },
        userSessions: {
          select: {
            id: true,
            browser: true,
            os: true,
            device: true,
            ipAddress: true,
            createdAt: true,
            lastActiveAt: true,
          },
        },
        apiTokens: {
          select: {
            id: true,
            name: true,
            tokenPrefix: true,
            scopes: true,
            lastUsedAt: true,
            usageCount: true,
            createdAt: true,
            expiresAt: true,
            isActive: true,
          },
        },
        accounts: {
          select: {
            id: true,
            provider: true,
            type: true,
          },
        },
      },
    });

    if (!user) {
      return sendNotFound(reply, "User");
    }

    // Fetch audit logs for this user
    const auditLogs = await prisma.auditLog.findMany({
      where: { userId: authUser.id },
      select: {
        id: true,
        action: true,
        resourceType: true,
        resourceId: true,
        resourceName: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 1000, // Limit to most recent 1000
    });

    // Fetch threat models created by user (cap at 1000 to avoid full table scans on large orgs)
    const threatModels = await prisma.threatModel.findMany({
      where: { createdById: authUser.id },
      take: 1000,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        project: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Build export data
    const exportData = {
      exportedAt: new Date().toISOString(),
      exportType: "GDPR Data Export",
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        username: user.username,
        avatarUrl: user.avatarUrl,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt,
        lastLoginAt: user.lastLoginAt,
        preferences: user.preferences
          ? JSON.parse(user.preferences as string)
          : null,
        twoFactorEnabled: user.twoFactorEnabled,
        status: user.status,
      },
      organizations: user.memberships.map((m) => ({
        id: m.organization.id,
        name: m.organization.name,
        slug: m.organization.slug,
        role: m.role,
        joinedAt: m.createdAt,
      })),
      connectedAccounts: user.accounts.map((a) => ({
        provider: a.provider,
        type: a.type,
      })),
      sessions: user.userSessions.map((s) => ({
        id: s.id,
        browser: s.browser,
        os: s.os,
        device: s.device,
        ipAddress: s.ipAddress,
        createdAt: s.createdAt,
        lastActiveAt: s.lastActiveAt,
      })),
      apiTokens: user.apiTokens.map((t) => ({
        id: t.id,
        name: t.name,
        prefix: t.tokenPrefix,
        scopes: JSON.parse(t.scopes || "[]"),
        usageCount: t.usageCount,
        lastUsedAt: t.lastUsedAt,
        createdAt: t.createdAt,
        expiresAt: t.expiresAt,
        isActive: t.isActive,
      })),
      threatModelsCreated: threatModels.map((tm) => ({
        id: tm.id,
        name: tm.name,
        status: tm.status,
        project: tm.project?.name,
        createdAt: tm.createdAt,
        updatedAt: tm.updatedAt,
      })),
      activityLog: auditLogs.map((log) => ({
        action: log.action,
        resourceType: log.resourceType,
        resourceId: log.resourceId,
        resourceName: log.resourceName,
        timestamp: log.createdAt,
      })),
    };

    // Log the export
    await logAudit({
      scope: "SYSTEM",
      action: "EXPORT",
      resourceType: "USER",
      resourceId: authUser.id,
      resourceName: "Personal Data Export",
      userId: authUser.id,
      userEmail: authUser.email || "unknown",
      metadata: {
        exportType: "GDPR",
        recordCounts: {
          organizations: exportData.organizations.length,
          sessions: exportData.sessions.length,
          apiTokens: exportData.apiTokens.length,
          threatModels: exportData.threatModelsCreated.length,
          activityLogs: exportData.activityLog.length,
        },
      },
    });

    const filename = `personal-data-export-${new Date().toISOString().split("T")[0]}.json`;

    return reply
      .header("Content-Type", "application/json")
      .header("Content-Disposition", `attachment; filename="${filename}"`)
      .send(JSON.stringify(exportData, null, 2));
  });

  /**
   * DELETE /api/users/me/data
   * Request deletion of all user data (GDPR Right to Erasure)
   * This is a soft-delete that schedules the account for deletion
   */
  server.delete<{ Body: { confirmation: string; password?: string } }>(
    "/api/users/me/data",
    OWN_DATA,
    async (request, reply) => {
      const authUser = getAuthUser(request);
      const prisma = await getPrisma();
      const { confirmation, password } = request.body;

      // Require explicit confirmation
      if (confirmation !== "DELETE MY ACCOUNT") {
        return sendBadRequest(
          reply,
          'Please type "DELETE MY ACCOUNT" to confirm',
        );
      }

      const user = await prisma.user.findUnique({
        where: { id: authUser.id },
        select: {
          id: true,
          passwordHash: true,
          memberships: {
            where: { role: "OWNER" },
            select: {
              organizationId: true,
              organization: { select: { name: true } },
            },
          },
        },
      });

      if (!user) {
        return sendNotFound(reply, "User");
      }

      // If user has password, verify it
      if (user.passwordHash && password) {
        const bcrypt = await import("bcryptjs");
        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) {
          return sendBadRequest(reply, "Invalid password");
        }
      }

      // Check if user is sole owner of any organizations
      if (user.memberships.length > 0) {
        const ownedOrgs = user.memberships.map((m) => m.organization.name);
        return sendBadRequest(
          reply,
          `Cannot delete account. You are the sole owner of: ${ownedOrgs.join(", ")}. Please transfer ownership or delete these organizations first.`,
        );
      }

      // Schedule account for deletion (30-day grace period)
      const deletionDate = new Date();
      deletionDate.setDate(deletionDate.getDate() + 30);

      await prisma.user.update({
        where: { id: authUser.id },
        data: {
          status: "PENDING_DELETION",
          // Store deletion request metadata
          preferences: JSON.stringify({
            deletionRequestedAt: new Date().toISOString(),
            scheduledDeletionDate: deletionDate.toISOString(),
          }),
        },
      });

      // Log the deletion request
      await logAudit({
        scope: "SYSTEM",
        action: "DELETE",
        resourceType: "USER",
        resourceId: authUser.id,
        resourceName: "Account Deletion Request",
        userId: authUser.id,
        userEmail: authUser.email || "unknown",
        metadata: {
          requestType: "GDPR_ERASURE",
          scheduledDeletionDate: deletionDate.toISOString(),
        },
      });

      return {
        success: true,
        message:
          "Your account has been scheduled for deletion. You have 30 days to cancel this request by logging in.",
        scheduledDeletionDate: deletionDate.toISOString(),
      };
    },
  );

  /**
   * POST /api/users/me/data/cancel-deletion
   * Cancel a pending account deletion request
   */
  server.post(
    "/api/users/me/data/cancel-deletion",
    OWN_DATA,
    async (request, reply) => {
      const authUser = getAuthUser(request);
      const prisma = await getPrisma();

      const user = await prisma.user.findUnique({
        where: { id: authUser.id },
        select: { status: true },
      });

      if (!user) {
        return sendNotFound(reply, "User");
      }

      if (user.status !== "PENDING_DELETION") {
        return sendBadRequest(
          reply,
          "Your account is not scheduled for deletion",
        );
      }

      await prisma.user.update({
        where: { id: authUser.id },
        data: {
          status: "ACTIVE",
          preferences: null, // Clear deletion metadata
        },
      });

      // Log the cancellation
      await logAudit({
        scope: "SYSTEM",
        action: "UPDATE",
        resourceType: "USER",
        resourceId: authUser.id,
        resourceName: "Account Deletion Cancelled",
        userId: authUser.id,
        userEmail: authUser.email || "unknown",
      });

      return {
        success: true,
        message: "Account deletion request has been cancelled",
      };
    },
  );
};

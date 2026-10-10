/**
 * User API Routes
 *
 * User profile management, password changes, and user-related operations.
 */
import type { FastifyPluginAsync } from "fastify";
import { getPrisma } from "../db.js";
import bcrypt from "bcryptjs";
import { validatePassword } from "../services/password-validation.js";
import { invalidateSessionCache } from "../middleware/auth.js";
import {
  sendSuccess,
  sendNotFound,
  sendBadRequest,
} from "../utils/api-response.js";
import { getAuthUser } from "../utils/auth-helpers.js";
import { routeAuthz } from "../middleware/authz-policy.js";
import { isReadOnlyUser } from "../middleware/read-only-guard.js";

const AUTHENTICATED = routeAuthz("authenticated");

/** Profile update input */
interface ProfileUpdateInput {
  name?: string;
  avatarUrl?: string;
}

/** Password change input */
interface PasswordChangeInput {
  currentPassword: string;
  newPassword: string;
}

export const userRoutes: FastifyPluginAsync = async (server) => {
  // ==========================================================================
  // Current User Profile
  // ==========================================================================

  /** Get current user profile */
  server.get("/api/users/me", AUTHENTICATED, async (request, reply) => {
    const authUser = getAuthUser(request);
    const prisma = await getPrisma();

    const user = await prisma.user.findUnique({
      where: { id: authUser.id },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        image: true,
        isSuperAdmin: true,
        emailVerified: true,
        createdAt: true,
        lastLoginAt: true,
        preferences: true,
        memberships: {
          select: {
            id: true,
            role: true,
            organizationId: true,
            organization: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      request.log.warn(
        { authUserId: authUser.id, authEmail: authUser.email },
        "GET /api/users/me: user not found in database",
      );
      return sendNotFound(reply, "User");
    }

    // Parse preferences if stored as JSON string
    let preferences = {};
    if (user.preferences) {
      try {
        preferences = JSON.parse(user.preferences);
      } catch {
        // parse fallback — intentionally silent
        preferences = {};
      }
    }

    return sendSuccess(reply, {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl || user.image,
      isSuperAdmin: user.isSuperAdmin,
      readOnly: isReadOnlyUser(user.email),
      emailVerified: user.emailVerified !== null,
      createdAt: user.createdAt.toISOString(),
      lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
      preferences,
      organizations: user.memberships.map((m) => ({
        id: m.organization.id,
        name: m.organization.name,
        slug: m.organization.slug,
        role: m.role,
        membershipId: m.id,
      })),
    });
  });

  /** Update current user profile */
  server.patch<{ Body: ProfileUpdateInput }>(
    "/api/users/me",
    AUTHENTICATED,
    async (request, reply) => {
      const authUser = getAuthUser(request);
      const prisma = await getPrisma();
      const { name, avatarUrl } = request.body;

      // Validate name if provided
      if (name !== undefined && name.length < 2) {
        return sendBadRequest(reply, "Name must be at least 2 characters");
      }

      // Validate avatar URL if provided
      if (avatarUrl !== undefined && avatarUrl.length > 0) {
        try {
          new URL(avatarUrl);
        } catch {
          // parse fallback — error surfaced to caller via sendBadRequest
          return sendBadRequest(reply, "Invalid avatar URL");
        }
      }

      const user = await prisma.user.update({
        where: { id: authUser.id },
        data: {
          ...(name !== undefined && { name }),
          ...(avatarUrl !== undefined && { avatarUrl }),
        },
        select: {
          id: true,
          email: true,
          name: true,
          avatarUrl: true,
          image: true,
          isSuperAdmin: true,
          emailVerified: true,
          createdAt: true,
          lastLoginAt: true,
        },
      });

      return sendSuccess(reply, {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl || user.image,
        isSuperAdmin: user.isSuperAdmin,
        emailVerified: user.emailVerified !== null,
        createdAt: user.createdAt.toISOString(),
        lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
      });
    },
  );

  /** Change current user password */
  server.post<{ Body: PasswordChangeInput }>(
    "/api/users/me/password",
    AUTHENTICATED,
    async (request, reply) => {
      const authUser = getAuthUser(request);
      const prisma = await getPrisma();
      const { currentPassword, newPassword } = request.body;

      // Get user with password hash
      const user = await prisma.user.findUnique({
        where: { id: authUser.id },
        select: { id: true, passwordHash: true },
      });

      if (!user) {
        return sendNotFound(reply, "User");
      }

      // Check if user has a password (might be OAuth-only user)
      if (!user.passwordHash) {
        return sendBadRequest(reply, "No password set", {
          message:
            "This account uses social login. Please set a password first.",
        });
      }

      // Verify current password
      const isValidPassword = await bcrypt.compare(
        currentPassword,
        user.passwordHash,
      );
      if (!isValidPassword) {
        return sendBadRequest(reply, "Current password is incorrect");
      }

      // Validate new password against policy
      const passwordValidation = await validatePassword(newPassword);
      if (!passwordValidation.valid) {
        return sendBadRequest(reply, "Invalid password", {
          message: passwordValidation.errors.join(". "),
        });
      }

      // Ensure new password is different
      const isSamePassword = await bcrypt.compare(
        newPassword,
        user.passwordHash,
      );
      if (isSamePassword) {
        return sendBadRequest(
          reply,
          "New password must be different from current password",
        );
      }

      // Hash and update password
      const newPasswordHash = await bcrypt.hash(newPassword, 12);
      // passwordChangedAt ends every session issued before now, this one
      // included, so a stolen session does not outlive the password.
      await prisma.user.update({
        where: { id: authUser.id },
        data: { passwordHash: newPasswordHash, passwordChangedAt: new Date() },
      });
      await invalidateSessionCache(authUser.id);

      return sendSuccess(reply, {
        success: true,
        message: "Password updated. Please sign in again.",
      });
    },
  );

  /** Set password for OAuth users */
  server.post<{ Body: { password: string } }>(
    "/api/users/me/set-password",
    AUTHENTICATED,
    async (request, reply) => {
      const authUser = getAuthUser(request);
      const prisma = await getPrisma();
      const { password } = request.body;

      // Get user
      const user = await prisma.user.findUnique({
        where: { id: authUser.id },
        select: { id: true, passwordHash: true },
      });

      if (!user) {
        return sendNotFound(reply, "User");
      }

      // Only allow setting password if none exists
      if (user.passwordHash) {
        return sendBadRequest(reply, "Password already set", {
          message: "Use the change password endpoint to update your password.",
        });
      }

      // Validate password against policy
      const passwordValidation = await validatePassword(password);
      if (!passwordValidation.valid) {
        return sendBadRequest(reply, "Invalid password", {
          message: passwordValidation.errors.join(". "),
        });
      }

      // Hash and set password
      const passwordHash = await bcrypt.hash(password, 12);
      await prisma.user.update({
        where: { id: authUser.id },
        data: { passwordHash },
      });

      return sendSuccess(reply, {
        success: true,
        message: "Password set successfully",
      });
    },
  );

  /** Delete current user account */
  server.delete("/api/users/me", AUTHENTICATED, async (request, reply) => {
    const authUser = getAuthUser(request);
    const prisma = await getPrisma();

    // Check if user is the sole owner of any organization
    const ownedOrgs = await prisma.organization.findMany({
      where: {
        memberships: {
          some: {
            userId: authUser.id,
            status: "ACTIVE",
            role: "OWNER",
          },
        },
      },
      include: {
        // Only ACTIVE owners can take over; a suspended co-owner does not count.
        memberships: {
          where: { role: "OWNER", status: "ACTIVE" },
        },
      },
    });

    // Find orgs where user is the only owner
    const soleOwnedOrgs = ownedOrgs.filter(
      (org) => org.memberships.length === 1,
    );

    if (soleOwnedOrgs.length > 0) {
      return sendBadRequest(reply, "Cannot delete account", {
        message: `You are the sole owner of ${soleOwnedOrgs.length} organization(s). Transfer ownership or delete the organization(s) first.`,
        organizations: soleOwnedOrgs.map((o) => ({ id: o.id, name: o.name })),
      });
    }

    // Delete user (cascade will handle related records)
    await prisma.user.delete({ where: { id: authUser.id } });

    return sendSuccess(reply, {
      success: true,
      message: "Account deleted successfully",
    });
  });

  // ==========================================================================
  // User Preferences
  // ==========================================================================

  /** Get user preferences */
  server.get(
    "/api/users/me/preferences",
    AUTHENTICATED,
    async (request, reply) => {
      const authUser = getAuthUser(request);
      const prisma = await getPrisma();

      const user = await prisma.user.findUnique({
        where: { id: authUser.id },
        select: { preferences: true },
      });

      if (!user) {
        return sendNotFound(reply, "User");
      }

      let preferences = {};
      if (user.preferences) {
        try {
          preferences = JSON.parse(user.preferences);
        } catch {
          // parse fallback — intentionally silent
          preferences = {};
        }
      }

      return sendSuccess(reply, preferences);
    },
  );

  /** Update user preferences */
  server.patch<{ Body: Record<string, unknown> }>(
    "/api/users/me/preferences",
    AUTHENTICATED,
    async (request, reply) => {
      const authUser = getAuthUser(request);
      const prisma = await getPrisma();
      const updates = request.body;

      // Get current preferences
      const user = await prisma.user.findUnique({
        where: { id: authUser.id },
        select: { preferences: true },
      });

      if (!user) {
        return sendNotFound(reply, "User");
      }

      let currentPreferences = {};
      if (user.preferences) {
        try {
          currentPreferences = JSON.parse(user.preferences);
        } catch {
          // parse fallback — intentionally silent
          currentPreferences = {};
        }
      }

      // Merge with updates
      const newPreferences = { ...currentPreferences, ...updates };

      // Save
      await prisma.user.update({
        where: { id: authUser.id },
        data: { preferences: JSON.stringify(newPreferences) },
      });

      return sendSuccess(reply, newPreferences);
    },
  );
};

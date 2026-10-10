/**
 * Two-Factor Authentication API
 *
 * Endpoints for 2FA setup, verification, and management.
 */
import type { FastifyPluginAsync } from "fastify";
import { getPrisma } from "../db.js";
import {
  generateTwoFactorSetup,
  verifyTOTPCode,
  encryptSecret,
  decryptSecret,
  prepareBackupCodesForStorage,
  countRemainingBackupCodes,
  generateBackupCodes,
} from "../services/two-factor.js";
import { sendBadRequest, sendNotFound } from "../utils/api-response.js";
import { getAuthUser } from "../utils/auth-helpers.js";
import { routeAuthz } from "../middleware/authz-policy.js";

// Request types
interface EnableTwoFactorBody {
  code: string; // TOTP code to verify setup
}

interface DisableTwoFactorBody {
  code: string; // TOTP code to verify disable
  password?: string; // Required for accounts that have a password
}

interface RegenerateBackupCodesBody {
  code: string; // TOTP code to verify
}

/** The caller's own 2FA fields (secret and backup codes still encrypted). */
async function findTwoFactorFields(userId: string) {
  const prisma = await getPrisma();
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      twoFactorEnabled: true,
      twoFactorSecret: true,
      twoFactorBackupCodes: true,
    },
  });
}

/** Every two-factor route acts only on the caller's own user row. */
const ME = routeAuthz("authenticated");

export const twoFactorRoutes: FastifyPluginAsync = async (server) => {
  // Get 2FA status for current user
  server.get("/api/users/me/two-factor", ME, async (request, reply) => {
    const authUser = getAuthUser(request);
    const prisma = await getPrisma();

    const user = await prisma.user.findUnique({
      where: { id: authUser.id },
      select: {
        twoFactorEnabled: true,
        twoFactorVerifiedAt: true,
        twoFactorBackupCodes: true,
      },
    });

    if (!user) {
      return sendNotFound(reply, "User");
    }

    return {
      enabled: user.twoFactorEnabled,
      verifiedAt: user.twoFactorVerifiedAt,
      backupCodesRemaining: countRemainingBackupCodes(
        user.twoFactorBackupCodes,
      ),
    };
  });

  // Start 2FA setup - generates secret and QR code
  server.post("/api/users/me/two-factor/setup", ME, async (request, reply) => {
    const authUser = getAuthUser(request);
    const prisma = await getPrisma();

    const user = await prisma.user.findUnique({
      where: { id: authUser.id },
      select: { email: true, twoFactorEnabled: true },
    });

    if (!user) {
      return sendNotFound(reply, "User");
    }

    if (user.twoFactorEnabled) {
      return sendBadRequest(
        reply,
        "2FA is already enabled. Disable it first to set up again.",
      );
    }

    // Generate new 2FA setup
    const setup = await generateTwoFactorSetup(user.email);

    // Store encrypted secret temporarily (not enabled yet)
    await prisma.user.update({
      where: { id: authUser.id },
      data: {
        twoFactorSecret: encryptSecret(setup.secret),
        twoFactorBackupCodes: prepareBackupCodesForStorage(setup.backupCodes),
        twoFactorEnabled: false, // Not enabled until verified
      },
    });

    return {
      qrCode: setup.qrCodeDataUrl,
      secret: setup.secret, // Show secret for manual entry
      backupCodes: setup.backupCodes, // User should save these
    };
  });

  // Complete 2FA setup by verifying a code
  server.post<{ Body: EnableTwoFactorBody }>(
    "/api/users/me/two-factor/enable",
    ME,
    async (request, reply) => {
      const authUser = getAuthUser(request);
      const prisma = await getPrisma();

      const { code } = request.body;
      if (!code || code.length !== 6) {
        return sendBadRequest(reply, "Invalid code format");
      }

      const user = await findTwoFactorFields(authUser.id);

      if (!user) {
        return sendNotFound(reply, "User");
      }

      if (user.twoFactorEnabled) {
        return sendBadRequest(reply, "2FA is already enabled");
      }

      if (!user.twoFactorSecret) {
        return sendBadRequest(
          reply,
          "No 2FA setup in progress. Call /setup first.",
        );
      }

      // Verify the TOTP code
      const secret = decryptSecret(user.twoFactorSecret);
      if (!verifyTOTPCode(secret, code)) {
        return sendBadRequest(reply, "Invalid verification code");
      }

      // Enable 2FA
      await prisma.user.update({
        where: { id: authUser.id },
        data: {
          twoFactorEnabled: true,
          twoFactorVerifiedAt: new Date(),
        },
      });

      return { success: true, message: "2FA enabled successfully" };
    },
  );

  // Disable 2FA
  server.post<{ Body: DisableTwoFactorBody }>(
    "/api/users/me/two-factor/disable",
    ME,
    async (request, reply) => {
      const authUser = getAuthUser(request);
      const prisma = await getPrisma();

      const { code, password } = request.body;
      if (!code) {
        return sendBadRequest(reply, "Verification code required");
      }

      const user = await prisma.user.findUnique({
        where: { id: authUser.id },
        select: {
          twoFactorEnabled: true,
          twoFactorSecret: true,
          passwordHash: true,
        },
      });

      if (!user) {
        return sendNotFound(reply, "User");
      }

      if (!user.twoFactorEnabled) {
        return sendBadRequest(reply, "2FA is not enabled");
      }

      // A stolen session alone must not be enough to turn 2FA off.
      if (user.passwordHash) {
        const bcrypt = await import("bcryptjs");
        if (!password || !(await bcrypt.compare(password, user.passwordHash))) {
          return sendBadRequest(reply, "Invalid password");
        }
      }

      // Verify TOTP code
      if (user.twoFactorSecret) {
        const secret = decryptSecret(user.twoFactorSecret);
        if (!verifyTOTPCode(secret, code)) {
          return sendBadRequest(reply, "Invalid verification code");
        }
      }

      // Disable 2FA
      await prisma.user.update({
        where: { id: authUser.id },
        data: {
          twoFactorEnabled: false,
          twoFactorSecret: null,
          twoFactorBackupCodes: null,
          twoFactorVerifiedAt: null,
        },
      });

      return { success: true, message: "2FA disabled successfully" };
    },
  );

  // Regenerate backup codes
  server.post<{ Body: RegenerateBackupCodesBody }>(
    "/api/users/me/two-factor/backup-codes",
    ME,
    async (request, reply) => {
      const authUser = getAuthUser(request);
      const prisma = await getPrisma();

      const { code } = request.body;
      if (!code) {
        return sendBadRequest(reply, "Verification code required");
      }

      const user = await findTwoFactorFields(authUser.id);

      if (!user) {
        return sendNotFound(reply, "User");
      }

      if (!user.twoFactorEnabled || !user.twoFactorSecret) {
        return sendBadRequest(reply, "2FA is not enabled");
      }

      // Verify TOTP code
      const secret = decryptSecret(user.twoFactorSecret);
      if (!verifyTOTPCode(secret, code)) {
        return sendBadRequest(reply, "Invalid verification code");
      }

      // Generate new backup codes
      const newCodes = generateBackupCodes();

      // Store hashed codes
      await prisma.user.update({
        where: { id: authUser.id },
        data: {
          twoFactorBackupCodes: prepareBackupCodesForStorage(newCodes),
        },
      });

      return {
        success: true,
        backupCodes: newCodes,
        message: "New backup codes generated. Save these securely.",
      };
    },
  );
};

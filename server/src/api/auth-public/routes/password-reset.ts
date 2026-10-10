/**
 * Password Reset Routes
 *
 * Forgot password, verify reset token, and reset password.
 * All routes are PUBLIC - no authentication required.
 */
import type { FastifyPluginAsync } from "fastify";
import { getPrisma } from "../../../db.js";
import bcrypt from "bcryptjs";
import { emailService } from "../../../services/email/index.js";
import { validatePassword } from "../../../services/password-validation.js";
import { sendSuccess, sendBadRequest } from "../../../utils/api-response.js";
import { routeAuthz } from "../../../middleware/authz-policy.js";
import { createHash } from "crypto";
import {
  emailRequestRouteOptions,
  generateToken,
  TOKEN_EXPIRY_MS,
} from "../shared.js";
import { invalidateSessionCache } from "../../../middleware/auth.js";

function hashResetToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Forgot password request */
interface ForgotPasswordRequest {
  email: string;
}

/** Reset password request */
interface ResetPasswordRequest {
  token: string;
  password: string;
}

/** Verify token request */
interface VerifyTokenRequest {
  token: string;
}

export const passwordResetRoutes: FastifyPluginAsync = async (server) => {
  /**
   * POST /api/auth/forgot-password
   * Request a password reset email.
   */
  server.post<{ Body: ForgotPasswordRequest }>(
    "/api/auth/forgot-password",
    emailRequestRouteOptions(
      "pre-login; always returns the same response, emails only the account owner",
    ),
    async (request, reply) => {
      const prisma = await getPrisma();
      const { email } = request.body;

      if (!email) {
        return sendBadRequest(reply, "Email is required");
      }

      // Always return success to prevent email enumeration
      const successResponseData = {
        success: true,
        message:
          "If an account exists with this email, you will receive a password reset link.",
      };

      const user = await prisma.user.findUnique({
        where: { email: email.toLowerCase() },
        select: { id: true, email: true, name: true, passwordHash: true },
      });

      if (!user) {
        server.log.info(
          { email },
          "Password reset requested for non-existent email",
        );
        return sendSuccess(reply, successResponseData);
      }

      // Check if user has a password (OAuth-only users can't reset password)
      if (!user.passwordHash) {
        server.log.info(
          { email },
          "Password reset requested for OAuth-only user",
        );
        return sendSuccess(reply, successResponseData);
      }

      // Generate reset token
      const resetToken = generateToken();
      const resetTokenHash = hashResetToken(resetToken);
      const resetTokenExpiry = new Date(Date.now() + TOKEN_EXPIRY_MS);

      await prisma.user.update({
        where: { id: user.id },
        data: {
          resetTokenHash,
          resetTokenExpiry,
        },
      });

      // Send password reset email
      const emailResult = await emailService.sendPasswordResetEmail(
        user.email,
        user.name || "User",
        resetToken,
      );

      if (!emailResult.success) {
        server.log.warn(
          { userId: user.id, error: emailResult.error },
          "Failed to send password reset email",
        );
      } else {
        server.log.info({ userId: user.id }, "Password reset email sent");
      }

      return sendSuccess(reply, successResponseData);
    },
  );

  /**
   * POST /api/auth/verify-reset-token
   * Verify if a reset token is valid.
   */
  server.post<{ Body: VerifyTokenRequest }>(
    "/api/auth/verify-reset-token",
    routeAuthz({
      public: "pre-login; the hashed, expiring reset token is the credential",
    }),
    async (request, reply) => {
      const prisma = await getPrisma();
      const { token } = request.body;

      if (!token) {
        return sendBadRequest(reply, "Token is required");
      }

      const tokenHash = hashResetToken(token);
      const user = await prisma.user.findFirst({
        where: {
          resetTokenHash: tokenHash,
          resetTokenExpiry: {
            gt: new Date(),
          },
        },
        select: { id: true, email: true },
      });

      if (!user) {
        return sendBadRequest(reply, "Invalid or expired reset token");
      }

      return sendSuccess(reply, {
        valid: true,
        email: user.email.replace(/(.{2})(.*)(@.*)/, "$1***$3"),
      });
    },
  );

  /**
   * POST /api/auth/reset-password
   * Reset password with token.
   */
  server.post<{ Body: ResetPasswordRequest }>(
    "/api/auth/reset-password",
    routeAuthz({
      public: "pre-login; the hashed, expiring reset token is the credential",
    }),
    async (request, reply) => {
      const prisma = await getPrisma();
      const { token, password } = request.body;

      if (!token) {
        return sendBadRequest(reply, "Token is required");
      }

      if (!password) {
        return sendBadRequest(reply, "Password is required");
      }

      // Validate password against policy
      const passwordValidation = await validatePassword(password);
      if (!passwordValidation.valid) {
        return sendBadRequest(reply, "Invalid password", {
          message: passwordValidation.errors.join(". "),
        });
      }

      const tokenHash = hashResetToken(token);
      const user = await prisma.user.findFirst({
        where: {
          resetTokenHash: tokenHash,
          resetTokenExpiry: {
            gt: new Date(),
          },
        },
        select: { id: true, email: true, passwordHash: true, status: true },
      });

      if (!user) {
        return sendBadRequest(reply, "Invalid or expired reset token", {
          message: "Please request a new password reset link.",
        });
      }

      // Check that new password is different from old
      if (user.passwordHash) {
        const isSamePassword = await bcrypt.compare(
          password,
          user.passwordHash,
        );
        if (isSamePassword) {
          return sendBadRequest(reply, "Password unchanged", {
            message:
              "New password must be different from your current password.",
          });
        }
      }

      // Hash new password
      const passwordHash = await bcrypt.hash(password, 12);

      await prisma.user.update({
        where: { id: user.id },
        data: {
          passwordHash,
          resetTokenHash: null,
          resetTokenExpiry: null,
          passwordChangedAt: new Date(),
          // Proving control of the email also clears a lockout.
          failedLoginAttempts: 0,
          lockedUntil: null,
          ...(user.status === "LOCKED" ? { status: "ACTIVE" as const } : {}),
        },
      });

      // Logins issued before the reset are rejected from now on; also drop
      // any cached session so this replica stops trusting it immediately.
      await invalidateSessionCache(user.id);

      server.log.info({ userId: user.id }, "Password reset successfully");

      return sendSuccess(reply, {
        success: true,
        message:
          "Password has been reset successfully. You can now log in with your new password.",
      });
    },
  );
};

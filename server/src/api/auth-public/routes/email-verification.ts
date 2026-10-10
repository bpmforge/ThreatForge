/**
 * Email Verification Routes
 *
 * Verify email, resend verification, and check verification status.
 * All routes are PUBLIC - no authentication required.
 */
import type { FastifyPluginAsync } from "fastify";
import { getPrisma } from "../../../db.js";
import { emailService } from "../../../services/email/index.js";
import { sendSuccess, sendBadRequest } from "../../../utils/api-response.js";
import {
  emailRequestRouteOptions,
  generateToken,
  hashVerificationToken,
  verificationTokenCandidates,
} from "../shared.js";
import { routeAuthz } from "../../../middleware/authz-policy.js";

const VERIFY_TOKEN = routeAuthz({
  public:
    "pre-login; caller proves ownership with the emailed single-use verification token",
});

export const emailVerificationRoutes: FastifyPluginAsync = async (server) => {
  /**
   * POST /api/auth/verify-email
   * Verify email with token.
   */
  server.post<{ Body: { token: string } }>(
    "/api/auth/verify-email",
    VERIFY_TOKEN,
    async (request, reply) => {
      const prisma = await getPrisma();
      const { token } = request.body;

      if (!token) {
        return sendBadRequest(reply, "Token is required");
      }

      const user = await prisma.user.findFirst({
        where: {
          verificationToken: { in: verificationTokenCandidates(token) },
          verificationTokenExpiry: {
            gt: new Date(),
          },
        },
        select: { id: true, email: true, emailVerified: true },
      });

      if (!user) {
        return sendBadRequest(reply, "Invalid or expired verification link", {
          message: "Please request a new verification email.",
        });
      }

      // Check if already verified
      if (user.emailVerified) {
        return sendSuccess(reply, {
          success: true,
          message: "Email is already verified.",
          alreadyVerified: true,
        });
      }

      // Mark email as verified and clear token
      await prisma.user.update({
        where: { id: user.id },
        data: {
          emailVerified: new Date(),
          verificationToken: null,
          verificationTokenExpiry: null,
        },
      });

      server.log.info({ userId: user.id }, "Email verified successfully");

      return sendSuccess(reply, {
        success: true,
        message:
          "Email verified successfully. You can now access all features.",
      });
    },
  );

  /**
   * POST /api/auth/resend-verification
   * Resend verification email.
   */
  server.post<{ Body: { email: string } }>(
    "/api/auth/resend-verification",
    emailRequestRouteOptions(
      "pre-login; rate-limited, same response for every email, mails only the account's own address",
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
          "If an unverified account exists with this email, a verification link will be sent.",
      };

      const user = await prisma.user.findUnique({
        where: { email: email.toLowerCase() },
        select: { id: true, email: true, name: true, emailVerified: true },
      });

      if (!user) {
        server.log.info(
          { email },
          "Verification requested for non-existent email",
        );
        return sendSuccess(reply, successResponseData);
      }

      // Check if already verified
      if (user.emailVerified) {
        server.log.info(
          { email },
          "Verification requested for already verified email",
        );
        return sendSuccess(reply, successResponseData);
      }

      // Generate verification token (24 hour expiry)
      const verificationToken = generateToken();
      const verificationTokenExpiry = new Date(
        Date.now() + 24 * 60 * 60 * 1000,
      );

      await prisma.user.update({
        where: { id: user.id },
        data: {
          verificationToken: hashVerificationToken(verificationToken),
          verificationTokenExpiry,
        },
      });

      // Send verification email
      const emailResult = await emailService.sendVerificationEmail(
        user.email,
        user.name || "User",
        verificationToken,
      );

      if (!emailResult.success) {
        server.log.warn(
          { userId: user.id, error: emailResult.error },
          "Failed to send verification email",
        );
      } else {
        server.log.info({ userId: user.id }, "Verification email sent");
      }

      return sendSuccess(reply, successResponseData);
    },
  );

  /**
   * POST /api/auth/verification-status
   * Check if a token is valid (for UI display).
   */
  server.post<{ Body: { token: string } }>(
    "/api/auth/verification-status",
    routeAuthz({
      public:
        "pre-login; reports only on the verification token supplied, email masked",
    }),
    async (request, reply) => {
      const prisma = await getPrisma();
      const { token } = request.body;

      if (!token) {
        return sendBadRequest(reply, "Token is required");
      }

      const user = await prisma.user.findFirst({
        where: {
          verificationToken: { in: verificationTokenCandidates(token) },
          verificationTokenExpiry: {
            gt: new Date(),
          },
        },
        select: { id: true, email: true, emailVerified: true },
      });

      if (!user) {
        return sendSuccess(reply, {
          valid: false,
          error: "Invalid or expired verification link",
        });
      }

      return sendSuccess(reply, {
        valid: true,
        email: user.email.replace(/(.{2})(.*)(@.*)/, "$1***$3"),
        alreadyVerified: user.emailVerified !== null,
      });
    },
  );
};

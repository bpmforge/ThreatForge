/**
 * Password sign-in check used by the Next.js credentials provider.
 *
 * Lockout, account status and two-factor codes are all decided here, because
 * only the backend can decrypt two-factor secrets. The frontend's authorize()
 * forwards the form fields and maps the error code to a message.
 */
import type { FastifyPluginAsync, FastifyReply } from "fastify";
import bcrypt from "bcryptjs";
import { getPrisma } from "../../../db.js";
import { routeAuthz } from "../../../middleware/authz-policy.js";
import { sendSuccess, errorResponse } from "../../../utils/api-response.js";
import {
  decryptSecret,
  getBackupCodesFromStorage,
  storeHashedBackupCodes,
  verifyBackupCode,
  verifyTOTPCode,
} from "../../../services/two-factor.js";

interface CredentialsBody {
  email?: unknown;
  password?: unknown;
  code?: unknown;
}

/** Error codes the login form understands. */
type CredentialsErrorCode =
  | "invalid_credentials"
  | "account_locked"
  | "two_factor_required"
  | "invalid_two_factor_code"
  | "email_unverified"
  | "account_disabled";

const MESSAGES: Record<CredentialsErrorCode, string> = {
  invalid_credentials: "Invalid email or password",
  account_locked: "Too many failed attempts. Try again later.",
  two_factor_required: "Enter the code from your authenticator app",
  invalid_two_factor_code: "Invalid verification code",
  email_unverified: "Verify your email address before signing in",
  account_disabled: "This account is disabled. Contact your administrator.",
};

function reject(reply: FastifyReply, code: CredentialsErrorCode) {
  return reply
    .status(401)
    .send(errorResponse(MESSAGES[code], code, undefined, reply.request.id));
}

// Compared against when the email has no password, so an unknown address
// takes as long to reject as a wrong password.
let dummyHash: Promise<string> | undefined;
function getDummyHash() {
  dummyHash ??= bcrypt.hash("no-such-account", 12);
  return dummyHash;
}

/** Statuses that may sign in. PENDING_DELETION can sign in to cancel. */
const SIGN_IN_STATUSES = new Set(["ACTIVE", "PENDING_DELETION"]);

export const credentialsRoutes: FastifyPluginAsync = async (server) => {
  server.post<{ Body: CredentialsBody }>(
    "/api/auth/credentials",
    routeAuthz({
      public:
        "pre-login; requires the account password, failures count toward the account lockout",
    }),
    async (request, reply) => {
      const { email, password, code } = request.body ?? {};
      if (typeof email !== "string" || typeof password !== "string") {
        return reject(reply, "invalid_credentials");
      }

      const prisma = await getPrisma();
      const user = await prisma.user.findUnique({
        where: { email: email.trim().toLowerCase() },
      });

      if (!user?.passwordHash) {
        await bcrypt.compare(password, await getDummyHash());
        return reject(reply, "invalid_credentials");
      }

      const now = new Date();
      if (user.lockedUntil && user.lockedUntil > now) {
        return reject(reply, "account_locked");
      }

      const settings = await prisma.systemSettings.findFirst({
        where: { id: "default" },
        select: { maxLoginAttempts: true, lockoutDurationMinutes: true },
      });

      const userId = user.id;
      /** Counts a failed password or code; locks the account at the limit. */
      async function recordFailure(failure: CredentialsErrorCode) {
        // Atomic increment, so parallel guesses each get a distinct count.
        const updated = await prisma.user.update({
          where: { id: userId },
          data: { failedLoginAttempts: { increment: 1 } },
          select: { failedLoginAttempts: true },
        });
        const maxAttempts = settings?.maxLoginAttempts ?? 5;
        const locked = updated.failedLoginAttempts >= maxAttempts;
        if (locked) {
          await prisma.user.update({
            where: { id: userId },
            data: {
              failedLoginAttempts: 0,
              lockedUntil: new Date(
                Date.now() +
                  (settings?.lockoutDurationMinutes ?? 15) * 60 * 1000,
              ),
            },
          });
        }
        return reject(reply, locked ? "account_locked" : failure);
      }

      if (!(await bcrypt.compare(password, user.passwordHash))) {
        return recordFailure("invalid_credentials");
      }

      // Status is only revealed to someone who knows the password.
      // LOCKED is the old way of marking a lockout; lockedUntil decides now.
      // A verified address with a pending status is an account verified
      // before verify-email activated it; it is let in and activated below.
      const verifiedButPending =
        user.status === "PENDING_VERIFICATION" && !!user.emailVerified;
      if (user.status === "PENDING_VERIFICATION" && !verifiedButPending) {
        return reject(reply, "email_unverified");
      }
      if (
        !SIGN_IN_STATUSES.has(user.status) &&
        user.status !== "LOCKED" &&
        !verifiedButPending
      ) {
        return reject(reply, "account_disabled");
      }

      let backupCodes: string | undefined;
      if (user.twoFactorEnabled && user.twoFactorSecret) {
        if (typeof code !== "string" || !code.trim()) {
          return reject(reply, "two_factor_required");
        }
        const submitted = code.trim();
        const totpOk =
          /^\d{6}$/.test(submitted) &&
          verifyTOTPCode(decryptSecret(user.twoFactorSecret), submitted);
        if (!totpOk) {
          const stored = user.twoFactorBackupCodes
            ? getBackupCodesFromStorage(user.twoFactorBackupCodes)
            : [];
          const match = verifyBackupCode(submitted, stored);
          if (match < 0) return recordFailure("invalid_two_factor_code");
          stored.splice(match, 1);
          backupCodes = storeHashedBackupCodes(stored);
        }
      }

      await prisma.user.update({
        where: { id: user.id },
        data: {
          lastLoginAt: now,
          failedLoginAttempts: 0,
          lockedUntil: null,
          ...(user.status === "LOCKED" || verifiedButPending
            ? { status: "ACTIVE" as const }
            : {}),
          ...(backupCodes ? { twoFactorBackupCodes: backupCodes } : {}),
        },
      });

      return sendSuccess(reply, {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image || user.avatarUrl,
      });
    },
  );
};

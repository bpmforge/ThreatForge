/**
 * User Password Rotation Script
 *
 * Sets a new password for an EXISTING user (by email). Use to rotate a
 * compromised or burned credential without the user having to log in with the
 * old password. The new password is read from the environment on the host that
 * runs this script — it is never hard-coded or logged.
 *
 * Usage:
 *   ROTATE_USER_EMAIL="admin@example.com" \
 *   ROTATE_USER_NEW_PASSWORD="<a strong new password>" \
 *   npm run admin:rotate-password        # (= tsx src/scripts/rotate-user-password.ts)
 *
 * Behavior:
 * - Requires the user to already exist (this is a rotation, not a create — it
 *   will NOT silently mint an account).
 * - Enforces a 12-char minimum.
 * - bcrypt-hashes at cost 12 (same as bootstrap-admin) and updates passwordHash.
 * - Writes an audit-log entry (no password material recorded).
 */
import "dotenv/config";
import { getPrisma } from "../db.js";
import bcrypt from "bcryptjs";

const MIN_PASSWORD_LENGTH = 12;

async function rotatePassword(): Promise<{ ok: boolean; message: string }> {
  const email = process.env.ROTATE_USER_EMAIL;
  const newPassword = process.env.ROTATE_USER_NEW_PASSWORD;

  if (!email) {
    return { ok: false, message: "ROTATE_USER_EMAIL is required" };
  }
  if (!newPassword) {
    return { ok: false, message: "ROTATE_USER_NEW_PASSWORD is required" };
  }
  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    return {
      ok: false,
      message: `New password must be at least ${MIN_PASSWORD_LENGTH} characters`,
    };
  }

  const prisma = await getPrisma();

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, name: true },
  });
  if (!user) {
    return {
      ok: false,
      message: `No user with email ${email} — this script rotates existing users only`,
    };
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash },
  });

  await prisma.auditLog.create({
    data: {
      action: "UPDATE",
      resourceType: "USER",
      resourceId: user.id,
      resourceName: user.name || email,
      // Never record password material — only that a rotation happened.
      changes: JSON.stringify({
        passwordHash: { old: "[redacted]", new: "[redacted]" },
      }),
      metadata: JSON.stringify({
        source: "rotate-user-password-script",
        rotatedAt: new Date().toISOString(),
      }),
      userId: user.id,
      userEmail: email,
    },
  });

  return { ok: true, message: `Password rotated for ${email}` };
}

async function main() {
  console.log("\n=== User Password Rotation ===\n");
  const result = await rotatePassword();
  if (result.ok) {
    console.log(`✓ ${result.message}`);
  } else {
    console.error(`✗ ${result.message}`);
    process.exit(1);
  }
  console.log("\n==============================\n");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

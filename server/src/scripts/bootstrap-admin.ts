/**
 * System Admin Bootstrap Script
 *
 * Creates or promotes a user to system administrator status.
 * This is separate from organization-level OWNER/ADMIN roles.
 *
 * Usage:
 *   INITIAL_SYSTEM_ADMIN_EMAIL="admin@example.com" npx tsx src/scripts/bootstrap-admin.ts
 *
 * Or with optional password for new user creation:
 *   INITIAL_SYSTEM_ADMIN_EMAIL="admin@example.com" \
 *   INITIAL_SYSTEM_ADMIN_PASSWORD="SecurePassword123!" \
 *   npx tsx src/scripts/bootstrap-admin.ts
 *
 * What this script does:
 * 1. If user exists: Promotes to system admin (sets isSuperAdmin = true)
 * 2. If user doesn't exist: Creates new user with system admin privileges
 * 3. Creates personal organization "{email}-personal" if not exists
 * 4. Logs the bootstrap action to audit log
 * 5. Marks first-time setup complete (skips the /setup wizard)
 */
import "dotenv/config";
import { getPrisma } from "../db.js";
import bcrypt from "bcryptjs";
import { pathToFileURL } from "node:url";

interface BootstrapResult {
  success: boolean;
  action: "created" | "promoted" | "already_admin" | "skipped" | "error";
  userId?: string;
  email?: string;
  message: string;
}

async function generatePersonalOrgSlug(email: string): Promise<string> {
  // Extract username from email and create slug
  const username = email.split("@")[0];
  // Sanitize: lowercase, replace non-alphanumeric with dash
  const slug = username.toLowerCase().replace(/[^a-z0-9]/g, "-");
  return `${slug}-personal`;
}

/** Placeholder passwords shipped in example env files and old compose defaults. */
const PLACEHOLDER_PASSWORDS = new Set([
  "ChangeMe123x",
  "CHANGE_THIS_STRONG_PASSWORD",
  "SecurePassword123!",
]);
const MIN_PASSWORD_LENGTH = 12;

export async function bootstrapSystemAdmin(): Promise<BootstrapResult> {
  const email = process.env.INITIAL_SYSTEM_ADMIN_EMAIL;
  const password = process.env.INITIAL_SYSTEM_ADMIN_PASSWORD;

  if (!email) {
    return {
      success: false,
      action: "error",
      message: "INITIAL_SYSTEM_ADMIN_EMAIL environment variable is required",
    };
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return {
      success: false,
      action: "error",
      message: `Invalid email format: ${email}`,
    };
  }

  const prisma = await getPrisma();

  // Bootstrap is for a first-time install. Once any system admin exists, an
  // env-driven run must not mint or promote another one: the variables may be
  // stale defaults, and promoting by email would hand super-admin to whoever
  // registered that address on a public instance.
  if (process.env.BOOTSTRAP_ADMIN_FORCE !== "1") {
    const existingAdmins = await prisma.user.count({
      where: { isSuperAdmin: true },
    });
    if (existingAdmins > 0) {
      return {
        success: true,
        action: "skipped",
        message:
          "A system administrator already exists; bootstrap skipped (set BOOTSTRAP_ADMIN_FORCE=1 to override)",
      };
    }
  }

  try {
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true, isSuperAdmin: true, name: true },
    });

    if (existingUser) {
      // User exists - check if already admin
      if (existingUser.isSuperAdmin) {
        return {
          success: true,
          action: "already_admin",
          userId: existingUser.id,
          email,
          message: `User ${email} is already a system administrator`,
        };
      }

      // Promote existing user to system admin
      await prisma.user.update({
        where: { id: existingUser.id },
        data: { isSuperAdmin: true },
      });

      // Log the promotion
      await prisma.auditLog.create({
        data: {
          action: "UPDATE",
          resourceType: "USER",
          resourceId: existingUser.id,
          resourceName: existingUser.name || email,
          changes: JSON.stringify({
            isSuperAdmin: { old: false, new: true },
          }),
          metadata: JSON.stringify({
            source: "bootstrap-admin-script",
            promotedAt: new Date().toISOString(),
          }),
          userId: existingUser.id,
          userEmail: email,
        },
      });

      return {
        success: true,
        action: "promoted",
        userId: existingUser.id,
        email,
        message: `User ${email} has been promoted to system administrator`,
      };
    }

    // User doesn't exist - create new user
    if (!password) {
      return {
        success: false,
        action: "error",
        message:
          "INITIAL_SYSTEM_ADMIN_PASSWORD is required when creating a new admin user",
      };
    }

    // Validate password strength
    if (PLACEHOLDER_PASSWORDS.has(password)) {
      return {
        success: false,
        action: "error",
        message:
          "INITIAL_SYSTEM_ADMIN_PASSWORD is a published placeholder; set a real password",
      };
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      return {
        success: false,
        action: "error",
        message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters long`,
      };
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Generate personal organization slug
    const orgSlug = await generatePersonalOrgSlug(email);

    // Create user with system admin privileges and personal org
    const result = await prisma.$transaction(async (tx) => {
      // Create user
      const user = await tx.user.create({
        data: {
          email,
          name: email.split("@")[0], // Use email username as name
          passwordHash,
          isSuperAdmin: true,
          emailVerified: new Date(), // Auto-verify system admin
        },
      });

      // Check if personal org slug already exists
      const existingOrg = await tx.organization.findUnique({
        where: { slug: orgSlug },
      });

      let orgId: string;

      if (!existingOrg) {
        // Create personal organization
        const org = await tx.organization.create({
          data: {
            name: `${email.split("@")[0]}'s Organization`,
            slug: orgSlug,
          },
        });
        orgId = org.id;

        // Add user as owner of personal org
        await tx.membership.create({
          data: {
            userId: user.id,
            organizationId: org.id,
            role: "OWNER",
          },
        });
      } else {
        // Org exists - just add membership if not already member
        orgId = existingOrg.id;
        // nosemgrep: tf-membership-query-missing-status -- bootstrap script: any existing row blocks a duplicate
        const existingMembership = await tx.membership.findUnique({
          where: {
            userId_organizationId: {
              userId: user.id,
              organizationId: existingOrg.id,
            },
          },
        });

        if (!existingMembership) {
          await tx.membership.create({
            data: {
              userId: user.id,
              organizationId: existingOrg.id,
              role: "OWNER",
            },
          });
        }
      }

      // Log the creation
      await tx.auditLog.create({
        data: {
          action: "CREATE",
          resourceType: "USER",
          resourceId: user.id,
          resourceName: user.name,
          changes: JSON.stringify({
            email: { old: null, new: email },
            isSuperAdmin: { old: null, new: true },
          }),
          metadata: JSON.stringify({
            source: "bootstrap-admin-script",
            createdAt: new Date().toISOString(),
            personalOrgId: orgId,
          }),
          userId: user.id,
          userEmail: email,
        },
      });

      return user;
    });

    return {
      success: true,
      action: "created",
      userId: result.id,
      email,
      message: `System administrator ${email} has been created with personal organization`,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return {
      success: false,
      action: "error",
      email,
      message: `Failed to bootstrap system admin: ${errorMessage}`,
    };
  }
}

/**
 * An admin supplied through INITIAL_SYSTEM_ADMIN_* is the instance's first-time
 * setup: mark it complete so visitors land on /login, not the setup wizard
 * (which would let the first visitor create a second super admin). Does not
 * touch an instance whose setup was already completed.
 */
async function markSetupComplete(userId: string): Promise<void> {
  const prisma = await getPrisma();
  const settings = await prisma.systemSettings.findUnique({
    where: { id: "default" },
    select: { setupComplete: true },
  });
  if (settings?.setupComplete) return;
  const data = {
    setupComplete: true,
    setupCompletedAt: new Date(),
    setupCompletedById: userId,
  };
  await prisma.systemSettings.upsert({
    where: { id: "default" },
    create: { id: "default", ...data },
    update: data,
  });
}

// Run script
async function main() {
  console.log("\n=== System Admin Bootstrap Script ===\n");

  const result = await bootstrapSystemAdmin();

  if (result.success) {
    console.log(`✓ ${result.message}`);
    if (result.userId) {
      console.log(`  User ID: ${result.userId}`);
      await markSetupComplete(result.userId);
      console.log("  Setup marked complete");
    }
    console.log(`  Action: ${result.action}`);
  } else {
    console.error(`✗ ${result.message}`);
    process.exit(1);
  }

  console.log("\n=====================================\n");
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}

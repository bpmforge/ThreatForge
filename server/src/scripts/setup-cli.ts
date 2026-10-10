/**
 * CLI Setup Script for Headless Installation
 *
 * Allows complete system setup without browser access.
 * Useful for automated deployments, Docker containers, and CI/CD.
 *
 * Usage:
 *   npx tsx src/scripts/setup-cli.ts \
 *     --admin-email admin@example.com \
 *     --admin-password "SecurePass123!" \
 *     --admin-name "Admin User" \
 *     --org-name "My Company" \
 *     --org-slug my-company
 *
 * Options:
 *   --admin-email      Super admin email (required)
 *   --admin-password   Super admin password (required)
 *   --admin-name       Super admin display name (default: email username)
 *   --org-name         Organization name (required)
 *   --org-slug         Organization slug (required)
 *   --check            Check current setup status and exit
 *   --json             Output result as JSON (for CI/CD)
 *   --help             Show this help message
 *
 * Exit codes:
 *   0 = Success
 *   1 = Already setup
 *   2 = Validation error
 *   3 = Database error
 */
import "dotenv/config";
import { getPrisma } from "../db.js";
import bcrypt from "bcryptjs";
import { validatePassword } from "../services/password-validation.js";

// Result types
interface SetupResult {
  success: boolean;
  code: 0 | 1 | 2 | 3;
  message: string;
  user?: { id: string; email: string; name: string };
  organization?: { id: string; name: string; slug: string };
}

interface StatusResult {
  setupComplete: boolean;
  hasUsers: boolean;
  hasSuperAdmin: boolean;
}

// Parse CLI arguments
function parseArgs(): Record<string, string | boolean> {
  const args: Record<string, string | boolean> = {};
  const argv = process.argv.slice(2);

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith("--")) {
        args[key] = next;
        i++;
      } else {
        args[key] = true;
      }
    }
  }

  return args;
}

// Validate email format
function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Validate organization slug
function validateSlug(slug: string): boolean {
  const slugRegex = /^[a-z0-9]+(-[a-z0-9]+)*$/;
  return slugRegex.test(slug) && slug.length >= 2 && slug.length <= 50;
}

// Check current setup status
async function checkStatus(): Promise<StatusResult> {
  const prisma = await getPrisma();

  const [settings, userCount, superAdminCount] = await Promise.all([
    prisma.systemSettings.findUnique({
      where: { id: "default" },
      select: { setupComplete: true },
    }),
    prisma.user.count(),
    prisma.user.count({ where: { isSuperAdmin: true } }),
  ]);

  return {
    setupComplete: settings?.setupComplete ?? false,
    hasUsers: userCount > 0,
    hasSuperAdmin: superAdminCount > 0,
  };
}

// Run the setup
async function runSetup(
  args: Record<string, string | boolean>,
): Promise<SetupResult> {
  const adminEmail = args["admin-email"] as string;
  const adminPassword = args["admin-password"] as string;
  const adminName = (args["admin-name"] as string) || adminEmail?.split("@")[0];
  const orgName = args["org-name"] as string;
  const orgSlug = args["org-slug"] as string;

  // Validate required arguments
  if (!adminEmail || !adminPassword || !orgName || !orgSlug) {
    return {
      success: false,
      code: 2,
      message: "Missing required arguments. Use --help for usage.",
    };
  }

  // Validate email
  if (!validateEmail(adminEmail)) {
    return {
      success: false,
      code: 2,
      message: "Invalid email format",
    };
  }

  // Validate password
  const passwordValidation = await validatePassword(adminPassword);
  if (!passwordValidation.valid) {
    return {
      success: false,
      code: 2,
      message: `Invalid password: ${passwordValidation.errors.join(". ")}`,
    };
  }

  // Validate name
  if (!adminName || adminName.length < 2) {
    return {
      success: false,
      code: 2,
      message: "Admin name must be at least 2 characters",
    };
  }

  // Validate org name
  if (!orgName || orgName.length < 2) {
    return {
      success: false,
      code: 2,
      message: "Organization name must be at least 2 characters",
    };
  }

  // Validate slug
  if (!validateSlug(orgSlug)) {
    return {
      success: false,
      code: 2,
      message:
        "Slug must be lowercase, contain only letters, numbers, and hyphens, and be 2-50 characters",
    };
  }

  try {
    const prisma = await getPrisma();

    // Check if setup is already complete
    const settings = await prisma.systemSettings.findUnique({
      where: { id: "default" },
      select: { setupComplete: true },
    });

    if (settings?.setupComplete) {
      return {
        success: false,
        code: 1,
        message: "Setup already complete. System has been initialized.",
      };
    }

    // Check if super admin exists
    const existingSuperAdmin = await prisma.user.findFirst({
      where: { isSuperAdmin: true },
    });

    if (existingSuperAdmin) {
      return {
        success: false,
        code: 1,
        message: "Super admin already exists.",
      };
    }

    // Check for email conflict
    const existingUser = await prisma.user.findUnique({
      where: { email: adminEmail },
    });

    if (existingUser) {
      return {
        success: false,
        code: 2,
        message: `User with email ${adminEmail} already exists`,
      };
    }

    // Check for slug conflict
    const existingOrg = await prisma.organization.findUnique({
      where: { slug: orgSlug },
    });

    if (existingOrg) {
      return {
        success: false,
        code: 2,
        message: `Organization with slug "${orgSlug}" already exists`,
      };
    }

    // Hash password
    const passwordHash = await bcrypt.hash(adminPassword, 12);

    // Create everything in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create super admin
      const user = await tx.user.create({
        data: {
          email: adminEmail,
          name: adminName,
          passwordHash,
          isSuperAdmin: true,
          emailVerified: new Date(),
        },
      });

      // Create organization
      const org = await tx.organization.create({
        data: {
          name: orgName,
          slug: orgSlug,
        },
      });

      // Create membership
      await tx.membership.create({
        data: {
          userId: user.id,
          organizationId: org.id,
          role: "OWNER",
        },
      });

      // Update system settings
      await tx.systemSettings.upsert({
        where: { id: "default" },
        create: {
          id: "default",
          setupComplete: true,
          setupCompletedAt: new Date(),
          setupCompletedById: user.id,
        },
        update: {
          setupComplete: true,
          setupCompletedAt: new Date(),
          setupCompletedById: user.id,
        },
      });

      // Create audit log
      await tx.auditLog.create({
        data: {
          action: "CREATE",
          resourceType: "SYSTEM_SETTINGS",
          resourceId: "default",
          resourceName: "System Setup",
          userId: user.id,
          userEmail: user.email,
          organizationId: org.id,
          metadata: JSON.stringify({
            source: "setup-cli",
            action: "initial_setup",
          }),
        },
      });

      return { user, org };
    });

    return {
      success: true,
      code: 0,
      message: "Setup completed successfully",
      user: {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name || adminName,
      },
      organization: {
        id: result.org.id,
        name: result.org.name,
        slug: result.org.slug,
      },
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return {
      success: false,
      code: 3,
      message: `Database error: ${errorMessage}`,
    };
  }
}

// Show help
function showHelp(): void {
  console.log(`
ThreatForge - CLI Setup Script

Usage:
  npx tsx src/scripts/setup-cli.ts [options]

Required Options:
  --admin-email      Super admin email address
  --admin-password   Super admin password (min 8 chars, must include uppercase, lowercase, number)
  --org-name         Organization name
  --org-slug         Organization URL slug (lowercase, alphanumeric, hyphens)

Optional:
  --admin-name       Super admin display name (default: email username)
  --check            Check current setup status and exit
  --json             Output as JSON (for CI/CD integration)
  --help             Show this help message

Examples:
  # Basic setup
  npx tsx src/scripts/setup-cli.ts \\
    --admin-email admin@company.com \\
    --admin-password "SecurePass123!" \\
    --org-name "Acme Corp" \\
    --org-slug acme-corp

  # Check status
  npx tsx src/scripts/setup-cli.ts --check

  # JSON output for CI/CD
  npx tsx src/scripts/setup-cli.ts \\
    --admin-email admin@company.com \\
    --admin-password "SecurePass123!" \\
    --org-name "Acme Corp" \\
    --org-slug acme-corp \\
    --json

Exit Codes:
  0 = Success
  1 = Already setup
  2 = Validation error
  3 = Database error
`);
}

// Main
async function main(): Promise<void> {
  const args = parseArgs();

  // Show help
  if (args.help) {
    showHelp();
    process.exit(0);
  }

  const jsonOutput = args.json === true;

  // Check status mode
  if (args.check) {
    try {
      const status = await checkStatus();
      if (jsonOutput) {
        console.log(JSON.stringify(status, null, 2));
      } else {
        console.log("\n=== Setup Status ===\n");
        console.log(`Setup Complete:   ${status.setupComplete ? "Yes" : "No"}`);
        console.log(`Has Users:        ${status.hasUsers ? "Yes" : "No"}`);
        console.log(`Has Super Admin:  ${status.hasSuperAdmin ? "Yes" : "No"}`);
        console.log("");
      }
      process.exit(status.setupComplete ? 0 : 1);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      if (jsonOutput) {
        console.log(JSON.stringify({ error: message }, null, 2));
      } else {
        console.error(`Error checking status: ${message}`);
      }
      process.exit(3);
    }
  }

  // Run setup
  const result = await runSetup(args);

  if (jsonOutput) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    if (result.success) {
      console.log("\n=== Setup Complete ===\n");
      console.log(`✓ ${result.message}`);
      if (result.user) {
        console.log(
          `  User:         ${result.user.email} (${result.user.name})`,
        );
        console.log(`  User ID:      ${result.user.id}`);
      }
      if (result.organization) {
        console.log(`  Organization: ${result.organization.name}`);
        console.log(`  Slug:         ${result.organization.slug}`);
        console.log(`  Org ID:       ${result.organization.id}`);
      }
      console.log("\n======================\n");
    } else {
      console.error(`\n✗ ${result.message}\n`);
    }
  }

  process.exit(result.code);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(3);
});

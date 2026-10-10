/**
 * User Registration API
 *
 * Creates a new user with:
 * - Unique username generated from email/name
 * - Personal organization (PERSONAL type, isPersonal=true)
 * - OWNER membership in the personal org
 * - Email verification token
 */
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { getPrisma } from "@/lib/prisma";
import { generateUsername, generatePersonalOrgSlug } from "@/lib/username";
import { internalBackendUrl } from "@/lib/backend-url";
import { clientIpHeaders } from "@/lib/client-ip";
import type { Prisma } from "@prisma/client";

/**
 * Stored form of a fresh email verification token (`sha256:<hex>`, matching
 * hashVerificationToken in server/src/api/auth-public/shared.ts). The
 * plaintext is never kept: the email itself comes from the backend's
 * resend-verification call below, which issues its own token.
 */
function newHashedVerificationToken(): string {
  const token = crypto.randomBytes(32).toString("hex");
  return "sha256:" + crypto.createHash("sha256").update(token).digest("hex");
}
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface RegistrationSettings {
  passwordMinLength: number;
  passwordRequireUppercase: boolean;
  passwordRequireLowercase: boolean;
  passwordRequireNumbers: boolean;
  passwordRequireSpecialChars: boolean;
}

/**
 * Checks the password against the admin-configured policy, the same rules
 * the backend applies in server/src/services/password-validation.ts.
 */
function passwordPolicyError(
  password: string,
  policy: RegistrationSettings,
): string | null {
  if (password.length < policy.passwordMinLength) {
    return `Password must be at least ${policy.passwordMinLength} characters`;
  }
  if (policy.passwordRequireUppercase && !/[A-Z]/.test(password)) {
    return "Password must contain at least one uppercase letter";
  }
  if (policy.passwordRequireLowercase && !/[a-z]/.test(password)) {
    return "Password must contain at least one lowercase letter";
  }
  if (policy.passwordRequireNumbers && !/[0-9]/.test(password)) {
    return "Password must contain at least one number";
  }
  if (
    policy.passwordRequireSpecialChars &&
    !/[!@#$%^&*()_+=\-[\]{};':"\\|,.<>/?`~]/.test(password)
  ) {
    return "Password must contain at least one special character";
  }
  return null;
}

const DEFAULT_SETTINGS = {
  allowSignups: true,
  emailProvider: null as string | null,
  requireEmailVerification: true,
  passwordMinLength: 12,
  passwordRequireUppercase: true,
  passwordRequireLowercase: true,
  passwordRequireNumbers: true,
  passwordRequireSpecialChars: false,
};

export async function POST(request: NextRequest) {
  try {
    const prisma = await getPrisma();
    const body = await request.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const email =
      typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: "Name, email, and password are required" },
        { status: 400 },
      );
    }
    if (!EMAIL_REGEX.test(email)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 },
      );
    }

    const settings =
      (await prisma.systemSettings.findUnique({
        where: { id: "default" },
        select: {
          allowSignups: true,
          emailProvider: true,
          requireEmailVerification: true,
          passwordMinLength: true,
          passwordRequireUppercase: true,
          passwordRequireLowercase: true,
          passwordRequireNumbers: true,
          passwordRequireSpecialChars: true,
        },
      })) ?? DEFAULT_SETTINGS;

    if (!settings.allowSignups) {
      return NextResponse.json(
        { error: "Sign-ups are disabled. Ask an administrator for an invite." },
        { status: 403 },
      );
    }

    const policyError = passwordPolicyError(password, settings);
    if (policyError) {
      return NextResponse.json({ error: policyError }, { status: 400 });
    }

    // Verification is only possible when an email provider is configured.
    const emailConfigured =
      !!settings.emailProvider && settings.emailProvider !== "none";
    const requireVerification =
      emailConfigured && settings.requireEmailVerification;
    const successBody = {
      requiresVerification: requireVerification,
      message: requireVerification
        ? "Please check your email to verify your account."
        : "Registration successful! You can now log in.",
    };

    // An existing address gets the same answer as a new one, so the form
    // cannot be used to discover who has an account.
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return NextResponse.json(successBody);
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Only generate verification token if email verification is required
    const verificationToken = requireVerification
      ? newHashedVerificationToken()
      : null;
    const verificationTokenExpiry = requireVerification
      ? new Date(Date.now() + 24 * 60 * 60 * 1000)
      : null;

    // Generate unique username from email and name
    const username = await generateUsername(email, name);
    const personalOrgSlug = generatePersonalOrgSlug(username);

    // Create user with personal organization in a transaction
    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Create user with verification token and new fields
      // Without an email provider the account is active but the address
      // stays unverified, so it cannot claim invitations for that address.
      const newUser = await tx.user.create({
        data: {
          name,
          email,
          username,
          passwordHash,
          status: requireVerification ? "PENDING_VERIFICATION" : "ACTIVE",
          emailVerified: null,
          verificationToken,
          verificationTokenExpiry,
        },
      });

      // Create personal organization with proper type
      const org = await tx.organization.create({
        data: {
          name: `${name}'s Workspace`,
          slug: personalOrgSlug,
          type: "PERSONAL",
          isPersonal: true,
          ownerId: newUser.id,
        },
      });

      // Add user as owner of their personal organization
      await tx.membership.create({
        data: {
          userId: newUser.id,
          organizationId: org.id,
          role: "OWNER",
          status: "ACTIVE",
          acceptedAt: new Date(),
        },
      });

      // Set the personal org as user's default organization
      await tx.user.update({
        where: { id: newUser.id },
        data: { defaultOrganizationId: org.id },
      });

      // Create audit log entry
      await tx.auditLog.create({
        data: {
          scope: "SYSTEM",
          action: "CREATE",
          resourceType: "USER",
          resourceId: newUser.id,
          resourceName: email,
          userId: newUser.id,
          userEmail: email,
          organizationId: org.id,
          metadata: JSON.stringify({
            source: "registration",
            username,
            personalOrgSlug,
          }),
        },
      });

      return newUser;
    });

    // Only send verification email if required
    if (requireVerification) {
      try {
        await fetch(`${internalBackendUrl()}/api/auth/resend-verification`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...clientIpHeaders((name) => request.headers.get(name)),
          },
          body: JSON.stringify({ email }),
        });
      } catch (emailError) {
        // Log but don't fail registration if email fails
        console.warn("Failed to send verification email:", emailError);
      }
    }

    return NextResponse.json(successBody);
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json({ error: "Registration failed" }, { status: 500 });
  }
}

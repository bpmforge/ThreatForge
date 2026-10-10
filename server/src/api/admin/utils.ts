/**
 * Admin API shared utilities and types.
 */
import { getPrisma } from "../../db.js";
import type { MemberRole } from "@prisma/client";
import { routeAuthz } from "../../middleware/authz-policy.js";

export { getAuthUser } from "../../utils/auth-helpers.js";

/** Route options for super-admin-only routes. */
export const SUPER_ADMIN = routeAuthz("superAdmin");

/** Check if user is a super admin (system-wide admin) */
export async function isSuperAdmin(userId: string): Promise<boolean> {
  const prisma = await getPrisma();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isSuperAdmin: true },
  });
  return user?.isSuperAdmin ?? false;
}

/** Check if demoting a user would leave zero system admins */
export async function canDemoteSystemAdmin(
  userIdToDemote: string,
): Promise<{ allowed: boolean; reason?: string }> {
  const prisma = await getPrisma();

  const systemAdminCount = await prisma.user.count({
    where: { isSuperAdmin: true },
  });

  if (systemAdminCount <= 1) {
    const user = await prisma.user.findUnique({
      where: { id: userIdToDemote },
      select: { isSuperAdmin: true },
    });

    if (user?.isSuperAdmin) {
      return {
        allowed: false,
        reason:
          "Cannot demote the last system administrator. At least one system admin must exist.",
      };
    }
  }

  return { allowed: true };
}

/** System settings input type */
export interface SystemSettingsInput {
  allowSignups?: boolean;
  requireEmailVerification?: boolean;
  defaultUserRole?: MemberRole;
  sessionTimeoutHours?: number;
  maxLoginAttempts?: number;
  lockoutDurationMinutes?: number;
  passwordMinLength?: number;
  passwordRequireUppercase?: boolean;
  passwordRequireLowercase?: boolean;
  passwordRequireNumbers?: boolean;
  passwordRequireSpecialChars?: boolean;
  mfaRequired?: boolean;
  maxProjectsPerOrg?: number;
  enableAI?: boolean;
  aiProvider?: string;
  auditRetentionDays?: number;
  samlEnabled?: boolean;
  samlJacksonUrl?: string;
  samlProductId?: string;
  ipAllowlistEnabled?: boolean;
  ipAllowlist?: string[];
  aiPrivateHostAllowlist?: string[];
  aiAllowAllPrivateHosts?: boolean;
  /** New NVD API key; "" or null removes the stored one. Omit to keep it. */
  nvdApiKey?: string | null;
  emailProvider?: string;
  emailFrom?: string;
  emailConfig?: Record<string, unknown>;
}

/** Email provider type */
type EmailProvider = "none" | "smtp" | "sendgrid" | "resend" | "ses";

/** Email config input type */
export interface EmailConfigInput {
  provider: EmailProvider;
  from: string;
  config: Record<string, unknown>;
}

/**
 * Extend NextAuth types to include custom user properties
 *
 * Key distinction:
 * - isSystemAdmin: Platform-wide system administrator (can access /admin console)
 * - memberships: User's organization memberships with roles (OWNER, ADMIN, EDITOR, VIEWER)
 *
 * The old 'isAdmin' field has been removed to prevent confusion between
 * system admins and organization admins.
 */
import { DefaultSession } from "next-auth";
import { JWT as DefaultJWT } from "next-auth/jwt";

/** Organization membership info stored in JWT */
interface JWTMembership {
  orgId: string;
  orgSlug: string;
  orgName: string;
  role: "OWNER" | "ADMIN" | "EDITOR" | "VIEWER";
}

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      /** True only for platform-wide system administrators */
      isSystemAdmin?: boolean;
      /** True if MFA is required but user hasn't set it up yet */
      requiresMfaSetup?: boolean;
      /** User's organization memberships */
      memberships?: JWTMembership[];
    } & DefaultSession["user"];
  }

  interface User {
    id: string;
    isSystemAdmin?: boolean;
    requiresMfaSetup?: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    id?: string;
    /** True only for platform-wide system administrators */
    isSystemAdmin?: boolean;
    /** True if MFA is required but user hasn't set it up yet */
    requiresMfaSetup?: boolean;
    /** User's organization memberships */
    memberships?: JWTMembership[];
  }
}

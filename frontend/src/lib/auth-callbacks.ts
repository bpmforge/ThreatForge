import { getPrisma } from "./prisma";

async function getSessionTimeoutHours(): Promise<number> {
  try {
    const prisma = await getPrisma();
    const settings = await prisma.systemSettings.findFirst({
      where: { id: "default" },
      select: { sessionTimeoutHours: true },
    });
    return settings?.sessionTimeoutHours ?? 24;
  } catch {
    return 24;
  }
}

/**
 * True when the token predates the user's last password reset or "sign out
 * everywhere" (the later of the two). Whole-second
 * comparison so a login in the same second as the reset still works.
 * Mirrors issuedBeforePasswordChange in server/src/middleware/auth.ts.
 */
async function issuedBeforePasswordChange(
  userId: string,
  iat: number,
): Promise<boolean> {
  const prisma = await getPrisma();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { passwordChangedAt: true, sessionsRevokedAt: true },
  });
  const cutoff = Math.max(
    user?.passwordChangedAt?.getTime() ?? 0,
    user?.sessionsRevokedAt?.getTime() ?? 0,
  );
  if (!cutoff) return false;
  return iat < Math.floor(cutoff / 1000);
}

async function loadUserData(userId: string) {
  const prisma = await getPrisma();

  const dbUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { isSuperAdmin: true, twoFactorEnabled: true },
  });

  const settings = await prisma.systemSettings.findFirst({
    where: { id: "default" },
    select: { mfaRequired: true },
  });

  const memberships = await prisma.membership.findMany({
    where: { userId },
    include: {
      organization: { select: { id: true, slug: true, name: true } },
    },
  });

  return {
    isSystemAdmin: dbUser?.isSuperAdmin === true,
    requiresMfaSetup:
      (settings?.mfaRequired ?? false) && !dbUser?.twoFactorEnabled,
    memberships: memberships.map((m) => ({
      orgId: m.organization.id,
      orgSlug: m.organization.slug,
      orgName: m.organization.name,
      role: m.role as "OWNER" | "ADMIN" | "EDITOR" | "VIEWER",
    })),
  };
}

/** True when the OAuth/SAML account is already linked to a local user. */
async function hasLinkedAccount(account: {
  provider: string;
  providerAccountId?: string;
}): Promise<boolean> {
  if (!account.providerAccountId) return false;
  const prisma = await getPrisma();
  const linked = await prisma.account.findUnique({
    where: {
      provider_providerAccountId: {
        provider: account.provider,
        providerAccountId: account.providerAccountId,
      },
    },
    select: { id: true },
  });
  return linked !== null;
}

/** Microsoft's `common`-style tenants let any directory assert any email. */
function entraTenantIsSpecific(): boolean {
  const tenant = process.env.MICROSOFT_TENANT_ID;
  return !!tenant && !["common", "organizations", "consumers"].includes(tenant);
}

/** GitHub: the profile email must be the primary, verified address. */
async function githubEmailVerified(
  email: string,
  accessToken: string,
): Promise<boolean> {
  try {
    const res = await fetch("https://api.github.com/user/emails", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "User-Agent": "threatforge",
      },
    });
    if (!res.ok) return false;
    const emails = (await res.json()) as {
      email: string;
      primary: boolean;
      verified: boolean;
    }[];
    return emails.some(
      (e) =>
        e.primary &&
        e.verified &&
        e.email.toLowerCase() === email.toLowerCase(),
    );
  } catch {
    return false;
  }
}

/** Whether the provider vouches that the profile email belongs to the user. */
export async function providerAssertsVerifiedEmail(
  account: { provider: string; access_token?: string },
  profile: Record<string, unknown> | undefined,
): Promise<boolean> {
  const email = typeof profile?.email === "string" ? profile.email : "";
  if (!email) return false;
  switch (account.provider) {
    case "google":
      return profile?.email_verified === true;
    case "apple":
      return (
        profile?.email_verified === true || profile?.email_verified === "true"
      );
    case "github":
      return account.access_token
        ? githubEmailVerified(email, account.access_token)
        : false;
    case "microsoft-entra-id":
      return entraTenantIsSpecific();
    default:
      // SAML and anything else: no email assertion we can rely on
      return false;
  }
}

/**
 * Auth.js always creates OAuth users with emailVerified null; set it here
 * once the provider has vouched for the address.
 */
export const authEvents = {
  async signIn({
    user,
    account,
    profile,
    isNewUser,
  }: {
    user: { id?: string };
    account: { provider: string; access_token?: string } | null;
    profile?: Record<string, unknown>;
    isNewUser?: boolean;
  }) {
    if (!isNewUser || !user?.id || !account) return;
    if (account.provider === "credentials") return;
    try {
      if (!(await providerAssertsVerifiedEmail(account, profile))) return;
      const prisma = await getPrisma();
      await prisma.user.update({
        where: { id: user.id },
        data: { emailVerified: new Date() },
      });
    } catch {
      console.error("Failed to record OAuth email verification");
    }
  },
};

export const authCallbacks = {
  async signIn({
    user,
    account,
  }: {
    user: { id?: string; email?: string | null };
    account: { provider: string; providerAccountId?: string } | null;
  }) {
    if (account?.provider === "credentials") return true;
    if (!account) return true;
    try {
      const prisma = await getPrisma();
      // Existing accounts keep signing in (including ones created by an
      // admin or SCIM before their first SSO login); new ones need sign-ups.
      const existing =
        (await hasLinkedAccount(account)) ||
        (!!user?.email &&
          (await prisma.user.findUnique({
            where: { email: user.email.toLowerCase() },
            select: { id: true },
          })) !== null);
      if (!existing) {
        const settings = await prisma.systemSettings.findFirst({
          where: { id: "default" },
          select: { allowSignups: true },
        });
        if (settings && !settings.allowSignups) return false;
      }
    } catch (error) {
      // Fail closed: cannot tell whether this is a new account
      console.error("Failed to check sign-up policy for OAuth login", error);
      return false;
    }
    if (!user?.id) return true;
    try {
      const prisma = await getPrisma();
      await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      });
    } catch {
      console.error("Failed to update lastLoginAt for OAuth login");
    }
    return true;
  },

  async redirect({ url, baseUrl }: { url: string; baseUrl: string }) {
    try {
      const parsedUrl = new URL(url, baseUrl);
      if (
        parsedUrl.pathname.startsWith("/login") ||
        parsedUrl.pathname.startsWith("/register")
      ) {
        return `${baseUrl}/dashboard`;
      }
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      if (parsedUrl.origin === baseUrl) return url;
    } catch {
      return `${baseUrl}/dashboard`;
    }
    return `${baseUrl}/dashboard`;
  },

  async jwt({
    token,
    user,
    trigger,
  }: {
    token: Record<string, unknown>;
    user?: { id?: string };
    trigger?: string;
  }) {
    if (token.iat) {
      const sessionTimeoutHours = await getSessionTimeoutHours();
      const tokenAge = Math.floor(Date.now() / 1000) - (token.iat as number);
      if (tokenAge > sessionTimeoutHours * 60 * 60) return {};

      // null (not {}) so Auth.js clears the cookie instead of re-issuing an
      // empty token with a fresh iat that would pass this check next time.
      if (
        token.id &&
        (await issuedBeforePasswordChange(
          token.id as string,
          token.iat as number,
        ))
      ) {
        return null;
      }
    }

    if (user) {
      token.id = user.id;
      const userData = await loadUserData(user.id as string);
      token.isSystemAdmin = userData.isSystemAdmin;
      token.requiresMfaSetup = userData.requiresMfaSetup;
      token.memberships = userData.memberships;
    }

    if (trigger === "update" && token.id) {
      const userData = await loadUserData(token.id as string);
      token.isSystemAdmin = userData.isSystemAdmin;
      token.requiresMfaSetup = userData.requiresMfaSetup;
      token.memberships = userData.memberships;
    }

    return token;
  },

  async session({
    session,
    token,
  }: {
    session: { user?: Record<string, unknown> };
    token: Record<string, unknown>;
  }) {
    if (session.user && token.id) {
      session.user.id = token.id as string;
      session.user.isSystemAdmin = token.isSystemAdmin;
      session.user.requiresMfaSetup = token.requiresMfaSetup;
      session.user.memberships = token.memberships;
    }
    return session;
  },
};

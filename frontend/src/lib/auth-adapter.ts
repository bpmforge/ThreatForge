import { PrismaAdapter } from "@auth/prisma-adapter";
import type {
  Adapter,
  AdapterUser,
  AdapterAccount,
  AdapterSession,
  VerificationToken,
} from "@auth/core/adapters";
import { getPrisma } from "./prisma";

async function getLazyAdapter() {
  const prisma = await getPrisma();
  return PrismaAdapter(prisma);
}

/**
 * Lazy Prisma adapter — defers client initialization until first use.
 * Each method delegates to PrismaAdapter with proper Auth.js adapter types.
 * `as unknown as T` is safe: Auth.js only reads fields it knows about.
 */
export function createLazyPrismaAdapter(): Adapter {
  return {
    async createUser(data: AdapterUser) {
      const adapter = await getLazyAdapter();
      return adapter.createUser!(data) as Promise<AdapterUser>;
    },
    async getUser(id: string) {
      const adapter = await getLazyAdapter();
      return adapter.getUser!(id) as Promise<AdapterUser | null>;
    },
    async getUserByEmail(email: string) {
      const adapter = await getLazyAdapter();
      return adapter.getUserByEmail!(email) as Promise<AdapterUser | null>;
    },
    async getUserByAccount(
      providerAccountId: Pick<AdapterAccount, "provider" | "providerAccountId">,
    ) {
      const adapter = await getLazyAdapter();
      return adapter.getUserByAccount!(
        providerAccountId,
      ) as Promise<AdapterUser | null>;
    },
    async updateUser(data: Partial<AdapterUser> & Pick<AdapterUser, "id">) {
      const adapter = await getLazyAdapter();
      return adapter.updateUser!(data) as Promise<AdapterUser>;
    },
    async deleteUser(userId: string) {
      const adapter = await getLazyAdapter();
      await adapter.deleteUser!(userId);
    },
    async linkAccount(data: AdapterAccount) {
      const adapter = await getLazyAdapter();
      return adapter.linkAccount!(data) as Promise<
        AdapterAccount | null | undefined
      >;
    },
    async unlinkAccount(
      providerAccountId: Pick<AdapterAccount, "provider" | "providerAccountId">,
    ) {
      const adapter = await getLazyAdapter();
      await adapter.unlinkAccount!(providerAccountId);
    },
    async createSession(data: {
      sessionToken: string;
      userId: string;
      expires: Date;
    }) {
      const adapter = await getLazyAdapter();
      return adapter.createSession!(data) as Promise<AdapterSession>;
    },
    async getSessionAndUser(sessionToken: string) {
      const adapter = await getLazyAdapter();
      return adapter.getSessionAndUser!(sessionToken) as Promise<{
        session: AdapterSession;
        user: AdapterUser;
      } | null>;
    },
    async updateSession(
      data: Partial<AdapterSession> & Pick<AdapterSession, "sessionToken">,
    ) {
      const adapter = await getLazyAdapter();
      return adapter.updateSession!(data) as Promise<
        AdapterSession | null | undefined
      >;
    },
    async deleteSession(sessionToken: string) {
      const adapter = await getLazyAdapter();
      await adapter.deleteSession!(sessionToken);
    },
    async createVerificationToken(data: VerificationToken) {
      const adapter = await getLazyAdapter();
      return adapter.createVerificationToken!(data) as Promise<
        VerificationToken | null | undefined
      >;
    },
    async useVerificationToken(params: { identifier: string; token: string }) {
      const adapter = await getLazyAdapter();
      return adapter.useVerificationToken!(
        params,
      ) as Promise<VerificationToken | null>;
    },
  };
}

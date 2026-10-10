/**
 * Auth.js (NextAuth v5) Configuration
 *
 * Supports: Credentials, GitHub, Google, Microsoft Entra ID, Apple, SAML SSO (BoxyHQ)
 */
import NextAuth, { type NextAuthConfig } from "next-auth";
import { createLazyPrismaAdapter } from "./auth-adapter";
import { getAuthProviders } from "./auth-providers";
import { authCallbacks, authEvents } from "./auth-callbacks";

export const { handlers, auth } = NextAuth({
  adapter: createLazyPrismaAdapter(),
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
    signOut: "/login",
    error: "/login",
    newUser: "/onboarding",
  },
  providers: getAuthProviders(),
  // NextAuth's CallbacksOptions generics are notoriously strict; the callbacks
  // are runtime-correct (and unit-covered), so annotate to the config's type.
  events: authEvents as unknown as NextAuthConfig["events"],
  callbacks: authCallbacks as unknown as NextAuthConfig["callbacks"],
});

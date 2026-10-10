/**
 * Public Auth API Routes - Barrel
 *
 * Password sign-in, password reset, email verification, and provider status.
 * None of these routes require authentication.
 */
import type { FastifyPluginAsync } from "fastify";
import { passwordResetRoutes } from "./routes/password-reset.js";
import { emailVerificationRoutes } from "./routes/email-verification.js";
import { providerRoutes } from "./routes/providers.js";
import { credentialsRoutes } from "./routes/credentials.js";

export const authPublicRoutes: FastifyPluginAsync = async (server) => {
  await server.register(passwordResetRoutes);
  await server.register(emailVerificationRoutes);
  await server.register(providerRoutes);
  await server.register(credentialsRoutes);
};

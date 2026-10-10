/**
 * Setup API routes for first-time application configuration.
 * These routes are PUBLIC and do not require authentication.
 *
 * They handle:
 * - Checking if setup is complete
 * - Creating the super admin and primary organization
 * - Completing the setup wizard
 */
import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import { randomBytes, timingSafeEqual } from "crypto";
import { getPrisma } from "../../db.js";
import { setupStatusRoutes } from "./routes/status.js";
import { setupInitializeRoutes } from "./routes/initialize.js";
import { setupTestAiRoutes } from "./routes/test-ai.js";

const IS_PRODUCTION = process.env.NODE_ENV === "production";

/**
 * Token a production install must present to run setup. Without SETUP_TOKEN
 * one is generated at startup and written to the server log, so whoever
 * reaches a fresh install first cannot claim it without access to the logs.
 */
const SETUP_TOKEN =
  process.env.SETUP_TOKEN ||
  (IS_PRODUCTION ? randomBytes(16).toString("hex") : undefined);

/** True when setup requests must carry the X-Setup-Token header. */
export const SETUP_TOKEN_REQUIRED = IS_PRODUCTION && !!SETUP_TOKEN;

/** Whether the request carries the setup token (always true outside production). */
export function hasValidSetupToken(request: FastifyRequest): boolean {
  if (!SETUP_TOKEN_REQUIRED || !SETUP_TOKEN) return true;
  const provided = Buffer.from(String(request.headers["x-setup-token"] ?? ""));
  const expected = Buffer.from(SETUP_TOKEN);
  return (
    provided.length === expected.length && timingSafeEqual(provided, expected)
  );
}

/** Validate email format */
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/** Validate organization slug */
export function validateSlug(slug: string): boolean {
  const slugRegex = /^[a-z0-9]+(-[a-z0-9]+)*$/;
  return slugRegex.test(slug) && slug.length >= 2 && slug.length <= 50;
}

/** Admin account creation request */
interface CreateAdminRequest {
  name: string;
  email: string;
  password: string;
}

/** Organization creation request */
interface CreateOrganizationRequest {
  name: string;
  slug: string;
}

/** AI configuration request */
export interface AIConfigRequest {
  enabled: boolean;
  provider:
    | "anthropic"
    | "openai"
    | "google"
    | "vertexai"
    | "ollama"
    | "lmstudio"
    | "none";
  apiKey?: string;
  baseUrl?: string;
  model?: string;
}

/** Auth configuration request */
interface AuthConfigRequest {
  allowSignups: boolean;
  requireEmailVerification: boolean;
  sessionTimeoutHours: number;
}

/** Security configuration request */
interface SecurityConfigRequest {
  sessionTimeoutHours: number;
  ipAllowlistEnabled: boolean;
  ipAllowlist?: string[];
  auditRetentionDays: number;
}

/** Complete setup request - all data from wizard */
export interface CompleteSetupRequest {
  admin: CreateAdminRequest;
  organization: CreateOrganizationRequest;
  ai?: AIConfigRequest;
  auth?: AuthConfigRequest;
  security?: SecurityConfigRequest;
}

export const setupRoutes: FastifyPluginAsync = async (server) => {
  if (SETUP_TOKEN_REQUIRED && !process.env.SETUP_TOKEN) {
    const prisma = await getPrisma();
    const settings = await prisma.systemSettings.findUnique({
      where: { id: "default" },
      select: { setupComplete: true },
    });
    if (!settings?.setupComplete) {
      server.log.warn(
        `Setup token: ${SETUP_TOKEN} (enter it on the last step of the setup wizard)`,
      );
    }
  }
  await server.register(setupStatusRoutes);
  await server.register(setupInitializeRoutes);
  await server.register(setupTestAiRoutes);
};

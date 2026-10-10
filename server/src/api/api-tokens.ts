/**
 * API Tokens API
 *
 * Endpoints for creating and managing personal API tokens.
 */
import type { FastifyPluginAsync } from "fastify";
import { getPrisma } from "../db.js";
import { randomBytes, createHash } from "crypto";
import { sendBadRequest, sendNotFound } from "../utils/api-response.js";
import { getAuthUser } from "../utils/auth-helpers.js";
import { routeAuthz } from "../middleware/authz-policy.js";

const AUTHENTICATED = routeAuthz("authenticated");

/** Generate a secure API token */
function generateApiToken(): { token: string; hash: string; prefix: string } {
  // Generate 32 bytes of random data
  const randomData = randomBytes(32);
  // Create token with prefix for easy identification
  const token = `ftm_${randomData.toString("base64url")}`;
  // Hash the token for storage
  const hash = createHash("sha256").update(token).digest("hex");
  // Store first 12 chars as prefix for identification
  const prefix = token.substring(0, 12);

  return { token, hash, prefix };
}

/** Available scopes for API tokens */
const AVAILABLE_SCOPES = [
  "read:models",
  "write:models",
  "read:threats",
  "write:threats",
  "read:projects",
  "write:projects",
  "read:organizations",
  "ci:read",
  "ci:write",
];

// Request types
interface CreateTokenBody {
  name: string;
  scopes: string[];
  expiresAt?: string; // ISO date string
}

interface UpdateTokenBody {
  name?: string;
  scopes?: string[];
  isActive?: boolean;
}

export const apiTokenRoutes: FastifyPluginAsync = async (server) => {
  // Get all API tokens for current user
  server.get(
    "/api/users/me/api-tokens",
    AUTHENTICATED,
    async (request, _reply) => {
      const authUser = getAuthUser(request);
      const prisma = await getPrisma();

      const tokens = await prisma.apiToken.findMany({
        where: { userId: authUser.id },
        select: {
          id: true,
          name: true,
          tokenPrefix: true,
          scopes: true,
          lastUsedAt: true,
          usageCount: true,
          expiresAt: true,
          isActive: true,
          createdAt: true,
          revokedAt: true,
        },
        orderBy: { createdAt: "desc" },
      });

      // Parse scopes from JSON string
      return tokens.map((token) => ({
        ...token,
        scopes: JSON.parse(token.scopes || "[]"),
      }));
    },
  );

  // Create a new API token
  server.post<{ Body: CreateTokenBody }>(
    "/api/users/me/api-tokens",
    AUTHENTICATED,
    async (request, reply) => {
      const authUser = getAuthUser(request);
      const prisma = await getPrisma();

      const { name, scopes, expiresAt } = request.body;

      // Validate name
      if (!name || name.trim().length === 0) {
        return sendBadRequest(reply, "Token name is required");
      }

      if (name.length > 100) {
        return sendBadRequest(
          reply,
          "Token name must be 100 characters or less",
        );
      }

      // Validate scopes
      if (!scopes || scopes.length === 0) {
        return sendBadRequest(reply, "At least one scope is required");
      }

      const invalidScopes = scopes.filter((s) => !AVAILABLE_SCOPES.includes(s));
      if (invalidScopes.length > 0) {
        return sendBadRequest(
          reply,
          `Invalid scopes: ${invalidScopes.join(", ")}`,
        );
      }

      // Validate expiration
      let parsedExpiresAt: Date | null = null;
      if (expiresAt) {
        parsedExpiresAt = new Date(expiresAt);
        if (isNaN(parsedExpiresAt.getTime())) {
          return sendBadRequest(reply, "Invalid expiration date");
        }
        if (parsedExpiresAt <= new Date()) {
          return sendBadRequest(reply, "Expiration date must be in the future");
        }
      }

      // Check user hasn't exceeded token limit
      const tokenCount = await prisma.apiToken.count({
        where: { userId: authUser.id, isActive: true },
      });

      if (tokenCount >= 10) {
        return sendBadRequest(reply, "Maximum of 10 active API tokens allowed");
      }

      // Generate token
      const { token, hash, prefix } = generateApiToken();

      // Create token record
      const apiToken = await prisma.apiToken.create({
        data: {
          userId: authUser.id,
          name: name.trim(),
          tokenHash: hash,
          tokenPrefix: prefix,
          scopes: JSON.stringify(scopes),
          expiresAt: parsedExpiresAt,
        },
        select: {
          id: true,
          name: true,
          tokenPrefix: true,
          scopes: true,
          expiresAt: true,
          createdAt: true,
        },
      });

      // Return the token only once - it can never be retrieved again
      return {
        ...apiToken,
        scopes: JSON.parse(apiToken.scopes || "[]"),
        token, // Only returned on creation
        message:
          "Save this token now. It will not be shown again for security reasons.",
      };
    },
  );

  // Get available scopes
  server.get("/api/users/me/api-tokens/scopes", AUTHENTICATED, async () => {
    return {
      scopes: AVAILABLE_SCOPES.map((scope) => ({
        value: scope,
        label: scope.replace(":", " ").replace(/\b\w/g, (l) => l.toUpperCase()),
        category: scope.split(":")[0],
      })),
    };
  });

  // Update a token (name, scopes, or deactivate)
  server.patch<{ Params: { tokenId: string }; Body: UpdateTokenBody }>(
    "/api/users/me/api-tokens/:tokenId",
    AUTHENTICATED,
    async (request, reply) => {
      const authUser = getAuthUser(request);
      const prisma = await getPrisma();
      const { tokenId } = request.params;
      const { name, scopes, isActive } = request.body;

      // Verify the token belongs to the user
      const existingToken = await prisma.apiToken.findFirst({
        where: {
          id: tokenId,
          userId: authUser.id,
        },
      });

      if (!existingToken) {
        return sendNotFound(reply, "Token");
      }

      // Validate updates
      const updates: Record<string, unknown> = {};

      if (name !== undefined) {
        if (name.trim().length === 0) {
          return sendBadRequest(reply, "Token name is required");
        }
        updates.name = name.trim();
      }

      if (scopes !== undefined) {
        if (scopes.length === 0) {
          return sendBadRequest(reply, "At least one scope is required");
        }
        const invalidScopes = scopes.filter(
          (s) => !AVAILABLE_SCOPES.includes(s),
        );
        if (invalidScopes.length > 0) {
          return sendBadRequest(
            reply,
            `Invalid scopes: ${invalidScopes.join(", ")}`,
          );
        }
        updates.scopes = JSON.stringify(scopes);
      }

      if (isActive !== undefined) {
        updates.isActive = isActive;
        if (!isActive) {
          updates.revokedAt = new Date();
          updates.revokedReason = "Deactivated by user";
        }
      }

      const updatedToken = await prisma.apiToken.update({
        where: { id: tokenId },
        data: updates,
        select: {
          id: true,
          name: true,
          tokenPrefix: true,
          scopes: true,
          lastUsedAt: true,
          usageCount: true,
          expiresAt: true,
          isActive: true,
          createdAt: true,
          revokedAt: true,
        },
      });

      return {
        ...updatedToken,
        scopes: JSON.parse(updatedToken.scopes || "[]"),
      };
    },
  );

  // Revoke/delete a token
  server.delete<{ Params: { tokenId: string } }>(
    "/api/users/me/api-tokens/:tokenId",
    AUTHENTICATED,
    async (request, reply) => {
      const authUser = getAuthUser(request);
      const prisma = await getPrisma();
      const { tokenId } = request.params;

      // Verify the token belongs to the user
      const token = await prisma.apiToken.findFirst({
        where: {
          id: tokenId,
          userId: authUser.id,
        },
      });

      if (!token) {
        return sendNotFound(reply, "Token");
      }

      // Permanently delete the token
      await prisma.apiToken.delete({
        where: { id: tokenId },
      });

      return { success: true, message: "Token deleted" };
    },
  );
};

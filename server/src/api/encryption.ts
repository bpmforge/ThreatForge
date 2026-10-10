/**
 * BYOK Encryption API Routes
 *
 * Provides endpoints for managing organization encryption keys.
 */
import type { FastifyPluginAsync } from "fastify";
import { isActiveOrgAdmin } from "../services/access-control/access-control-service.js";
import { getAuthUser } from "../utils/auth-helpers.js";
import {
  getBYOKConfig,
  registerBYOKKey,
  registerBYOKFromPassphrase,
  generateAndRegisterKey,
  rotateKey,
  revokeKey,
  disableBYOK,
  listKeys,
  verifyBYOKKey,
} from "../services/encryption/index.js";
import type { EncryptionAlgorithm } from "../types/encryption.js";
import {
  sendBadRequest,
  sendForbidden,
  sendNotFound,
} from "../utils/api-response.js";
import { routeAuthz } from "../middleware/authz-policy.js";

/** ACTIVE OWNER/ADMIN of the organization (suspended members get nothing). */
const canManageEncryption = isActiveOrgAdmin;

export const encryptionRoutes: FastifyPluginAsync = async (server) => {
  // ==========================================================================
  // BYOK Configuration
  // ==========================================================================

  /** Get BYOK configuration for an organization */
  server.get<{ Params: { orgId: string } }>(
    "/api/organizations/:orgId/encryption",
    routeAuthz({ org: "ADMIN" }),
    async (request, reply) => {
      const authUser = getAuthUser(request);
      const { orgId } = request.params;

      const canManage = await canManageEncryption(authUser.id, orgId);
      if (!canManage) {
        return sendForbidden(reply, "Insufficient permissions");
      }

      const config = await getBYOKConfig(orgId);

      // Don't expose key hashes to the client
      const safeConfig = {
        enabled: config.enabled,
        activeKeyVersion: config.activeKeyVersion,
        allowSystemKeyFallback: config.allowSystemKeyFallback,
        keys: config.keys.map((k) => ({
          id: k.id,
          version: k.version,
          algorithm: k.algorithm,
          isActive: k.isActive,
          createdAt: k.createdAt,
          expiresAt: k.expiresAt,
          description: k.description,
        })),
      };

      return safeConfig;
    },
  );

  /** Register a new BYOK key */
  server.post<{
    Params: { orgId: string };
    Body: {
      key?: string;
      passphrase?: string;
      description?: string;
      algorithm?: EncryptionAlgorithm;
      generateNew?: boolean;
    };
  }>(
    "/api/organizations/:orgId/encryption/keys",
    routeAuthz({ org: "ADMIN" }),
    async (request, reply) => {
      const authUser = getAuthUser(request);
      const { orgId } = request.params;
      const { key, passphrase, description, algorithm, generateNew } =
        request.body;

      const canManage = await canManageEncryption(authUser.id, orgId);
      if (!canManage) {
        return sendForbidden(reply, "Insufficient permissions");
      }

      // Option 1: Generate a new random key
      if (generateNew) {
        const result = await generateAndRegisterKey(orgId, description);
        if (!result.success) {
          return sendBadRequest(reply, result.error || "Operation failed");
        }

        // Return the key ONCE - customer must save it
        return {
          success: true,
          message:
            "Key generated successfully. Save this key securely - it will not be shown again.",
          key: result.key,
          metadata: {
            id: result.metadata?.id,
            version: result.metadata?.version,
            algorithm: result.metadata?.algorithm,
            createdAt: result.metadata?.createdAt,
            description: result.metadata?.description,
          },
        };
      }

      // Option 2: Register a key derived from passphrase
      if (passphrase) {
        const result = await registerBYOKFromPassphrase(
          orgId,
          passphrase,
          description,
        );
        if (!result.success) {
          return sendBadRequest(reply, result.error || "Operation failed");
        }

        return {
          success: true,
          message:
            "Key registered from passphrase. Save the salt for key recovery.",
          salt: result.salt,
          metadata: {
            id: result.metadata.id,
            version: result.metadata.version,
            algorithm: result.metadata.algorithm,
            createdAt: result.metadata.createdAt,
            description: result.metadata.description,
          },
        };
      }

      // Option 3: Register a customer-provided key
      if (key) {
        const result = await registerBYOKKey(
          orgId,
          key,
          description,
          algorithm,
        );
        if (!result.success) {
          return sendBadRequest(reply, result.error || "Operation failed");
        }

        return {
          success: true,
          message: "Customer key registered successfully.",
          metadata: {
            id: result.metadata.id,
            version: result.metadata.version,
            algorithm: result.metadata.algorithm,
            createdAt: result.metadata.createdAt,
            description: result.metadata.description,
          },
        };
      }

      return sendBadRequest(
        reply,
        "Must provide one of: key, passphrase, or generateNew: true",
      );
    },
  );

  /** Verify a key matches the registered key */
  server.post<{
    Params: { orgId: string };
    Body: { key: string; version?: number };
  }>(
    "/api/organizations/:orgId/encryption/verify",
    routeAuthz({ org: "ADMIN" }),
    async (request, reply) => {
      const authUser = getAuthUser(request);
      const { orgId } = request.params;
      const { key, version } = request.body;

      const canManage = await canManageEncryption(authUser.id, orgId);
      if (!canManage) {
        return sendForbidden(reply, "Insufficient permissions");
      }

      const isValid = await verifyBYOKKey(orgId, key, version);

      return { valid: isValid };
    },
  );

  /** Rotate to a new key */
  server.post<{
    Params: { orgId: string };
    Body: { key: string; description?: string };
  }>(
    "/api/organizations/:orgId/encryption/rotate",
    routeAuthz({ org: "ADMIN" }),
    async (request, reply) => {
      const authUser = getAuthUser(request);
      const { orgId } = request.params;
      const { key, description } = request.body;

      const canManage = await canManageEncryption(authUser.id, orgId);
      if (!canManage) {
        return sendForbidden(reply, "Insufficient permissions");
      }

      const result = await rotateKey(orgId, key, description);
      if (!result.success) {
        return sendBadRequest(reply, result.error || "Operation failed");
      }

      return {
        success: true,
        message: "Key rotated successfully.",
        newVersion: result.newVersion,
      };
    },
  );

  /** Revoke a specific key version */
  server.delete<{
    Params: { orgId: string; version: string };
  }>(
    "/api/organizations/:orgId/encryption/keys/:version",
    routeAuthz({ org: "ADMIN" }),
    async (request, reply) => {
      const authUser = getAuthUser(request);
      const { orgId, version } = request.params;

      const canManage = await canManageEncryption(authUser.id, orgId);
      if (!canManage) {
        return sendForbidden(reply, "Insufficient permissions");
      }

      const keyVersion = parseInt(version, 10);
      if (isNaN(keyVersion)) {
        return sendBadRequest(reply, "Invalid key version");
      }

      const success = await revokeKey(orgId, keyVersion);
      if (!success) {
        return sendNotFound(reply, "Key version");
      }

      return { success: true, message: "Key revoked successfully." };
    },
  );

  /** Disable BYOK (revert to system-managed encryption) */
  server.post<{ Params: { orgId: string } }>(
    "/api/organizations/:orgId/encryption/disable",
    routeAuthz({ org: "ADMIN" }),
    async (request, reply) => {
      const authUser = getAuthUser(request);
      const { orgId } = request.params;

      const canManage = await canManageEncryption(authUser.id, orgId);
      if (!canManage) {
        return sendForbidden(reply, "Insufficient permissions");
      }

      await disableBYOK(orgId);

      return {
        success: true,
        message: "BYOK disabled. System-managed encryption is now active.",
      };
    },
  );

  /** List all key versions for an organization */
  server.get<{ Params: { orgId: string } }>(
    "/api/organizations/:orgId/encryption/keys",
    routeAuthz({ org: "ADMIN" }),
    async (request, reply) => {
      const authUser = getAuthUser(request);
      const { orgId } = request.params;

      const canManage = await canManageEncryption(authUser.id, orgId);
      if (!canManage) {
        return sendForbidden(reply, "Insufficient permissions");
      }

      const keys = await listKeys(orgId);

      // Don't expose key hashes
      return keys.map((k) => ({
        id: k.id,
        version: k.version,
        algorithm: k.algorithm,
        isActive: k.isActive,
        createdAt: k.createdAt,
        expiresAt: k.expiresAt,
        description: k.description,
      }));
    },
  );
};

/**
 * CI/CD API - Helper Functions
 */
import { createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";
import type { FastifyReply, FastifyRequest } from "fastify";
import { getPrisma } from "../../db.js";
import { sendUnauthorized } from "../../utils/api-response.js";
import logger from "../../utils/logger.js";
import { signedBody } from "../../utils/raw-body.js";
import {
  decryptValue,
  encryptValue,
  isEncrypted,
} from "../../services/encryption/encryption-service.js";

/** Finding from threat scan */
export interface Finding {
  threatId: string;
  name: string;
  description: string | null;
  severity: string;
  status: string;
  strideCategories: string[];
  componentName?: string;
  connectionLabel?: string;
}

/** Hash API key for storage */
export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

/** Generate a new API key */
export function generateApiKey(): { key: string; prefix: string } {
  const randomPart = randomBytes(24).toString("base64url");
  const key = `ftm_${randomPart}`;
  const prefix = key.substring(0, 12);
  return { key, prefix };
}

/** Verify API key and return organization context */
export async function verifyApiKey(
  apiKey: string,
): Promise<{ organizationId: string; scopes: string[] } | null> {
  if (!apiKey.startsWith("ftm_")) return null;

  const prisma = await getPrisma();
  const keyHash = hashApiKey(apiKey);

  const keyRecord = await prisma.cIApiKey.findFirst({
    where: {
      keyHash,
      isActive: true,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
  });

  if (!keyRecord) return null;

  await prisma.cIApiKey.update({
    where: { id: keyRecord.id },
    data: { lastUsedAt: new Date(), usageCount: { increment: 1 } },
  });

  return {
    organizationId: keyRecord.organizationId,
    scopes: JSON.parse(keyRecord.scopes) as string[],
  };
}

/** ACTIVE OWNER/ADMIN of the organization (suspended members get nothing). */
export {
  isActiveOrgAdmin as isOrgAdmin,
  isActiveOrgMember as isOrgMember,
} from "../../services/access-control/access-control-service.js";

export { getAuthUser } from "../../utils/auth-helpers.js";

/** Encrypt an org CI webhook secret for storage. Throws if encryption fails. */
export function sealCiWebhookSecret(secret: string): string {
  const sealed = encryptValue(secret);
  if (!sealed) throw new Error("Failed to encrypt CI webhook secret");
  return sealed;
}

/**
 * The plaintext of a stored Organization.ciWebhookSecret, or null when there
 * is none or it cannot be decrypted. Rows written before encryption hold
 * plaintext: those are used as-is and re-encrypted in place on first read
 * (best effort: a failed migration is logged and retried on the next read,
 * it never fails the delivery).
 */
async function openCiWebhookSecret(
  organizationId: string,
  stored: string | null | undefined,
): Promise<string | null> {
  if (!stored) return null;
  if (isEncrypted(stored)) return decryptValue(stored);
  try {
    const prisma = await getPrisma();
    await prisma.organization.update({
      where: { id: organizationId },
      data: { ciWebhookSecret: sealCiWebhookSecret(stored) },
    });
  } catch (err) {
    logger.warn(
      { err, organizationId },
      "Could not re-encrypt legacy CI webhook secret",
    );
  }
  return stored;
}

/**
 * An org's decrypted CI webhook secret: null when none is configured (or it
 * no longer decrypts), undefined when the organization does not exist.
 */
export async function getOrgCiWebhookSecret(
  organizationId: string,
): Promise<string | null | undefined> {
  const prisma = await getPrisma();
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { ciWebhookSecret: true },
  });
  if (!org) return undefined;
  return openCiWebhookSecret(organizationId, org.ciWebhookSecret);
}

/** Verify GitHub webhook signature (HMAC-SHA256) */
export function verifyGitHubSignature(
  payload: string | undefined,
  signature: string | undefined,
  secret: string,
): boolean {
  if (payload === undefined) return false;
  if (!signature || !signature.startsWith("sha256=")) return false;

  const expectedSignature = signature.slice(7);
  const computedSignature = createHmac("sha256", secret)
    .update(payload)
    .digest("hex");

  try {
    return timingSafeEqual(
      Buffer.from(expectedSignature, "hex"),
      Buffer.from(computedSignature, "hex"),
    );
  } catch {
    return false;
  }
}

/**
 * Verify an org-scoped webhook delivery signed with the org's CI webhook
 * secret (`X-Hub-Signature-256` or `X-Hub-Signature`, HMAC-SHA256). On
 * failure sends 401 and returns false. Returns a boolean, not the reply: a
 * FastifyReply is thenable, so an async function cannot hand it back.
 */
export async function verifyOrgWebhookDelivery(
  request: FastifyRequest,
  reply: FastifyReply,
  orgId: string,
  setupHint: string,
): Promise<boolean> {
  const secret = await getOrgCiWebhookSecret(orgId);
  if (!secret) {
    sendUnauthorized(
      reply,
      "Webhook secret not configured for this organization. An admin can generate one with " +
        `POST /api/ci/webhook-secret?organizationId=<orgId> and ${setupHint}.`,
    );
    return false;
  }
  const header =
    request.headers["x-hub-signature-256"] ??
    request.headers["x-hub-signature"];
  const signature = Array.isArray(header) ? header[0] : header;
  if (!verifyGitHubSignature(signedBody(request), signature, secret)) {
    sendUnauthorized(reply, "Invalid webhook signature");
    return false;
  }
  return true;
}

/** Run the threat scan and collect findings */
export async function runThreatScan(threatModelId: string): Promise<{
  findings: Finding[];
  counts: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
  };
}> {
  const prisma = await getPrisma();

  const threats = await prisma.threat.findMany({
    where: { threatModelId },
    include: { mitigations: { select: { status: true } } },
  });

  const componentNodeIds = threats
    .filter((t) => t.componentNodeId)
    .map((t) => t.componentNodeId as string);
  const components = await prisma.component.findMany({
    where: { threatModelId, nodeId: { in: componentNodeIds } },
    select: { nodeId: true, name: true },
  });
  const componentMap = new Map(components.map((c) => [c.nodeId, c.name]));

  const connectionEdgeIds = threats
    .filter((t) => t.connectionEdgeId)
    .map((t) => t.connectionEdgeId as string);
  const connections = await prisma.connection.findMany({
    where: { threatModelId, edgeId: { in: connectionEdgeIds } },
    select: { edgeId: true, label: true },
  });
  const connectionMap = new Map(connections.map((c) => [c.edgeId, c.label]));

  const findings: Finding[] = threats.map((threat) => ({
    threatId: threat.id,
    name: threat.name,
    description: threat.description,
    severity: threat.severity,
    status: threat.status,
    strideCategories: JSON.parse(threat.strideCategories) as string[],
    componentName: threat.componentNodeId
      ? componentMap.get(threat.componentNodeId)
      : undefined,
    connectionLabel: threat.connectionEdgeId
      ? (connectionMap.get(threat.connectionEdgeId) ?? undefined)
      : undefined,
  }));

  const counts = {
    critical: findings.filter((f) => f.severity === "CRITICAL").length,
    high: findings.filter((f) => f.severity === "HIGH").length,
    medium: findings.filter((f) => f.severity === "MEDIUM").length,
    low: findings.filter((f) => f.severity === "LOW").length,
    info: findings.filter((f) => f.severity === "INFO").length,
  };

  return { findings, counts };
}

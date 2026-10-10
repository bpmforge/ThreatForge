/**
 * Integrations - Shared route helpers
 *
 * Steps that the GitHub and JIRA route files perform identically: loading and
 * decrypting an org's integration, saving its configuration, recording
 * connection tests and pushed issues, and bookkeeping for bidirectional syncs.
 * Authorization checks stay in the route files; nothing here skips them.
 */
import type { FastifyReply } from "fastify";
import type {
  Integration,
  IntegrationMapping,
  IntegrationSyncLog,
  PrismaClient,
} from "@prisma/client";
import { encryptValue } from "../../../services/encryption/encryption-service.js";
import {
  sendInternalError,
  sendNotFound,
} from "../../../utils/api-response.js";
import { getAuthUser, logAudit } from "../helpers.js";
import { decryptAndParse } from "./github/helpers.js";

export type ThreatStatusType =
  | "OPEN"
  | "MITIGATED"
  | "ACCEPTED"
  | "NOT_APPLICABLE";
export type MitigationStatusType = "NOT_IMPLEMENTED" | "IMPLEMENTED";

/** How a provider's integration row is found and what its errors say. */
interface IntegrationDescriptor {
  type: Integration["type"];
  label: string;
}

export const GITHUB_INTEGRATION: IntegrationDescriptor = {
  type: "GITHUB_ISSUES",
  label: "GitHub integration",
};

export const JIRA_INTEGRATION: IntegrationDescriptor = {
  type: "JIRA",
  label: "JIRA integration",
};

/** A loaded value, or the reply already sent when it could not be loaded. */
type Loaded<T> = (T & { denied?: undefined }) | { denied: FastifyReply };

export type DecryptedIntegration<C, K> = Loaded<{
  integration: Integration;
  config: C;
  credentials: K;
}>;

/** Decrypt an integration's config and credentials, or send a 500. */
export function decryptIntegration<C, K>(
  reply: FastifyReply,
  integration: Integration,
): DecryptedIntegration<C, K> {
  const config = decryptAndParse<C>(integration.config);
  const credentials = decryptAndParse<K>(integration.credentials);
  if (!config || !credentials) {
    return {
      denied: sendInternalError(
        reply,
        "Failed to decrypt integration configuration",
      ),
    };
  }
  return { integration, config, credentials };
}

/** Find the org's integration and decrypt it, or send a 404 / 500. */
export async function loadIntegration<C, K>(
  prisma: PrismaClient,
  reply: FastifyReply,
  orgId: string,
  descriptor: IntegrationDescriptor,
  options: { activeOnly?: boolean } = {},
): Promise<DecryptedIntegration<C, K>> {
  const integration = await prisma.integration.findFirst({
    where: {
      organizationId: orgId,
      type: descriptor.type,
      ...(options.activeOnly ? { status: "ACTIVE" as const } : {}),
    },
  });
  if (!integration) {
    return { denied: sendNotFound(reply, descriptor.label) };
  }
  return decryptIntegration<C, K>(reply, integration);
}

/** Encrypt and upsert an org's integration as ACTIVE, or send a 500. */
export async function saveIntegration(
  prisma: PrismaClient,
  reply: FastifyReply,
  input: {
    orgId: string;
    userId: string;
    type: Integration["type"];
    name: string;
    config: unknown;
    credentials: unknown;
  },
): Promise<Loaded<{ integration: Integration }>> {
  const encryptedConfig = encryptValue(JSON.stringify(input.config));
  const encryptedCredentials = encryptValue(JSON.stringify(input.credentials));

  if (!encryptedConfig || !encryptedCredentials) {
    return {
      denied: sendInternalError(reply, "Failed to encrypt configuration"),
    };
  }

  const integration = await prisma.integration.upsert({
    where: {
      organizationId_type: { organizationId: input.orgId, type: input.type },
    },
    update: {
      name: input.name,
      status: "ACTIVE",
      config: encryptedConfig,
      credentials: encryptedCredentials,
      lastSyncStatus: "Connected successfully",
      consecutiveFailures: 0,
      updatedAt: new Date(),
    },
    create: {
      organizationId: input.orgId,
      type: input.type,
      name: input.name,
      status: "ACTIVE",
      config: encryptedConfig,
      credentials: encryptedCredentials,
      createdById: input.userId,
    },
  });
  return { integration };
}

/** Persist the outcome of a connection test on the integration row. */
export async function recordConnectionTest(
  prisma: PrismaClient,
  integrationId: string,
  result: { ok: boolean; error?: string },
): Promise<void> {
  await prisma.integration.update({
    where: { id: integrationId },
    data: result.ok
      ? {
          lastSyncStatus: "Connection test passed",
          lastSyncedAt: new Date(),
          consecutiveFailures: 0,
        }
      : {
          lastSyncStatus: `Connection test failed: ${result.error}`,
          consecutiveFailures: { increment: 1 },
        },
  });
}

/** Log a failed single-issue push. */
export async function recordFailedPush(
  prisma: PrismaClient,
  integrationId: string,
  error: string | undefined,
): Promise<void> {
  await prisma.integrationSyncLog.create({
    data: {
      integrationId,
      direction: "PUSH_ONLY",
      status: "FAILED",
      itemsFailed: 1,
      errorMessage: error,
    },
  });
}

/** Map an issue-creation body to the local item it was raised for. */
export function resolveIssueTarget(body: {
  threatId?: string;
  mitigationId?: string;
}): { localType: string; localId: string } {
  return {
    localType: body.threatId
      ? "threat"
      : body.mitigationId
        ? "mitigation"
        : "manual",
    localId: body.threatId || body.mitigationId || "manual",
  };
}

/** Record a successfully pushed issue: mapping, sync log and integration status. */
export async function recordPushedIssue(
  prisma: PrismaClient,
  integrationId: string,
  mapping: {
    localType: string;
    localId: string;
    externalId: string;
    externalKey: string;
    externalUrl: string;
    syncDirection: IntegrationMapping["syncDirection"];
  },
): Promise<void> {
  await prisma.integrationMapping.create({
    data: {
      integrationId,
      ...mapping,
      externalType: "issue",
      lastSyncedAt: new Date(),
    },
  });

  await prisma.integrationSyncLog.create({
    data: {
      integrationId,
      direction: "PUSH_ONLY",
      status: "COMPLETED",
      itemsSynced: 1,
      completedAt: new Date(),
    },
  });

  await prisma.integration.update({
    where: { id: integrationId },
    data: {
      lastSyncedAt: new Date(),
      lastSyncStatus: "Success",
      consecutiveFailures: 0,
    },
  });
}

/** Load a threat, returning null unless it belongs to the organization. */
export async function findOrgThreat(
  prisma: PrismaClient,
  threatId: string,
  orgId: string,
) {
  const threat = await prisma.threat.findUnique({
    where: { id: threatId },
    include: {
      threatModel: {
        include: {
          project: { select: { name: true, organizationId: true } },
        },
      },
    },
  });
  if (!threat || threat.threatModel.project.organizationId !== orgId) {
    return null;
  }
  return threat;
}

/** Open a bidirectional sync run and load the mappings it will process. */
export async function startBidirectionalSync(
  prisma: PrismaClient,
  integrationId: string,
): Promise<{ syncLog: IntegrationSyncLog; mappings: IntegrationMapping[] }> {
  const syncLog = await prisma.integrationSyncLog.create({
    data: {
      integrationId,
      direction: "BIDIRECTIONAL",
      status: "IN_PROGRESS",
    },
  });

  const mappings = await prisma.integrationMapping.findMany({
    where: {
      integrationId,
      syncDirection: { in: ["BIDIRECTIONAL", "PULL_ONLY"] },
    },
  });

  return { syncLog, mappings };
}

/**
 * Apply remote-derived statuses to the threat or mitigation a mapping points
 * at, then stamp the mapping. Returns 1 if a local record changed, else 0.
 */
export async function applyMappingStatus(
  prisma: PrismaClient,
  mapping: IntegrationMapping,
  statuses: { threat: ThreatStatusType; mitigation: MitigationStatusType },
): Promise<number> {
  let changed = 0;
  if (mapping.localType === "threat") {
    const threat = await prisma.threat.findUnique({
      where: { id: mapping.localId },
    });
    if (threat && threat.status !== statuses.threat) {
      await prisma.threat.update({
        where: { id: mapping.localId },
        data: { status: statuses.threat, updatedAt: new Date() },
      });
      changed = 1;
    }
  } else if (mapping.localType === "mitigation") {
    const mitigation = await prisma.mitigation.findUnique({
      where: { id: mapping.localId },
    });
    if (mitigation && mitigation.status !== statuses.mitigation) {
      await prisma.mitigation.update({
        where: { id: mapping.localId },
        data: { status: statuses.mitigation, updatedAt: new Date() },
      });
      changed = 1;
    }
  }

  await prisma.integrationMapping.update({
    where: { id: mapping.id },
    data: { lastSyncedAt: new Date() },
  });
  return changed;
}

/** Close a bidirectional sync run: sync log, integration status, audit entry. */
export async function finishBidirectionalSync(
  prisma: PrismaClient,
  run: {
    syncLog: IntegrationSyncLog;
    integration: Integration;
    user: ReturnType<typeof getAuthUser>;
    orgId: string;
    auditType: string;
    itemsSynced: number;
    itemsFailed: number;
    errors: string[];
  },
): Promise<"FAILED" | "PARTIAL" | "COMPLETED"> {
  const { itemsSynced, itemsFailed, errors, integration, user } = run;
  const status =
    itemsFailed > 0 && itemsSynced === 0
      ? "FAILED"
      : itemsFailed > 0
        ? "PARTIAL"
        : "COMPLETED";

  await prisma.integrationSyncLog.update({
    where: { id: run.syncLog.id },
    data: {
      status,
      itemsSynced,
      itemsFailed,
      errorMessage: errors.length > 0 ? errors.join("; ") : null,
      completedAt: new Date(),
    },
  });

  await prisma.integration.update({
    where: { id: integration.id },
    data: {
      lastSyncedAt: new Date(),
      lastSyncStatus:
        status === "COMPLETED"
          ? "Success"
          : `${status}: ${itemsFailed} failures`,
      consecutiveFailures: status === "FAILED" ? { increment: 1 } : 0,
    },
  });

  await logAudit({
    scope: "ORGANIZATION",
    action: "UPDATE",
    resourceType: "ORGANIZATION",
    resourceId: integration.id,
    resourceName: integration.name,
    userId: user.id,
    userEmail: user.email || "",
    organizationId: run.orgId,
    metadata: { type: run.auditType, itemsSynced, itemsFailed },
  });

  return status;
}

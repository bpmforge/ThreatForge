/**
 * Audit Logging Service
 *
 * Provides centralized audit logging for tracking user actions
 * on sensitive resources (threat models, projects, etc.)
 *
 * Audit scopes:
 * - SYSTEM: Platform-wide actions (admin console, system settings)
 * - ORGANIZATION: Organization-level actions (members, settings)
 * - MODEL: Model-level actions (edits, shares, exports)
 */
import type { AuditAction, AuditScope, ResourceType } from "@prisma/client";
import { getPrisma } from "../db.js";
import logger from "../utils/logger.js";

export interface AuditLogEntry {
  scope?: AuditScope;
  action: AuditAction;
  resourceType: ResourceType;
  resourceId: string;
  resourceName?: string;
  changes?: Record<string, { old: unknown; new: unknown }>;
  metadata?: Record<string, unknown>;
  userId: string;
  userEmail: string;
  organizationId?: string;
  modelId?: string;
  requestId?: string;
  impersonatedBy?: string;
  // AI-specific tracking fields
  aiProviderId?: string;
  aiProviderName?: string;
  aiModel?: string;
  aiInputTokens?: number;
  aiOutputTokens?: number;
  aiTotalTokens?: number;
  aiLatencyMs?: number;
  aiEstimatedCost?: number;
}

export interface AuditLogFilter {
  scope?: AuditScope;
  resourceType?: ResourceType;
  resourceId?: string;
  userId?: string;
  organizationId?: string;
  modelId?: string;
  action?: AuditAction;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

/**
 * Log an audit event
 */
export async function logAudit(entry: AuditLogEntry): Promise<void> {
  const prisma = await getPrisma();

  try {
    await prisma.auditLog.create({
      data: {
        scope: entry.scope || "ORGANIZATION",
        action: entry.action,
        resourceType: entry.resourceType,
        resourceId: entry.resourceId,
        resourceName: entry.resourceName,
        changes: entry.changes ? JSON.stringify(entry.changes) : null,
        metadata: entry.metadata ? JSON.stringify(entry.metadata) : null,
        userId: entry.userId,
        userEmail: entry.userEmail,
        organizationId: entry.organizationId,
        modelId: entry.modelId,
        requestId: entry.requestId,
        impersonatedBy: entry.impersonatedBy,
        // AI-specific fields
        aiProviderId: entry.aiProviderId,
        aiProviderName: entry.aiProviderName,
        aiModel: entry.aiModel,
        aiInputTokens: entry.aiInputTokens,
        aiOutputTokens: entry.aiOutputTokens,
        aiTotalTokens: entry.aiTotalTokens,
        aiLatencyMs: entry.aiLatencyMs,
        aiEstimatedCost: entry.aiEstimatedCost,
      },
    });
  } catch (error) {
    // Log error but don't throw - audit logging should not break main operations
    logger.error({ err: error }, "Failed to create audit log");
  }
}

/**
 * Query audit logs with filters
 */
export async function queryAuditLogs(filter: AuditLogFilter) {
  const prisma = await getPrisma();

  const where: Record<string, unknown> = {};

  if (filter.scope) where.scope = filter.scope;
  if (filter.resourceType) where.resourceType = filter.resourceType;
  if (filter.resourceId) where.resourceId = filter.resourceId;
  if (filter.userId) where.userId = filter.userId;
  if (filter.organizationId) where.organizationId = filter.organizationId;
  if (filter.modelId) where.modelId = filter.modelId;
  if (filter.action) where.action = filter.action;

  if (filter.startDate || filter.endDate) {
    where.createdAt = {};
    if (filter.startDate)
      (where.createdAt as Record<string, Date>).gte = filter.startDate;
    if (filter.endDate)
      (where.createdAt as Record<string, Date>).lte = filter.endDate;
  }

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: filter.limit || 50,
      skip: filter.offset || 0,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return {
    logs: logs.map((log) => ({
      ...log,
      changes: log.changes ? JSON.parse(log.changes) : null,
      metadata: log.metadata ? JSON.parse(log.metadata) : null,
    })),
    total,
    limit: filter.limit || 50,
    offset: filter.offset || 0,
  };
}

/**
 * Purge old audit logs based on retention policy
 */
export async function purgeOldAuditLogs(
  retentionDays: number,
): Promise<number> {
  const prisma = await getPrisma();

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

  const result = await prisma.auditLog.deleteMany({
    where: {
      createdAt: { lt: cutoffDate },
    },
  });

  return result.count;
}

/**
 * Get AI usage summary for an organization
 */
export async function getOrganizationAIUsage(
  organizationId: string,
  startDate?: Date,
  endDate?: Date,
) {
  const prisma = await getPrisma();

  const where: Record<string, unknown> = {
    organizationId,
    action: "AI_QUERY",
  };

  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) (where.createdAt as Record<string, Date>).gte = startDate;
    if (endDate) (where.createdAt as Record<string, Date>).lte = endDate;
  }

  const logs = await prisma.auditLog.findMany({
    where,
    select: {
      aiProviderId: true,
      aiProviderName: true,
      aiModel: true,
      aiInputTokens: true,
      aiOutputTokens: true,
      aiTotalTokens: true,
      aiEstimatedCost: true,
      aiLatencyMs: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  // Aggregate by provider
  const byProvider: Record<
    string,
    {
      providerId: string;
      providerName: string;
      requests: number;
      totalInputTokens: number;
      totalOutputTokens: number;
      totalTokens: number;
      totalCost: number;
      avgLatencyMs: number;
    }
  > = {};

  // Aggregate by model
  const byModel: Record<
    string,
    {
      model: string;
      requests: number;
      totalTokens: number;
      totalCost: number;
    }
  > = {};

  let totalRequests = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalTokens = 0;
  let totalCost = 0;
  let totalLatency = 0;

  for (const log of logs) {
    totalRequests++;
    totalInputTokens += log.aiInputTokens || 0;
    totalOutputTokens += log.aiOutputTokens || 0;
    totalTokens += log.aiTotalTokens || 0;
    totalCost += log.aiEstimatedCost || 0;
    totalLatency += log.aiLatencyMs || 0;

    // By provider
    const providerId = log.aiProviderId || "unknown";
    if (!byProvider[providerId]) {
      byProvider[providerId] = {
        providerId,
        providerName: log.aiProviderName || "Unknown",
        requests: 0,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalTokens: 0,
        totalCost: 0,
        avgLatencyMs: 0,
      };
    }
    byProvider[providerId].requests++;
    byProvider[providerId].totalInputTokens += log.aiInputTokens || 0;
    byProvider[providerId].totalOutputTokens += log.aiOutputTokens || 0;
    byProvider[providerId].totalTokens += log.aiTotalTokens || 0;
    byProvider[providerId].totalCost += log.aiEstimatedCost || 0;
    byProvider[providerId].avgLatencyMs += log.aiLatencyMs || 0;

    // By model
    const model = log.aiModel || "unknown";
    if (!byModel[model]) {
      byModel[model] = { model, requests: 0, totalTokens: 0, totalCost: 0 };
    }
    byModel[model].requests++;
    byModel[model].totalTokens += log.aiTotalTokens || 0;
    byModel[model].totalCost += log.aiEstimatedCost || 0;
  }

  // Calculate averages
  for (const provider of Object.values(byProvider)) {
    provider.avgLatencyMs =
      provider.requests > 0
        ? Math.round(provider.avgLatencyMs / provider.requests)
        : 0;
  }

  return {
    summary: {
      totalRequests,
      totalInputTokens,
      totalOutputTokens,
      totalTokens,
      totalCost: Math.round(totalCost * 10000) / 10000, // Round to 4 decimal places
      avgLatencyMs:
        totalRequests > 0 ? Math.round(totalLatency / totalRequests) : 0,
    },
    byProvider: Object.values(byProvider),
    byModel: Object.values(byModel),
  };
}
